import { beforeEach, describe, expect, it, vi } from "vitest";
import { GoLiveSession, WAIT_FOR_AGENT_MS, decimateMinMax, type ChannelHandle, type GoLiveEnv, type GoLiveHandlers, type SnapshotFile, type SnapshotMeta } from "./go-live";

function setup(file: SnapshotFile = { from_ms: 0, to_ms: 1000, series: { p: [[100, 1], [1000, 2]] } }) {
  let downloads = 0;
  const tracked: { keys: string[]; viewer: string; history: boolean }[] = [];
  let handlers!: GoLiveHandlers;
  let left = 0;
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  let hold = false;
  const handle: ChannelHandle = { track: (p) => void tracked.push(p), leave: () => void left++ };
  const env: GoLiveEnv = {
    join: async (_id, h) => {
      handlers = h;
      return handle;
    },
    download: async () => {
      downloads++;
      if (hold) await gate;
      return file;
    },
    setTimer: (fn, ms) => setTimeout(fn, ms),
    clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
    viewerId: () => "viewer-1",
  };
  const session = new GoLiveSession(env);
  const meta: SnapshotMeta = { path: "d/s.json.gz", session: "s", bucket: "live-snapshots", from_ms: 0, to_ms: 1000, keys: ["p"], points: 2 };
  return { session, tracked, meta, downloads: () => downloads, handlers: () => handlers, left: () => left, holdDownload: () => (hold = true), release: () => release() };
}

const flush = () => vi.advanceTimersByTimeAsync(0);

describe("GoLiveSession", () => {
  beforeEach(() => { vi.useFakeTimers(); });

  it("joins, announces the metrics it needs, then shows today's data and appends live ticks", async () => {
    const t = setup();
    await t.session.start("d", ["p"]);
    expect(t.session.getState().status).toBe("waiting");
    expect(t.tracked[0]).toEqual({ keys: ["p"], viewer: "viewer-1", history: true });

    t.handlers().onSnapshot(t.meta);
    await flush();
    expect(t.session.getState().status).toBe("live");
    expect(t.session.getState().series.get("p")).toEqual({ t: [100, 1000], v: [1, 2] });

    t.handlers().onTick({ t: 2000, v: { p: 3, other: 9 } });
    expect(t.session.getState().series.get("p")).toEqual({ t: [100, 1000, 2000], v: [1, 2, 3] });
  });

  it("without history it asks for none, downloads nothing and just follows the readings from now on", async () => {
    const t = setup();
    await t.session.start("d", ["p"], { history: false });
    expect(t.tracked[0]).toEqual({ keys: ["p"], viewer: "viewer-1", history: false });
    t.handlers().onSnapshot({ ...t.meta, path: "" });
    await flush();
    expect(t.session.getState().status).toBe("live");
    expect(t.downloads()).toBe(0);
    expect(t.session.getState().series.size).toBe(0);
    t.handlers().onTick({ t: 2000, v: { p: 3 } });
    t.handlers().onTick({ t: 3000, v: { p: 4 } });
    expect(t.session.getState().series.get("p")).toEqual({ t: [2000, 3000], v: [3, 4] });
  });

  it("a viewer without history never downloads even if the agent did publish a file", async () => {
    const t = setup();
    await t.session.start("d", ["p"], { history: false });
    t.handlers().onSnapshot(t.meta); // has a path (another viewer wanted history)
    await flush();
    expect(t.downloads()).toBe(0);
    expect(t.session.getState().status).toBe("live");
  });

  it("ticks that arrive while the file downloads are kept only if newer than the file", async () => {
    const t = setup();
    t.holdDownload();
    await t.session.start("d", ["p"]);
    t.handlers().onSnapshot(t.meta);
    await flush();
    expect(t.session.getState().status).toBe("loading");
    t.handlers().onTick({ t: 900, v: { p: 7 } });     // already inside the snapshot (to_ms = 1000)
    t.handlers().onTick({ t: 1500, v: { p: 4 } });
    t.release();
    await flush();
    expect(t.session.getState().series.get("p")).toEqual({ t: [100, 1000, 1500], v: [1, 2, 4] });
  });

  it("gives up with a clear message if the agent never answers", async () => {
    const t = setup();
    await t.session.start("d", ["p"]);
    await vi.advanceTimersByTimeAsync(WAIT_FOR_AGENT_MS + 10);
    expect(t.session.getState().status).toBe("error");
    expect(t.session.getState().error).toMatch(/agent/i);
    expect(t.left()).toBe(1);                                  // and it left the channel
  });

  it("asking for more metrics re-announces; the new snapshot fills them in", async () => {
    const t = setup({ from_ms: 0, to_ms: 1000, series: { p: [[100, 1]], q: [[200, 5]] } });
    await t.session.start("d", ["p"]);
    t.handlers().onSnapshot(t.meta);
    await flush();
    t.session.setKeys(["p", "q"]);
    expect(t.tracked[t.tracked.length - 1].keys).toEqual(["p", "q"]);
    t.session.setKeys(["p", "q"]);                             // no change -> nothing sent
    expect(t.tracked).toHaveLength(2);
    t.handlers().onSnapshot({ ...t.meta, keys: ["p", "q"] });
    await flush();
    expect(t.session.getState().series.get("q")).toEqual({ t: [200], v: [5] });
  });

  it("stop leaves the channel and clears the data", async () => {
    const t = setup();
    await t.session.start("d", ["p"]);
    t.handlers().onSnapshot(t.meta);
    await flush();
    t.session.stop();
    expect(t.left()).toBe(1);
    expect(t.session.getState()).toMatchObject({ status: "off", error: null });
    expect(t.session.getState().series.size).toBe(0);
    t.handlers().onTick({ t: 5000, v: { p: 1 } });             // a late message changes nothing
    expect(t.session.getState().series.size).toBe(0);
  });

  it("a dropped connection is reported, not hidden", async () => {
    const t = setup();
    await t.session.start("d", ["p"]);
    t.handlers().onStatus("dropped");
    expect(t.session.getState().status).toBe("error");
  });

  it("a failed download is an error the viewer can retry", async () => {
    const t = setup();
    const broken = new GoLiveSession({ ...({} as GoLiveEnv), join: async (_i, h) => { void h; return { track() {}, leave() {} }; }, download: async () => { throw new Error("no file"); }, setTimer: (f, m) => setTimeout(f, m), clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>), viewerId: () => "v" });
    let h!: GoLiveHandlers;
    (broken as unknown as { env: GoLiveEnv }).env.join = async (_i, handlers) => { h = handlers; return { track() {}, leave() {} }; };
    await broken.start("d", ["p"]);
    h.onSnapshot(t.meta);
    await flush();
    expect(broken.getState()).toMatchObject({ status: "error", error: "no file" });
    await broken.start("d", ["p"]);                            // can start again after an error
    expect(broken.getState().status).toBe("waiting");
  });
});

describe("decimateMinMax", () => {
  it("leaves short series alone", () => {
    const s = { t: [1, 2, 3], v: [1, 2, 3] };
    expect(decimateMinMax(s, 10)).toBe(s);
  });

  it("keeps the spike of every bucket", () => {
    const n = 10_000;
    const t = Array.from({ length: n }, (_, i) => i);
    const v = t.map((i) => (i === 5000 ? 999 : 1));
    const d = decimateMinMax({ t, v }, 100);
    expect(d.t.length).toBeLessThanOrEqual(200);
    expect(Math.max(...d.v)).toBe(999);
    expect(d.t).toEqual([...d.t].sort((a, b) => a - b));       // still in time order
  });
});
