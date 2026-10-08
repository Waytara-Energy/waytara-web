import { beforeEach, describe, expect, it, vi } from "vitest";
import { DeviceLiveManager, HEARTBEAT_POLL_MS, HIDDEN_GRACE_MS, type LiveEnv } from "./live-manager";
import { TelemetryStore } from "./store";
import type { TickPayload } from "./types";

function makeEnv() {
  const state = { visible: true, online: true };
  const cbs = { visibility: [] as (() => void)[], pagehide: [] as (() => void)[], connectivity: [] as (() => void)[] };
  const opened: { deviceId: string; closed: boolean; onTick: (t: TickPayload) => void; onStatus: (s: "joined" | "dropped") => void }[] = [];
  const env: LiveEnv = {
    openChannel: async (deviceId, onTick, onStatus) => {
      const rec = { deviceId, closed: false, onTick, onStatus };
      opened.push(rec);
      return { close: () => { rec.closed = true; } };
    },
    isVisible: () => state.visible,
    isOnline: () => state.online,
    onVisibility: (cb) => { cbs.visibility.push(cb); return () => {}; },
    onPageHide: (cb) => { cbs.pagehide.push(cb); return () => {}; },
    onConnectivity: (cb) => { cbs.connectivity.push(cb); return () => {}; },
    setTimer: (fn, ms) => setTimeout(fn, ms),
    clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
  };
  return { env, state, cbs, opened };
}

function setup() {
  const e = makeEnv();
  const catchUp = vi.fn(async () => {});
  const store = new TelemetryStore({ fetchSeries: async () => new Map(), now: () => 0, schedule: (fn) => fn() });
  store.catchUp = catchUp;
  const refresh = vi.fn(async () => {});
  store.refreshHeartbeat = refresh;
  const manager = new DeviceLiveManager(e.env, store);
  return { ...e, store, manager, catchUp, refresh };
}

const flush = () => vi.advanceTimersByTimeAsync(0);

