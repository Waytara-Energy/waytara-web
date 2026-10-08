import { describe, expect, it, vi } from "vitest";
import { PersistentCache, memoryKV } from "./cache";
import { TelemetryStore, todayRange, type SeriesFetcher } from "./store";
import type { Bucket } from "./types";

const DAY = Date.parse("2026-10-05T18:30:00Z");       // 2026-10-06 00:00 IST
const NOW = DAY + 10 * 3600_000;                      // 10:00 IST
const Q = 900_000;
const range = todayRange(NOW);

const bucket = (i: number, avg: number): Bucket => ({ t: DAY + i * Q, wsum: avg * 900, covered: 900, min: avg, max: avg, last: avg, pw: avg * 900, nw: 0, n: 90 });

function setup(opts: { cache?: PersistentCache; fetch?: SeriesFetcher } = {}) {
  const calls: { keys: string[] }[] = [];
  const fetch: SeriesFetcher =
    opts.fetch ??
    (async (req) => {
      calls.push({ keys: [...req.keys] });
      return new Map(req.keys.map((k) => [k, [bucket(0, 10), bucket(1, 20)]]));
    });
  const store = new TelemetryStore({ fetchSeries: fetch, cache: opts.cache, now: () => NOW, schedule: (fn) => fn() });
  return { store, calls };
}

describe("ensureSeries", () => {
  it("fetches every missing key in ONE request and shares in-flight work", async () => {
    const { store, calls } = setup();
    await Promise.all([store.ensureSeries("d", ["a", "b"], range), store.ensureSeries("d", ["b", "c"], range)]);
    expect(calls.map((c) => c.keys).sort()).toEqual([["a", "b"], ["c"]]);
    expect(store.getBuckets("d", "b", range)).toHaveLength(2);
  });

  it("does not ask again for what it already holds", async () => {
    const { store, calls } = setup();
    await store.ensureSeries("d", ["a"], range);
    await store.ensureSeries("d", ["a"], range);
    expect(calls).toHaveLength(1);
    await store.ensureSeries("d", ["a"], range, { force: true });
    expect(calls).toHaveLength(2);
  });

  it("a failed fetch rejects and is retried by the next call", async () => {
    let fail = true;
    const { store } = setup({ fetch: async (req) => { if (fail) throw new Error("boom"); return new Map(req.keys.map((k) => [k, [bucket(0, 1)]])); } });
    await expect(store.ensureSeries("d", ["a"], range)).rejects.toThrow("boom");
    expect(store.getBuckets("d", "a", range)).toBeUndefined();
    fail = false;
    await store.ensureSeries("d", ["a"], range);
    expect(store.getBuckets("d", "a", range)).toHaveLength(1);
  });

  it("serves the browser cache at once, then revalidates", async () => {
    const cache = new PersistentCache(memoryKV(), "u", () => NOW - 60_000);
    await cache.save(`d|a|${range.minutes}|${range.fromMs}|${range.toMs}`, [bucket(0, 5)]);
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const { store } = setup({ cache, fetch: async (req) => { await gate; return new Map(req.keys.map((k) => [k, [bucket(0, 5), bucket(1, 6)]])); } });
    const p = store.ensureSeries("d", ["a"], range);
    await vi.waitFor(() => expect(store.getBuckets("d", "a", range)).toHaveLength(1));   // painted from the cache
    expect(store.isStale("d", "a", range)).toBe(true);
    release();
    await p;
    expect(store.getBuckets("d", "a", range)).toHaveLength(2);
    expect(store.isStale("d", "a", range)).toBe(false);
  });

  it("an old, final range served from the cache is not refetched", async () => {
    const old = { fromMs: DAY - 86_400_000, toMs: DAY, minutes: 15 };
    const cache = new PersistentCache(memoryKV(), "u", () => DAY + 3600_000);       // saved after the range ended
    await cache.save(`d|a|15|${old.fromMs}|${old.toMs}`, [bucket(-96, 5)]);
    const { store, calls } = setup({ cache });
    await store.ensureSeries("d", ["a"], old);
    expect(calls).toHaveLength(0);
    expect(store.getBuckets("d", "a", old)).toHaveLength(1);
  });
});

