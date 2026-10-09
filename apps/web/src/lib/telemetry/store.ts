// The in-browser telemetry store: today's buckets, the live values and the open bucket of every device
// the dashboard is showing, shared by every page so moving between Overview / Monitoring / Performance
// costs no calls. Framework-free (React sits on top in react.tsx) and fully injectable, so it is tested
// without a browser or a database.

import { binStart, istDayStart, upsertBucket, wireToBucket } from "./combine";
import type { PersistentCache } from "./cache";
import { BUCKET_MS, type Bucket, type TickPayload } from "./types";
import type { HeartbeatInfo } from "./loaders";
import type { ServerVerdict } from "../device-sync-types";

export interface SeriesRange {
  fromMs: number;
  toMs: number;
  /** The interval fetched from the database (15, 60 or 1440). Coarser views are combined from it locally. */
  minutes: number;
}

export type SeriesFetcher = (req: { deviceId: string; keys: string[] } & SeriesRange) => Promise<Map<string, Bucket[]>>;
export type LatestLoader = (deviceId: string) => Promise<Record<string, LatestValue>>;
export type OpenLoader = (deviceId: string, keys: string[]) => Promise<Record<string, Bucket>>;

export interface LatestValue {
  value: number;
  /** When this value was last written (epoch ms). */
  ts: number;
  unit: string | null;
}

export type LiveStatus = "idle" | "connecting" | "live" | "paused" | "offline";

export interface StoreDeps {
  fetchSeries: SeriesFetcher;
  loadLatest?: LatestLoader;
  loadOpen?: OpenLoader;
  /** Reads what the agent last reported about itself and its device, for when the live channel was not listening. */
  loadHeartbeat?: (deviceId: string) => Promise<HeartbeatInfo | null>;
  cache?: PersistentCache;
  now?: () => number;
  /** Schedules the batched notification (default: setTimeout). */
  schedule?: (fn: () => void, ms: number) => void;
}

interface Entry {
  buckets: Bucket[];
  fetchedAt: number;
  /** Served from the browser cache and still being revalidated. */
  stale: boolean;
}

const NOTIFY_MS = 150;
export interface DeviceLiveStatus {
  status: LiveStatus;
  /** When this browser last heard from the agent (any live message). */
  lastTickAt: number | null;
  /** When the device last answered a reading (epoch ms), as far as the live messages say. */
  lastReadAt: number | null;
  /** Whether the device is answering the agent; null = not said yet. */
  deviceOnline: boolean | null;
  /** The server's newest verdict on the device (from a live status message or a re-read), judged by the server's own clock. */
  verdict: ServerVerdict | null;
  /** The server's clock minus this browser's clock (ms), measured when that verdict arrived. */
  clockOffsetMs: number | null;
}
const IDLE: DeviceLiveStatus = { status: "idle", lastTickAt: null, lastReadAt: null, deviceOnline: null, verdict: null, clockOffsetMs: null };   // one shared object: a stable snapshot for React

/** The verdict a status message carries, or null when it lacks the parts. */
function verdictFromTick(agent: NonNullable<TickPayload["agent"]>): ServerVerdict | null {
  if (!agent.status || !agent.server_now) return null;
  return {
    status: agent.status,
    reason: agent.status_reason ?? null,
    lastSeenMs: agent.last_seen ? new Date(agent.last_seen).getTime() : null,
    offlineAfterS: agent.offline_after_s ?? 180,
    serverNowMs: new Date(agent.server_now).getTime(),
  };
}

export function todayRange(now: number, minutes = 15): SeriesRange {
  const from = istDayStart(now);
  return { fromMs: from, toMs: from + 86_400_000, minutes };
}

const rangeId = (r: SeriesRange) => `${r.minutes}|${r.fromMs}|${r.toMs}`;
const entryId = (deviceId: string, key: string, r: SeriesRange) => `${deviceId}|${key}|${rangeId(r)}`;

export class TelemetryStore {
  private entries = new Map<string, Entry>();
  private inflight = new Map<string, Promise<void>>();
  private latest = new Map<string, Map<string, LatestValue>>();
  private open = new Map<string, Map<string, Bucket>>();
  private status = new Map<string, DeviceLiveStatus>();
  private rev = new Map<string, number>();
  private listeners = new Set<() => void>();
  private keyListeners = new Map<string, Set<() => void>>();
  private watching = new Map<string, Map<string, number>>();
  private pendingNotify = false;
  private dirtyKeys = new Set<string>();
  private readonly now: () => number;
  private readonly schedule: (fn: () => void, ms: number) => void;

