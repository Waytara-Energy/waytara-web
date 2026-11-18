import { describe, expect, it } from "vitest";
import type { DeviceState } from "./device-state";
import { SETTLE_GRACE_MS, applyShown, settleStatus, type SettleMemory } from "./device-state-settle";

const mem = (shown: SettleMemory["shown"], since: number | null = null): SettleMemory => ({ shown, since });

describe("settleStatus", () => {
  it("shows online at once, and never delays coming back", () => {
    expect(settleStatus("online", true, 0, mem("offline")).shown).toBe("online");
    expect(settleStatus("online", false, 0, mem("offline")).shown).toBe("online");
    expect(settleStatus("online", true, 0, mem("offline")).mem).toEqual({ shown: "online", since: null });
  });

  it("announces nothing inactive from a page that has not finished loading", () => {
    expect(settleStatus("offline", false, 0, mem("online")).shown).toBe("online");
    expect(settleStatus("offline", false, 0, mem(null)).shown).toBe("online");
    // what was last shown stays: a device that was inactive last time still reads inactive, not a flash of online
    expect(settleStatus("offline", false, 0, mem("offline")).shown).toBe("offline");
  });

  it("trusts the status when nothing was known before", () => {
    expect(settleStatus("offline", true, 5, mem(null))).toMatchObject({ shown: "offline", waitMs: null });
    expect(settleStatus("connection_lost", true, 5, mem(null)).shown).toBe("connection_lost");
  });

  it("holds a working device as online for the grace period, then shows it inactive", () => {
    const first = settleStatus("offline", true, 1000, mem("online"));
    expect(first).toMatchObject({ shown: "online", waitMs: SETTLE_GRACE_MS });
    expect(first.mem.since).toBe(1000);
    const mid = settleStatus("offline", true, 1000 + 8000, first.mem);
    expect(mid).toMatchObject({ shown: "online", waitMs: SETTLE_GRACE_MS - 8000 });
    const done = settleStatus("offline", true, 1000 + SETTLE_GRACE_MS, mid.mem);
    expect(done).toMatchObject({ shown: "offline", waitMs: null });
    expect(done.mem).toEqual({ shown: "offline", since: null });
  });

  it("forgets the wait when the device comes back inside the grace period", () => {
    const held = settleStatus("offline", true, 0, mem("online"));
    const back = settleStatus("online", true, 5000, held.mem);
    expect(back.mem).toEqual({ shown: "online", since: null });
    // a new outage starts a new wait
    expect(settleStatus("offline", true, 9000, back.mem).mem.since).toBe(9000);
  });

  it("follows offline <-> connection lost at once once it is shown as inactive", () => {
    expect(settleStatus("connection_lost", true, 0, mem("offline")).shown).toBe("connection_lost");
    expect(settleStatus("offline", true, 0, mem("connection_lost")).shown).toBe("offline");
  });
});

describe("applyShown", () => {
  const raw: DeviceState = { lastReadAt: "2026-11-18T01:00:00Z", agentOnline: false, offline: true, status: "offline" };
  it("leaves the state alone when the status is the same", () => {
    expect(applyShown(raw, "offline")).toBe(raw);
  });
  it("puts the shown status in, with the fields that follow it", () => {
    expect(applyShown(raw, "online")).toEqual({ lastReadAt: raw.lastReadAt, agentOnline: true, offline: false, status: "online" });
    expect(applyShown({ ...raw, status: "online", offline: false, agentOnline: true }, "connection_lost")).toMatchObject({ status: "connection_lost", offline: true, agentOnline: true });
  });
});
