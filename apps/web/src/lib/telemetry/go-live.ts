// Go Live: today's readings at the metrics' real cadence, straight from the agent's local files.
//
// The browser cannot reach the agent PC directly, so the conversation goes through a private Realtime channel
// `live:<device>` (see equipment_agent/live.py): this viewer announces which metrics it needs (presence), the agent
// uploads today's data for them to a private storage file and broadcasts `snapshot`, then streams one `tick` per
// poll. When the last viewer leaves, the agent stops and deletes the file. Nothing raw is written to a table.
//
// This module is the state machine only - every environmental piece (channel, download, timers) is injected, so the
// rules are tested without a browser.

export type GoLiveStatus = "off" | "connecting" | "waiting" | "loading" | "live" | "error";

export interface RawSeries {
  /** Epoch milliseconds, ascending. */
  t: number[];
  v: number[];
}

export interface SnapshotMeta {
  /** Empty when the agent had no history to send (nobody asked for it). */
  path: string;
  session: string;
  bucket: string;
  from_ms: number;
  to_ms: number;
  keys: string[];
  points: number;
}

export interface SnapshotFile {
  from_ms: number;
  to_ms: number;
  series: Record<string, [number, number][]>;
}

export interface TickMessage {
  t: number;
  v: Record<string, number>;
}

export interface GoLiveHandlers {
  onSnapshot(meta: SnapshotMeta): void;
  onTick(msg: TickMessage): void;
  onBye(): void;
  onStatus(s: "joined" | "dropped"): void;
}

export interface ChannelHandle {
  /** Tell the agent what this viewer needs. `history: false` = only the readings from now on (no download of today). */
  track(payload: { keys: string[]; viewer: string; history: boolean }): void;
  leave(): void;
}

export interface GoLiveEnv {
  join(deviceId: string, handlers: GoLiveHandlers): Promise<ChannelHandle>;
  download(meta: SnapshotMeta): Promise<SnapshotFile>;
  setTimer(fn: () => void, ms: number): unknown;
  clearTimer(handle: unknown): void;
  viewerId(): string;
}

export interface GoLiveState {
  status: GoLiveStatus;
  error: string | null;
  keys: string[];
  /** Per metric, today's readings so far. Replaced (not mutated) on every change. */
  series: ReadonlyMap<string, RawSeries>;
  /** Bumped on every change. */
  rev: number;
}

export const WAIT_FOR_AGENT_MS = 20_000;
export const MAX_POINTS_PER_SERIES = 100_000;
/** A viewer that only follows the latest readings keeps just a short tail of each series. */
const LIVE_ONLY_POINTS = 120;
const MAX_BUFFERED_TICKS = 5_000;

export class GoLiveSession {
  private state: GoLiveState = { status: "off", error: null, keys: [], series: new Map(), rev: 0 };
  private listeners = new Set<() => void>();
  private handle: ChannelHandle | null = null;
  private deviceId: string | null = null;
  private waitTimer: unknown = null;
  private snapshotTo = -Infinity;
  private buffered: TickMessage[] = [];
  private generation = 0;
  private history = true;

  constructor(private readonly env: GoLiveEnv) {}

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getState = (): GoLiveState => this.state;

  private set(patch: Partial<GoLiveState>): void {
    this.state = { ...this.state, ...patch, rev: this.state.rev + 1 };
    this.listeners.forEach((fn) => fn());
  }

  private armWait(): void {
    this.disarmWait();
    this.waitTimer = this.env.setTimer(() => {
      this.waitTimer = null;
      if (this.state.status === "waiting" || this.state.status === "connecting") {
        this.set({ status: "error", error: "The device didn't respond. Check that the equipment agent is running and online." });
        this.leave();
      }
    }, WAIT_FOR_AGENT_MS);
  }

  private disarmWait(): void {
    if (this.waitTimer) {
      this.env.clearTimer(this.waitTimer);
      this.waitTimer = null;
    }
  }

  private leave(): void {
    this.disarmWait();
    this.generation++;
    try {
      this.handle?.leave();
    } catch {
      /* already gone */
    }
    this.handle = null;
  }

  /** Begin (or restart) Go Live for these metrics. */
  async start(deviceId: string, keys: string[], opts: { history?: boolean } = {}): Promise<void> {
    if (this.state.status !== "off" && this.state.status !== "error") return;
    const gen = ++this.generation;
    this.history = opts.history ?? true;
    this.deviceId = deviceId;
    this.snapshotTo = -Infinity;
    this.buffered = [];
    this.set({ status: "connecting", error: null, keys: [...keys], series: new Map() });
    this.armWait();
    try {
      const handle = await this.env.join(deviceId, {
        onSnapshot: (meta) => void this.handleSnapshot(meta, gen),
        onTick: (msg) => this.handleTick(msg, gen),
        onBye: () => {
          if (gen !== this.generation || this.state.status === "off") return;
          // The agent ended the stream (no viewers in its eyes): ask again.
          this.set({ status: "waiting" });
          this.armWait();
          this.handle?.track({ keys: this.state.keys, viewer: this.env.viewerId(), history: this.history });
        },
        onStatus: (s) => {
          if (gen !== this.generation) return;
          if (s === "dropped" && this.state.status !== "off") {
            this.set({ status: "error", error: "The live connection was lost." });
            this.leave();
          }
        },
      });
      if (gen !== this.generation) {
        handle.leave();
        return;
      }
      this.handle = handle;
      handle.track({ keys, viewer: this.env.viewerId(), history: this.history });
      if ((this.state.status as GoLiveStatus) === "connecting") this.set({ status: "waiting" });
    } catch (e) {
      this.leave();
      this.set({ status: "error", error: e instanceof Error ? e.message : "Couldn't open the live connection." });
    }
  }

