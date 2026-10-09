import { describe, expect, it } from "vitest";
import { computeDeviceState } from "./device-state";

const NOW = new Date("2026-10-07T08:30:00Z").getTime();
const ago = (min: number) => new Date(NOW - min * 60_000).toISOString();
const base = { lastTs: ago(1), agentSeenTs: ago(1), deviceOnline: true as boolean | null, intervalS: 900, heartbeatS: null as number | null };
const quiet = { lastTickAt: null, lastReadAt: null, deviceOnline: null };

describe("computeDeviceState", () => {
  it("is online while the agent and the device both report", () => {
    expect(computeDeviceState(base, quiet, NOW)).toEqual({ lastReadAt: ago(1), agentOnline: true, offline: false, status: "online" });
  });

  it("the agent running does not make a switched-off device look alive", () => {
    // the agent uploaded a minute ago but says the device stopped answering at 08:00
    const s = computeDeviceState({ ...base, lastTs: ago(30), deviceOnline: false }, quiet, NOW);
    expect(s.agentOnline).toBe(true);
    expect(s.offline).toBe(true);
    expect(s.lastReadAt).toBe(ago(30));      // "updated 30 min ago", not "1 min ago"
  });

  it("a live message saying the device is back (or gone) overrides what the page was rendered with", () => {
    const off = { ...base, deviceOnline: false };
    expect(computeDeviceState(off, { lastTickAt: NOW, lastReadAt: NOW, deviceOnline: true }, NOW).offline).toBe(false);
    expect(computeDeviceState(base, { lastTickAt: NOW, lastReadAt: null, deviceOnline: false }, NOW).offline).toBe(true);
  });

  it("is offline when the agent itself has gone quiet", () => {
    expect(computeDeviceState({ ...base, agentSeenTs: ago(120) }, quiet, NOW).offline).toBe(true);
    // ...until a live message arrives
    expect(computeDeviceState({ ...base, agentSeenTs: ago(120) }, { lastTickAt: NOW, lastReadAt: null, deviceOnline: null }, NOW).offline).toBe(false);
  });

  it("an agent that does not report connectivity is judged by the age of the last reading", () => {
    const old = { lastTs: ago(120), agentSeenTs: ago(1), deviceOnline: null, intervalS: 900, heartbeatS: null };
    expect(computeDeviceState(old, quiet, NOW).offline).toBe(true);
    expect(computeDeviceState({ ...old, lastTs: ago(10) }, quiet, NOW).offline).toBe(false);
  });

  it("a device that has never been heard from is offline", () => {
    expect(computeDeviceState({ lastTs: null, agentSeenTs: null, deviceOnline: null, intervalS: null, heartbeatS: null }, quiet, NOW).offline).toBe(true);
  });

  it("names what is wrong: the unit reachable but the device silent is 'connection lost', the unit silent is 'offline'", () => {
    expect(computeDeviceState({ ...base, deviceOnline: false }, quiet, NOW).status).toBe("connection_lost");
    expect(computeDeviceState({ ...base, agentSeenTs: ago(120) }, quiet, NOW).status).toBe("offline");
    expect(computeDeviceState(base, quiet, NOW).status).toBe("online");
  });

  it("a unit that checks in every minute is judged offline within minutes, not after three upload intervals", () => {
    const beating = { ...base, heartbeatS: 60 };
    expect(computeDeviceState({ ...beating, agentSeenTs: ago(2) }, quiet, NOW).status).toBe("online");
    expect(computeDeviceState({ ...beating, agentSeenTs: ago(5) }, quiet, NOW).status).toBe("offline");
    // the same silence is still fine for an older agent that only uploads every 15 minutes
    expect(computeDeviceState({ ...base, agentSeenTs: ago(5) }, quiet, NOW).status).toBe("online");
  });

  describe("with the server's verdict", () => {
    const verdict = (status: "online" | "device_unreachable" | "offline" | "never_seen", over: Partial<{ lastSeenMs: number | null; offlineAfterS: number; serverNowMs: number }> = {}) => ({
      status, reason: null, lastSeenMs: NOW - 5_000, offlineAfterS: 30, serverNowMs: NOW, ...over,
    });
    const init = (v: ReturnType<typeof verdict>) => ({ ...base, verdict: v });

    it("shows what the server says", () => {
      expect(computeDeviceState(init(verdict("online")), quiet, NOW).status).toBe("online");
      expect(computeDeviceState(init(verdict("device_unreachable")), quiet, NOW).status).toBe("connection_lost");
      expect(computeDeviceState(init(verdict("offline")), quiet, NOW).status).toBe("offline");
      expect(computeDeviceState(init(verdict("never_seen", { lastSeenMs: null })), quiet, NOW).status).toBe("offline");
    });

    it("goes offline by itself once the unit has been silent longer than the server's limit, if no newer word has come", () => {
      const v = init(verdict("online", { lastSeenMs: NOW - 5_000 }));
      expect(computeDeviceState(v, quiet, NOW).status).toBe("online");              // the page's first use fixes the clock offset
      expect(computeDeviceState(v, quiet, NOW + 20_000).status).toBe("online");     // 25 s of silence
      expect(computeDeviceState(v, quiet, NOW + 30_000).status).toBe("offline");    // 35 s
    });

    it("a live message from the unit keeps it online", () => {
      const v = init(verdict("online", { lastSeenMs: NOW - 5_000 }));
      expect(computeDeviceState(v, { lastTickAt: NOW + 55_000, lastReadAt: null, deviceOnline: null }, NOW + 60_000).status).toBe("online");
    });

    it("judges ages by the server's clock: a browser clock that is minutes fast does not make a healthy unit look silent", () => {
      const fast = 5 * 60_000;                                          // this browser runs 5 minutes ahead of the server
      const v = init(verdict("online", { lastSeenMs: NOW - 5_000, serverNowMs: NOW }));
      expect(computeDeviceState(v, quiet, NOW + fast).status).toBe("online");
      expect(computeDeviceState(v, quiet, NOW + fast + 40_000).status).toBe("offline");
    });

    it("the newest verdict wins, whether it came with the page or over the live channel", () => {
      const v = init(verdict("offline", { serverNowMs: NOW - 60_000 }));
      const live = { lastTickAt: null, lastReadAt: null, deviceOnline: null, verdict: verdict("online"), clockOffsetMs: 0 };
      expect(computeDeviceState(v, live, NOW).status).toBe("online");
    });
  });
});

