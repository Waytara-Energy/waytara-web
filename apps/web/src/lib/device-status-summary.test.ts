import { describe, expect, it } from "vitest";
import { agoText, newestIso, worstStatus } from "./device-status-summary";

describe("worstStatus", () => {
  it("is the worst state in the group: offline, then connection lost, then online", () => {
    expect(worstStatus(["online", "online"])).toBe("online");
    expect(worstStatus(["online", "connection_lost"])).toBe("connection_lost");
    expect(worstStatus(["connection_lost", "offline", "online"])).toBe("offline");
    expect(worstStatus([])).toBe("online");
  });
});

describe("agoText", () => {
  it("writes how long ago in words", () => {
    expect(agoText(10_000)).toBe("just now");
    expect(agoText(5 * 60_000)).toBe("5m ago");
    expect(agoText((4 * 60 + 16) * 60_000)).toBe("4h 16m ago");
    expect(agoText((51 * 60) * 60_000)).toBe("2d 3h ago");
    expect(agoText(-5)).toBe("just now");
  });
});

describe("newestIso", () => {
  it("picks the latest time, ignoring missing ones", () => {
    expect(newestIso(["2026-10-08T10:00:00Z", null, "2026-10-08T12:00:00Z"])).toBe("2026-10-08T12:00:00Z");
    expect(newestIso([null])).toBeNull();
    expect(newestIso([])).toBeNull();
  });
});