  /** The screens now need a different set of metrics: tell the agent (it publishes a new snapshot). */
  setKeys(keys: string[]): void {
    const same = keys.length === this.state.keys.length && keys.every((k) => this.state.keys.includes(k));
    if (same || this.state.status === "off" || this.state.status === "error") return;
    this.set({ keys: [...keys] });
    this.handle?.track({ keys, viewer: this.env.viewerId(), history: this.history });
  }

  /** Leave the channel; the agent stops streaming once no viewer is left. */
  stop(): void {
    this.leave();
    this.buffered = [];
    this.set({ status: "off", error: null, series: new Map() });
  }

  // ------------------------------------------------------------ messages

  private async handleSnapshot(meta: SnapshotMeta, gen: number): Promise<void> {
    if (gen !== this.generation) return;
    this.disarmWait();
    this.set({ status: "loading" });
    try {
      // No history wanted (or none sent): start from the readings that arrive from now on.
      const file: SnapshotFile =
        this.history && meta.path ? await this.env.download(meta) : { from_ms: meta.from_ms, to_ms: meta.to_ms, series: {} };
      if (gen !== this.generation) return;
      const series = new Map(this.state.series);
      for (const [key, pts] of Object.entries(file.series)) {
        series.set(key, { t: pts.map((p) => p[0]), v: pts.map((p) => p[1]) });
      }
      this.snapshotTo = file.to_ms;
      this.state = { ...this.state, series };
      // Ticks that arrived while the file was downloading: keep only the ones newer than what the file holds.
      const pending = this.buffered.filter((m) => m.t > this.snapshotTo);
      this.buffered = [];
      this.set({ status: "live", series: this.apply(pending) });
    } catch (e) {
      if (gen !== this.generation) return;
      this.leave();
      this.set({ status: "error", error: e instanceof Error ? e.message : "Couldn't load today's readings." });
    }
  }

  private handleTick(msg: TickMessage, gen: number): void {
    if (gen !== this.generation || this.state.status === "off" || this.state.status === "error") return;
    if (this.state.status !== "live") {
      if (this.buffered.length < MAX_BUFFERED_TICKS) this.buffered.push(msg);
      return;
    }
    if (msg.t <= this.snapshotTo) return; // already in the snapshot
    this.set({ series: this.apply([msg]) });
  }

  private apply(msgs: TickMessage[]): ReadonlyMap<string, RawSeries> {
    if (msgs.length === 0) return this.state.series;
    const next = new Map(this.state.series);
    for (const m of msgs) {
      for (const [key, value] of Object.entries(m.v)) {
        if (typeof value !== "number" || !Number.isFinite(value)) continue;
        const cur = next.get(key) ?? { t: [], v: [] };
        if (cur.t.length > 0 && m.t <= cur.t[cur.t.length - 1]) continue; // strictly increasing time
        const over = cur.t.length + 1 - (this.history ? MAX_POINTS_PER_SERIES : LIVE_ONLY_POINTS);
        next.set(key, {
          t: [...(over > 0 ? cur.t.slice(over) : cur.t), m.t],
          v: [...(over > 0 ? cur.v.slice(over) : cur.v), value],
        });
      }
    }
    return next;
  }
}

/** Reduce a long series to at most ~2 x `buckets` points, keeping each bucket's minimum and maximum so spikes survive. */
export function decimateMinMax(series: RawSeries, buckets: number): RawSeries {
  const n = series.t.length;
  if (n <= buckets * 2) return series;
  const t: number[] = [];
  const v: number[] = [];
  const per = n / buckets;
  for (let b = 0; b < buckets; b++) {
    const lo = Math.floor(b * per);
    const hi = Math.min(n, Math.floor((b + 1) * per));
    if (hi <= lo) continue;
    let minI = lo;
    let maxI = lo;
    for (let i = lo; i < hi; i++) {
      if (series.v[i] < series.v[minI]) minI = i;
      if (series.v[i] > series.v[maxI]) maxI = i;
    }
    const [a, c] = minI <= maxI ? [minI, maxI] : [maxI, minI];
    t.push(series.t[a]);
    v.push(series.v[a]);
    if (c !== a) {
      t.push(series.t[c]);
      v.push(series.v[c]);
    }
  }
  return { t, v };
}