  constructor(private readonly deps: StoreDeps) {
    this.now = deps.now ?? Date.now;
    this.schedule = deps.schedule ?? ((fn, ms) => void setTimeout(fn, ms));
  }

  // ------------------------------------------------------------ subscriptions

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  subscribeKey = (deviceId: string, key: string, fn: () => void): (() => void) => {
    const id = `${deviceId}|${key}`;
    let set = this.keyListeners.get(id);
    if (!set) this.keyListeners.set(id, (set = new Set()));
    set.add(fn);
    return () => {
      set!.delete(fn);
      if (set!.size === 0) this.keyListeners.delete(id);
    };
  };

  /** Increments on every change to a device's series/open buckets - what charts re-derive from. */
  getRev = (deviceId: string): number => this.rev.get(deviceId) ?? 0;

  private touch(deviceId: string, keys?: Iterable<string>): void {
    this.rev.set(deviceId, (this.rev.get(deviceId) ?? 0) + 1);
    for (const k of keys ?? []) this.dirtyKeys.add(`${deviceId}|${k}`);
    if (this.pendingNotify) return;
    this.pendingNotify = true;
    this.schedule(() => {
      this.pendingNotify = false;
      const dirty = [...this.dirtyKeys];
      this.dirtyKeys.clear();
      for (const id of dirty) this.keyListeners.get(id)?.forEach((fn) => fn());
      this.listeners.forEach((fn) => fn());
    }, NOTIFY_MS);
  }

  // ------------------------------------------------------------ what the screens are showing

  /** A component says it is showing these keys; returns the release function. Catch-up refreshes only these. */
  watch(deviceId: string, keys: string[]): () => void {
    let m = this.watching.get(deviceId);
    if (!m) this.watching.set(deviceId, (m = new Map()));
    for (const k of keys) m.set(k, (m.get(k) ?? 0) + 1);
    return () => {
      for (const k of keys) {
        const n = (m!.get(k) ?? 1) - 1;
        if (n <= 0) m!.delete(k);
        else m!.set(k, n);
      }
    };
  }

  watchedKeys(deviceId: string): string[] {
    return [...(this.watching.get(deviceId)?.keys() ?? [])];
  }

  // ------------------------------------------------------------ series

  /** Closed buckets for a key over a range, plus the open bucket if it falls inside. Undefined until loaded. */
  getBuckets(deviceId: string, key: string, range: SeriesRange): Bucket[] | undefined {
    const e = this.entries.get(entryId(deviceId, key, range));
    if (!e) return undefined;
    const ob = this.open.get(deviceId)?.get(key);
    if (ob && ob.t >= range.fromMs && ob.t < range.toMs && range.minutes === 15) return upsertBucket(e.buckets, ob);
    return e.buckets;
  }

  isStale(deviceId: string, key: string, range: SeriesRange): boolean {
    return this.entries.get(entryId(deviceId, key, range))?.stale ?? false;
  }

  isLoaded(deviceId: string, keys: string[], range: SeriesRange): boolean {
    return keys.every((k) => this.entries.has(entryId(deviceId, k, range)));
  }

  /**
   * Make sure every key is loaded, in at most ONE request for the keys nobody is already fetching.
   * Identical in-flight work is shared; keys already held are not fetched again unless `force` is set.
   * A browser-cached copy is served at once, then revalidated unless it is final.
   */
  async ensureSeries(deviceId: string, keys: string[], range: SeriesRange, opts: { force?: boolean } = {}): Promise<void> {
    const waits: Promise<void>[] = [];
    const missing: string[] = [];
    for (const key of keys) {
      const id = entryId(deviceId, key, range);
      const running = this.inflight.get(id);
      if (running) waits.push(running);
      else if (opts.force || !this.entries.has(id) || this.entries.get(id)!.stale) missing.push(key);
    }
    if (missing.length > 0) {
      const p = this.load(deviceId, missing, range);
      for (const key of missing) this.inflight.set(entryId(deviceId, key, range), p);
      void p.then(
        () => missing.forEach((k) => this.inflight.delete(entryId(deviceId, k, range))),
        () => missing.forEach((k) => this.inflight.delete(entryId(deviceId, k, range)))
      );
      waits.push(p);
    }
    await Promise.all(waits);
  }