describe("live ticks", () => {
  const tick = (ts: string, values: Record<string, number | { v: number; u?: string }>, open?: Record<string, { b: string; w: number; c: number }>) => ({ ts, values, open });

  it("updates the latest values, keeps the unit, and ignores a stale tick", () => {
    const { store } = setup();
    store.applyTick("d", tick("2026-10-06T04:30:00Z", { p: { v: 3000, u: "W" } }));
    expect(store.getLatest("d", "p")).toMatchObject({ value: 3000, unit: "W" });
    store.applyTick("d", tick("2026-10-06T04:31:00Z", { p: 3100 }));
    expect(store.getLatest("d", "p")).toMatchObject({ value: 3100, unit: "W" });
    store.applyTick("d", tick("2026-10-06T04:29:00Z", { p: 1 }));
    expect(store.getLatest("d", "p")?.value).toBe(3100);
    expect(store.getStatus("d").status).toBe("live");
  });

  it("remembers whether the device is answering and when it last did, from the agent's own report", () => {
    const { store } = setup();
    // values arrive: the device was just read
    store.applyTick("d", tick("2026-10-06T04:30:00Z", { p: 1 }));
    expect(store.getStatus("d")).toMatchObject({ deviceOnline: true, lastReadAt: Date.parse("2026-10-06T04:30:00Z") });
    // the device goes off: the agent still uploads, with no values and the time of the last real reading
    store.applyTick("d", { ts: "2026-10-06T04:45:00Z", values: {}, agent: { device_online: false, last_read_at: "2026-10-06T04:30:00Z" } });
    expect(store.getStatus("d")).toMatchObject({ deviceOnline: false, lastReadAt: Date.parse("2026-10-06T04:30:00Z") });
    expect(store.getStatus("d").lastTickAt).not.toBeNull();          // but the agent itself was heard from
    // back again
    store.applyTick("d", { ts: "2026-10-06T05:00:00Z", values: { p: 2 }, agent: { device_online: true, last_read_at: "2026-10-06T05:00:00Z" } });
    expect(store.getStatus("d")).toMatchObject({ deviceOnline: true, lastReadAt: Date.parse("2026-10-06T05:00:00Z") });
  });

  it("an older last_read_at never moves the last reading back", () => {
    const { store } = setup();
    store.applyTick("d", { ts: "2026-10-06T05:00:00Z", values: {}, agent: { device_online: true, last_read_at: "2026-10-06T05:00:00Z" } });
    store.applyTick("d", { ts: "2026-10-06T05:01:00Z", values: {}, agent: { device_online: true, last_read_at: "2026-10-06T04:00:00Z" } });
    expect(store.getStatus("d").lastReadAt).toBe(Date.parse("2026-10-06T05:00:00Z"));
  });

  it("merges the open bucket into today's chart and closes it when the next one starts", async () => {
    const { store } = setup();
    await store.ensureSeries("d", ["p"], range);
    const b = (i: number) => new Date(DAY + i * Q).toISOString();
    store.applyTick("d", tick("2026-10-06T04:30:00Z", {}, { p: { b: b(2), w: 3000, c: 300 } }));
    let buckets = store.getBuckets("d", "p", range)!;
    expect(buckets.map((x) => x.t)).toEqual([DAY, DAY + Q, DAY + 2 * Q]);
    expect(buckets[2].wsum).toBe(3000);
    store.applyTick("d", tick("2026-10-06T04:31:00Z", {}, { p: { b: b(2), w: 6000, c: 600 } }));
    expect(store.getBuckets("d", "p", range)![2].wsum).toBe(6000);                     // replaced, not duplicated
    store.applyTick("d", tick("2026-10-06T04:45:30Z", {}, { p: { b: b(3), w: 100, c: 10 } }));
    buckets = store.getBuckets("d", "p", range)!;
    expect(buckets.map((x) => x.t)).toEqual([DAY, DAY + Q, DAY + 2 * Q, DAY + 3 * Q]);
    expect(buckets[2].wsum).toBe(6000);                                                 // bucket 2 was kept as finished
  });

  it("batches notifications: many ticks, one listener call per flush", () => {
    const pending: (() => void)[] = [];
    const store = new TelemetryStore({ fetchSeries: async () => new Map(), now: () => NOW, schedule: (fn) => void pending.push(fn) });
    const all = vi.fn();
    const one = vi.fn();
    store.subscribe(all);
    store.subscribeKey("d", "p", one);
    for (let i = 0; i < 10; i++) store.applyTick("d", { ts: new Date(NOW + i * 1000).toISOString(), values: { p: i, q: i } });
    expect(all).not.toHaveBeenCalled();
    pending.forEach((f) => f());
    expect(all).toHaveBeenCalledTimes(1);
    expect(one).toHaveBeenCalledTimes(1);
  });
});

