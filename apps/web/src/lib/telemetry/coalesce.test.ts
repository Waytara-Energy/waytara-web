import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { coalesce } from "./coalesce";
import { loadHeartbeat, loadHeartbeats } from "./loaders";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("coalesce", () => {
  it("sends one call for asks made together and gives each asker its own answer", async () => {
    const load = vi.fn(async (keys: string[]) => new Map(keys.map((k) => [k, k.toUpperCase()])));
    const ask = coalesce(load, "none");
    const results = Promise.all([ask("a"), ask("b"), ask("c")]);
    await vi.advanceTimersByTimeAsync(30);
    expect(await results).toEqual(["A", "B", "C"]);
    expect(load).toHaveBeenCalledTimes(1);
    expect(load.mock.calls[0][0].sort()).toEqual(["a", "b", "c"]);
  });

  it("asks for a key once even when several ask for it, and answers them all", async () => {
    const load = vi.fn(async (keys: string[]) => new Map(keys.map((k) => [k, 1])));
    const ask = coalesce(load, 0);
    const results = Promise.all([ask("a"), ask("a")]);
    await vi.advanceTimersByTimeAsync(30);
    expect(await results).toEqual([1, 1]);
    expect(load.mock.calls[0][0]).toEqual(["a"]);
  });

  it("makes a second call for asks that come after the first round", async () => {
    const load = vi.fn(async (keys: string[]) => new Map(keys.map((k) => [k, k])));
    const ask = coalesce(load, "none");
    const first = ask("a");
    await vi.advanceTimersByTimeAsync(30);
    await first;
    const second = ask("b");
    await vi.advanceTimersByTimeAsync(30);
    await second;
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("gives the stand-in answer for a key the call had nothing for", async () => {
    const ask = coalesce(async () => new Map<string, number>(), -1);
    const result = ask("x");
    await vi.advanceTimersByTimeAsync(30);
    expect(await result).toBe(-1);
  });

  it("fails every asker of the round when the call fails", async () => {
    const ask = coalesce(async () => {
      throw new Error("database down");
    }, null);
    const results = Promise.allSettled([ask("a"), ask("b")]);
    await vi.advanceTimersByTimeAsync(30);
    const settled = await results;
    expect(settled.map((r) => r.status)).toEqual(["rejected", "rejected"]);
  });
});

/** A stand-in for the browser's database client that records how it was asked. */
function fakeClient(rows: Record<string, unknown>[], error: { message: string } | null = null) {
  const calls: { table: string; select: string; column: string; values: string[] }[] = [];
  const sb = {
    from: (table: string) => ({
      select: (select: string) => ({
        in: async (column: string, values: string[]) => {
          calls.push({ table, select, column, values });
          return { data: rows, error };
        },
      }),
    }),
  };
  return { sb: sb as unknown as Parameters<typeof loadHeartbeats>[0], calls };
}

const row = (id: string, status = "online") => ({
  equipment_id: id,
  status,
  status_reason: null,
  last_seen: "2026-11-10T06:00:00Z",
  last_read_at: "2026-11-10T06:00:01Z",
  device_online: true,
  offline_after_s: 180,
  server_now: "2026-11-10T06:00:05Z",
});

describe("loadHeartbeats", () => {
  it("asks the database once for all the devices, and answers each", async () => {
    const { sb, calls } = fakeClient([row("d1"), row("d2", "offline")]);
    const out = await loadHeartbeats(sb, ["d1", "d2", "d3", "d1"]);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ table: "equipment_status", column: "equipment_id", values: ["d1", "d2", "d3"] });
    expect(out.get("d1")?.verdict?.status).toBe("online");
    expect(out.get("d2")?.verdict?.status).toBe("offline");
    expect(out.get("d3")).toBeNull();
  });

  it("asks nothing for no devices", async () => {
    const { sb, calls } = fakeClient([]);
    expect((await loadHeartbeats(sb, [])).size).toBe(0);
    expect(calls).toHaveLength(0);
  });

  it("throws the database's message when it fails", async () => {
    const { sb } = fakeClient([], { message: "permission denied" });
    await expect(loadHeartbeats(sb, ["d1"])).rejects.toThrow("permission denied");
  });

  it("keeps loadHeartbeat for one device working as before", async () => {
    const { sb } = fakeClient([row("d1")]);
    const beat = await loadHeartbeat(sb, "d1");
    expect(beat?.deviceOnline).toBe(true);
    expect(beat?.verdict?.offlineAfterS).toBe(180);
  });
});