  private async load(deviceId: string, keys: string[], range: SeriesRange): Promise<void> {
    const cache = this.deps.cache;
    const now = this.now();
    const isFinal = range.toMs <= now - 2 * 3_600_000;           // an old range no longer changes
    let needNetwork = keys;
    if (cache) {
      const cached = await Promise.all(keys.map((k) => cache.load<Bucket[]>(entryId(deviceId, k, range))));
      const served: string[] = [];
      keys.forEach((k, i) => {
        const hit = cached[i];
        if (!hit || this.entries.has(entryId(deviceId, k, range))) return;
        this.entries.set(entryId(deviceId, k, range), { buckets: hit.value, fetchedAt: hit.savedAt, stale: !(isFinal && hit.savedAt >= range.toMs) });
        served.push(k);
      });
      if (served.length) this.touch(deviceId, served);
      needNetwork = keys.filter((k) => this.entries.get(entryId(deviceId, k, range))?.stale !== false);
    }
    if (needNetwork.length === 0) return;
    const fetched = await this.deps.fetchSeries({ deviceId, keys: needNetwork, ...range });
    const t = this.now();
    for (const key of needNetwork) {
      const buckets = fetched.get(key) ?? [];
      this.entries.set(entryId(deviceId, key, range), { buckets, fetchedAt: t, stale: false });
      void cache?.save(entryId(deviceId, key, range), buckets);
    }
    this.touch(deviceId, needNetwork);
  }

  // ------------------------------------------------------------ latest values

  getLatest = (deviceId: string, key: string): LatestValue | undefined => this.latest.get(deviceId)?.get(key);

  setLatest(deviceId: string, values: Record<string, LatestValue>): void {
    let m = this.latest.get(deviceId);
    if (!m) this.latest.set(deviceId, (m = new Map()));
    const changed: string[] = [];
    for (const [k, v] of Object.entries(values)) {
      const cur = m.get(k);
      if (!cur || cur.ts <= v.ts) {
        if (!cur || cur.value !== v.value || cur.ts !== v.ts) changed.push(k);
        m.set(k, v);
      }
    }
    if (changed.length) this.touch(deviceId, changed);
  }

  // ------------------------------------------------------------ live

  /** One live message from the device channel: new values and the open bucket's running figures. */
  applyTick(deviceId: string, tick: TickPayload): void {
    const ts = new Date(tick.ts).getTime();
    const values: Record<string, LatestValue> = {};
    for (const [k, v] of Object.entries(tick.values ?? {})) {
      const num = typeof v === "number" ? v : v.v;
      const unit = typeof v === "number" ? null : (v.u ?? null);
      if (typeof num === "number" && Number.isFinite(num)) values[k] = { value: num, ts, unit: unit ?? this.latest.get(deviceId)?.get(k)?.unit ?? null };
    }
    this.setLatest(deviceId, values);

    const touched: string[] = [];
    if (tick.open) {
      let m = this.open.get(deviceId);
      if (!m) this.open.set(deviceId, (m = new Map()));
      for (const [key, wire] of Object.entries(tick.open)) {
        const next = wireToBucket(wire);
        const prev = m.get(key);
        // The previous open bucket has finished: keep it as a closed bucket of today's series.
        if (prev && next.t > prev.t) this.closeInto(deviceId, key, prev);
        if (!prev || next.t >= prev.t) m.set(key, next);
        touched.push(key);
      }
    }
    const prev = this.status.get(deviceId) ?? IDLE;
    let lastReadAt = prev.lastReadAt;
    let deviceOnline = prev.deviceOnline;
    if (tick.agent) {
      if (typeof tick.agent.device_online === "boolean") deviceOnline = tick.agent.device_online;
      const lr = tick.agent.last_read_at ? new Date(tick.agent.last_read_at).getTime() : NaN;
      if (Number.isFinite(lr)) lastReadAt = Math.max(lastReadAt ?? 0, lr);
    }
    if (Object.keys(values).length > 0) {
      // Values only ever arrive when the device was just read, so it is answering.
      lastReadAt = Math.max(lastReadAt ?? 0, ts);
      deviceOnline = true;
    }
    this.lastTickTs.set(deviceId, Math.max(this.lastTickTs.get(deviceId) ?? 0, ts));
    // A message announcing a change of the server's verdict is the server speaking, not the unit: it carries the verdict (and the
    // server's clock) but does not count as the unit having just checked in.
    const announced = tick.agent?.status ? verdictFromTick(tick.agent) : null;
    let verdict = prev.verdict;
    let clockOffsetMs = prev.clockOffsetMs;
    if (announced && (!verdict || announced.serverNowMs >= verdict.serverNowMs)) {
      verdict = announced;
      clockOffsetMs = announced.serverNowMs - this.now();
    }
    this.status.set(deviceId, { status: "live", lastTickAt: announced ? prev.lastTickAt : this.now(), lastReadAt, deviceOnline, verdict, clockOffsetMs });
    this.touch(deviceId, touched);
  }