describe("DeviceLiveManager", () => {
  beforeEach(() => { vi.useFakeTimers(); });

  it("opens one channel per device however many components ask, and closes it with the last one", async () => {
    const { manager, opened, store } = setup();
    const r1 = manager.acquire("d");
    const r2 = manager.acquire("d");
    await flush();
    expect(opened).toHaveLength(1);
    r1();
    expect(opened[0].closed).toBe(false);
    r2();
    expect(opened[0].closed).toBe(true);
    expect(store.getStatus("d").status).toBe("idle");
  });

  it("closes 10 s after the tab is hidden, and reopens with a catch-up when it is visible again", async () => {
    const { manager, opened, state, cbs, store, catchUp } = setup();
    manager.acquire("d");
    await flush();
    state.visible = false;
    cbs.visibility.forEach((f) => f());
    await vi.advanceTimersByTimeAsync(HIDDEN_GRACE_MS - 1);
    expect(opened[0].closed).toBe(false);                       // still in the grace period
    await vi.advanceTimersByTimeAsync(2);
    expect(opened[0].closed).toBe(true);
    expect(store.getStatus("d").status).toBe("paused");
    expect(catchUp).not.toHaveBeenCalled();

    state.visible = true;
    cbs.visibility.forEach((f) => f());
    await flush();
    expect(opened).toHaveLength(2);
    expect(catchUp).toHaveBeenCalledWith("d");
  });

  it("a quick tab switch inside the grace period keeps the same channel", async () => {
    const { manager, opened, state, cbs, catchUp } = setup();
    manager.acquire("d");
    await flush();
    state.visible = false;
    cbs.visibility.forEach((f) => f());
    await vi.advanceTimersByTimeAsync(3000);
    state.visible = true;
    cbs.visibility.forEach((f) => f());
    await vi.advanceTimersByTimeAsync(HIDDEN_GRACE_MS * 2);
    expect(opened).toHaveLength(1);
    expect(opened[0].closed).toBe(false);
    expect(catchUp).not.toHaveBeenCalled();
  });

  it("closes immediately when the page is closed", async () => {
    const { manager, opened, cbs } = setup();
    manager.acquire("d");
    await flush();
    cbs.pagehide.forEach((f) => f());
    expect(opened[0].closed).toBe(true);
  });

  it("does not open while the tab is hidden, and goes offline/online with the browser", async () => {
    const { manager, opened, state, cbs, store, catchUp } = setup();
    state.visible = false;
    manager.acquire("d");
    await flush();
    expect(opened).toHaveLength(0);
    state.visible = true;
    cbs.visibility.forEach((f) => f());
    await flush();
    expect(opened).toHaveLength(1);

    state.online = false;
    cbs.connectivity.forEach((f) => f());
    expect(opened[0].closed).toBe(true);
    expect(store.getStatus("d").status).toBe("offline");
    state.online = true;
    cbs.connectivity.forEach((f) => f());
    await flush();
    expect(opened).toHaveLength(2);
    expect(catchUp).toHaveBeenCalledTimes(1);
  });

  it("retries with backoff when the channel drops by itself, then catches up", async () => {
    const { manager, opened, catchUp } = setup();
    manager.acquire("d");
    await flush();
    opened[0].onStatus("dropped");
    await vi.advanceTimersByTimeAsync(1999);
    expect(opened).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(2);
    expect(opened).toHaveLength(2);
    expect(catchUp).toHaveBeenCalledTimes(1);
    opened[1].onStatus("dropped");
    await vi.advanceTimersByTimeAsync(3999);
    expect(opened).toHaveLength(2);                              // second retry waits longer (4 s)
    await vi.advanceTimersByTimeAsync(2);
    expect(opened).toHaveLength(3);
  });

  it("ignores the close event of a channel it closed itself", async () => {
    const { manager, opened } = setup();
    const release = manager.acquire("d");
    await flush();
    release();
    opened[0].onStatus("dropped");
    await vi.advanceTimersByTimeAsync(120_000);
    expect(opened).toHaveLength(1);
  });

  it("feeds ticks into the store", async () => {
    const { manager, opened, store } = setup();
    manager.acquire("d");
    await flush();
    opened[0].onTick({ ts: new Date(1000).toISOString(), values: { p: 5 } });
    expect(store.getLatest("d", "p")?.value).toBe(5);
  });

  it("re-reads the connection state when a channel opens, and every minute while the screen is visible", async () => {
    const { manager, refresh, state } = setup();
    manager.acquire("d");
    await flush();
    expect(refresh).toHaveBeenCalledWith("d");
    const first = refresh.mock.calls.length;
    await vi.advanceTimersByTimeAsync(HEARTBEAT_POLL_MS);
    expect(refresh.mock.calls.length).toBeGreaterThan(first);
    // hidden: no polling
    state.visible = false;
    const before = refresh.mock.calls.length;
    await vi.advanceTimersByTimeAsync(HEARTBEAT_POLL_MS * 3);
    expect(refresh.mock.calls.length).toBe(before);
  });

  it("stops polling once the last screen lets go", async () => {
    const { manager, refresh } = setup();
    const release = manager.acquire("d");
    await flush();
    release();
    const before = refresh.mock.calls.length;
    await vi.advanceTimersByTimeAsync(HEARTBEAT_POLL_MS * 3);
    expect(refresh.mock.calls.length).toBe(before);
  });

  it("re-reads it when the tab comes back and the channel reopens", async () => {
    const { manager, refresh, state, cbs } = setup();
    manager.acquire("d");
    await flush();
    state.visible = false;
    cbs.visibility.forEach((f) => f());
    await vi.advanceTimersByTimeAsync(HIDDEN_GRACE_MS + 1);
    refresh.mockClear();
    state.visible = true;
    cbs.visibility.forEach((f) => f());
    await flush();
    expect(refresh).toHaveBeenCalledWith("d");
  });
});