describe("catch-up and reset", () => {
  it("refreshes the watched keys, latest and open bucket in parallel; one failure does not hide the rest", async () => {
    const calls: string[] = [];
    const store = new TelemetryStore({
      fetchSeries: async (req) => { calls.push(`series:${req.keys.join(",")}`); return new Map(req.keys.map((k) => [k, [bucket(0, 1)]])); },
      loadLatest: async () => { calls.push("latest"); throw new Error("latest failed"); },
      loadOpen: async () => { calls.push("open"); return { p: bucket(3, 9) }; },
      now: () => NOW, schedule: (fn) => fn(),
    });
    const release = store.watch("d", ["p"]);
    await expect(store.catchUp("d")).rejects.toThrow("latest failed");
    expect(calls.sort()).toEqual(["latest", "open", "series:p"]);                        // all three ran despite the failure
    expect(store.getBuckets("d", "p", todayRange(NOW))!.some((b) => b.t === DAY + 3 * Q)).toBe(true);
    release();
    expect(store.watchedKeys("d")).toEqual([]);
  });

  it("reset forgets everything", async () => {
    const { store } = setup();
    await store.ensureSeries("d", ["a"], range);
    store.applyTick("d", { ts: new Date(NOW).toISOString(), values: { a: 1 } });
    store.reset();
    expect(store.getBuckets("d", "a", range)).toBeUndefined();
    expect(store.getLatest("d", "a")).toBeUndefined();
  });
});

describe("refreshHeartbeat", () => {
  const beat = (over: Partial<{ lastSeenMs: number | null; lastReadMs: number | null; deviceOnline: boolean | null }> = {}) => ({ lastSeenMs: NOW - 20_000, lastReadMs: NOW - 25_000, deviceOnline: true, ...over });
  const make = (load: () => Promise<ReturnType<typeof beat> | null>) =>
    new TelemetryStore({ fetchSeries: async () => new Map(), loadHeartbeat: load, now: () => NOW, schedule: (fn) => fn() });

  it("tells a tab that missed the live messages that the agent is alive and the device answering", async () => {
    const store = make(async () => beat());
    await store.refreshHeartbeat("d");
    expect(store.getStatus("d")).toMatchObject({ lastTickAt: NOW - 20_000, lastReadAt: NOW - 25_000, deviceOnline: true });
  });

  it("brings an offline verdict back to online when the database says the device answers again", async () => {
    const store = make(async () => beat({ deviceOnline: true }));
    store.applyTick("d", { ts: new Date(NOW - 3_600_000).toISOString(), values: {}, open: {}, agent: { device_online: false, last_read_at: new Date(NOW - 3_700_000).toISOString() } });
    expect(store.getStatus("d").deviceOnline).toBe(false);
    await store.refreshHeartbeat("d");
    expect(store.getStatus("d").deviceOnline).toBe(true);
  });

  it("never moves anything backwards: a live message newer than the database row wins", async () => {
    const store = make(async () => beat({ lastSeenMs: NOW - 120_000, lastReadMs: NOW - 130_000, deviceOnline: false }));
    store.applyTick("d", { ts: new Date(NOW).toISOString(), values: { p: 1 }, open: {}, agent: { device_online: true, last_read_at: new Date(NOW).toISOString() } });
    await store.refreshHeartbeat("d");
    expect(store.getStatus("d").deviceOnline).toBe(true);
    expect(store.getStatus("d").lastReadAt).toBe(NOW);
  });

  it("does nothing without a loader or a heartbeat row", async () => {
    const none = make(async () => null);
    await none.refreshHeartbeat("d");
    expect(none.getStatus("d").lastTickAt).toBeNull();
    const bare = new TelemetryStore({ fetchSeries: async () => new Map(), now: () => NOW, schedule: (fn) => fn() });
    await expect(bare.refreshHeartbeat("d")).resolves.toBeUndefined();
  });
});