  private closeInto(deviceId: string, key: string, b: Bucket): void {
    for (const [id, e] of this.entries) {
      if (!id.startsWith(`${deviceId}|${key}|15|`)) continue;
      const [, , , from, to] = id.split("|");
      if (b.t >= Number(from) && b.t < Number(to)) e.buckets = upsertBucket(e.buckets, b);
    }
  }

  setOpen(deviceId: string, open: Record<string, Bucket>): void {
    let m = this.open.get(deviceId);
    if (!m) this.open.set(deviceId, (m = new Map()));
    for (const [k, b] of Object.entries(open)) {
      const prev = m.get(k);
      if (!prev || b.t >= prev.t) m.set(k, b);
    }
    this.touch(deviceId, Object.keys(open));
  }

  /** The time each device's newest live message says it was sent (not when it was received). */
  private readonly lastTickTs = new Map<string, number>();

  getStatus = (deviceId: string): DeviceLiveStatus => this.status.get(deviceId) ?? IDLE;

  setStatus(deviceId: string, status: LiveStatus): void {
    const cur = this.status.get(deviceId);
    if (cur?.status === status) return;
    this.status.set(deviceId, { ...(cur ?? IDLE), status });
    this.touch(deviceId);
  }

  // ------------------------------------------------------------ catch-up after a pause or reconnect

  /** Brings the connection state (agent heard from, device answering) up to date from the database. The live channel keeps
   *  it current while it is open; a tab that was hidden, or a channel that dropped, has missed those messages and would
   *  otherwise judge a healthy agent "silent". Never moves anything backwards. */
  async refreshHeartbeat(deviceId: string): Promise<void> {
    if (!this.deps.loadHeartbeat) return;
    const beat = await this.deps.loadHeartbeat(deviceId);
    if (!beat) return;
    const prev = this.status.get(deviceId) ?? IDLE;
    // The database row is newer than the last live message when it was written at or after that message's own time.
    const newer = beat.lastSeenMs !== null && beat.lastSeenMs >= (this.lastTickTs.get(deviceId) ?? 0);
    const takeVerdict = beat.verdict !== null && (!prev.verdict || beat.verdict.serverNowMs >= prev.verdict.serverNowMs);
    this.status.set(deviceId, {
      status: prev.status,
      verdict: takeVerdict ? beat.verdict : prev.verdict,
      clockOffsetMs: takeVerdict && beat.verdict ? beat.verdict.serverNowMs - this.now() : prev.clockOffsetMs,
      lastTickAt: beat.lastSeenMs !== null ? Math.max(prev.lastTickAt ?? 0, beat.lastSeenMs) : prev.lastTickAt,
      lastReadAt: beat.lastReadMs !== null ? Math.max(prev.lastReadAt ?? 0, beat.lastReadMs) : prev.lastReadAt,
      // The database row is the newest word unless a live message arrived after it.
      deviceOnline: newer && beat.deviceOnline !== null ? beat.deviceOnline : (prev.deviceOnline ?? beat.deviceOnline),
    });
    this.touch(deviceId, []);
  }

  /** After the live channel was closed (hidden tab, lost connection): refresh what is on screen, in parallel. */
  async catchUp(deviceId: string): Promise<void> {
    const keys = this.watchedKeys(deviceId);
    const tasks: Promise<unknown>[] = [];
    if (this.deps.loadLatest) tasks.push(this.deps.loadLatest(deviceId).then((v) => this.setLatest(deviceId, v)));
    if (this.deps.loadOpen && keys.length) tasks.push(this.deps.loadOpen(deviceId, keys).then((o) => this.setOpen(deviceId, o)));
    const range = todayRange(this.now());
    if (keys.length) tasks.push(this.ensureSeries(deviceId, keys, range, { force: true }));
    const results = await Promise.allSettled(tasks);       // one failing call must not hide the others
    const failed = results.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
    if (failed) throw failed.reason;
  }

  /** Forget everything held in memory (sign-out). */
  reset(): void {
    this.entries.clear();
    this.inflight.clear();
    this.latest.clear();
    this.open.clear();
    this.status.clear();
    this.lastTickTs.clear();
    this.rev.clear();
    this.watching.clear();
    this.listeners.forEach((fn) => fn());
  }
}

export { BUCKET_MS, binStart };
