import { describe, expect, it } from "vitest";
import { DEFAULT_SESSION_POLICY, idleExpired, parseSessionPolicy, policyToJson } from "./session-policy";

describe("parseSessionPolicy", () => {
  it("keeps a signed-in session alive by default", () => {
    expect(parseSessionPolicy(null)).toEqual(DEFAULT_SESSION_POLICY);
    expect(parseSessionPolicy({})).toEqual({ idleMinutes: null, scope: "device" });
  });
  it("accepts the offered times and the two scopes, and nothing else", () => {
    expect(parseSessionPolicy({ idle_minutes: 30, idle_scope: "all" })).toEqual({ idleMinutes: 30, scope: "all" });
    expect(parseSessionPolicy({ idle_minutes: 7, idle_scope: "everything" })).toEqual({ idleMinutes: null, scope: "device" });
    expect(parseSessionPolicy({ idle_minutes: "30" })).toEqual({ idleMinutes: null, scope: "device" });
  });
  it("round-trips", () => {
    const p = { idleMinutes: 60, scope: "all" as const };
    expect(parseSessionPolicy(policyToJson(p))).toEqual(p);
  });
});

describe("idleExpired", () => {
  const min = 60_000;
  it("is never expired when the session is kept alive or nothing was recorded", () => {
    expect(idleExpired(0, 10 ** 12, null)).toBe(false);
    expect(idleExpired(null, 10 ** 12, 15)).toBe(false);
  });
  it("expires once the idle time has passed", () => {
    expect(idleExpired(1000, 1000 + 14 * min, 15)).toBe(false);
    expect(idleExpired(1000, 1000 + 15 * min, 15)).toBe(true);
    expect(idleExpired(1000, 1000 + 16 * min, 15)).toBe(true);
  });
});
