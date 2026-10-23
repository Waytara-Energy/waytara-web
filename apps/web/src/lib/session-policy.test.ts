import { describe, expect, it } from "vitest";
import { DEFAULT_SESSION_POLICY, describePolicy, effectiveWarnSeconds, idleExpired, minutesText, parseSessionPolicy, policyActive, policyToJson, sessionExpired, warningSecondsLeft } from "./session-policy";

describe("parseSessionPolicy", () => {
  it("keeps a signed-in session alive by default", () => {
    expect(parseSessionPolicy(null)).toEqual(DEFAULT_SESSION_POLICY);
    expect(parseSessionPolicy({})).toEqual(DEFAULT_SESSION_POLICY);
  });
  it("accepts any whole number of idle minutes from 5 to 30 days, and the two scopes", () => {
    expect(parseSessionPolicy({ idle_minutes: 30, idle_scope: "all" })).toMatchObject({ idleMinutes: 30, scope: "all" });
    expect(parseSessionPolicy({ idle_minutes: 7 })).toMatchObject({ idleMinutes: 7 });
    expect(parseSessionPolicy({ idle_minutes: 4 }).idleMinutes).toBeNull();
    expect(parseSessionPolicy({ idle_minutes: 43_201 }).idleMinutes).toBeNull();
    expect(parseSessionPolicy({ idle_minutes: 12.5 }).idleMinutes).toBeNull();
    expect(parseSessionPolicy({ idle_minutes: "30" }).idleMinutes).toBeNull();
    expect(parseSessionPolicy({ idle_scope: "everything" }).scope).toBe("device");
  });
  it("accepts only the offered warning times", () => {
    expect(parseSessionPolicy({ warn_seconds: 60 }).warnSeconds).toBe(60);
    expect(parseSessionPolicy({ warn_seconds: 45 }).warnSeconds).toBe(0);
  });
  it("accepts a session limit of 1 hour to 90 days and a close-the-browser switch that is exactly true", () => {
    expect(parseSessionPolicy({ max_session_minutes: 480 }).maxSessionMinutes).toBe(480);
    expect(parseSessionPolicy({ max_session_minutes: 30 }).maxSessionMinutes).toBeNull();
    expect(parseSessionPolicy({ max_session_minutes: 999_999 }).maxSessionMinutes).toBeNull();
    expect(parseSessionPolicy({ sign_out_on_close: true }).signOutOnClose).toBe(true);
    expect(parseSessionPolicy({ sign_out_on_close: "yes" }).signOutOnClose).toBe(false);
  });
  it("round-trips", () => {
    const p = { idleMinutes: 60, scope: "all" as const, warnSeconds: 30, maxSessionMinutes: 1440, signOutOnClose: true };
    expect(parseSessionPolicy(policyToJson(p))).toEqual(p);
  });
  it("older stored values (only idle minutes and scope) still read", () => {
    expect(parseSessionPolicy({ idle_minutes: 15, idle_scope: "device" })).toEqual({ ...DEFAULT_SESSION_POLICY, idleMinutes: 15 });
  });
});

describe("policyActive", () => {
  it("is active when any of the three is set", () => {
    expect(policyActive(DEFAULT_SESSION_POLICY)).toBe(false);
    expect(policyActive({ ...DEFAULT_SESSION_POLICY, idleMinutes: 15 })).toBe(true);
    expect(policyActive({ ...DEFAULT_SESSION_POLICY, maxSessionMinutes: 480 })).toBe(true);
    expect(policyActive({ ...DEFAULT_SESSION_POLICY, signOutOnClose: true })).toBe(true);
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

describe("sessionExpired", () => {
  it("has no limit without a most time or a start", () => {
    expect(sessionExpired(0, 10 ** 12, null)).toBe(false);
    expect(sessionExpired(null, 10 ** 12, 480)).toBe(false);
  });
  it("expires at the most time", () => {
    expect(sessionExpired(0, 479 * 60_000, 480)).toBe(false);
    expect(sessionExpired(0, 480 * 60_000, 480)).toBe(true);
  });
});

describe("the warning before an idle sign-out", () => {
  const min = 60_000;
  it("is only shown inside the warning time", () => {
    expect(warningSecondsLeft(0, 13 * min, 15, 60)).toBeNull(); // 2 minutes left
    expect(warningSecondsLeft(0, 14 * min + 1000, 15, 60)).toBe(59);
    expect(warningSecondsLeft(0, 15 * min, 15, 60)).toBeNull(); // already expired: the sign-out takes over
  });
  it("is never shown without one set, an idle time, or a recorded activity", () => {
    expect(warningSecondsLeft(0, 14 * min, 15, 0)).toBeNull();
    expect(warningSecondsLeft(0, 14 * min, null, 60)).toBeNull();
    expect(warningSecondsLeft(null, 14 * min, 15, 60)).toBeNull();
  });
  it("is cut to half the idle time so it does not start at once", () => {
    expect(effectiveWarnSeconds(300, 5)).toBe(150);
    expect(effectiveWarnSeconds(60, 60)).toBe(60);
    expect(effectiveWarnSeconds(60, null)).toBe(0);
  });
});

describe("describing a policy", () => {
  it("says what happens, in words", () => {
    expect(minutesText(1440)).toBe("1 day");
    expect(minutesText(10_080)).toBe("7 days");
    expect(minutesText(120)).toBe("2 hours");
    expect(minutesText(90)).toBe("90 minutes");
    expect(describePolicy(DEFAULT_SESSION_POLICY)).toEqual(["You stay signed in until you sign out yourself."]);
    const lines = describePolicy({ idleMinutes: 15, scope: "all", warnSeconds: 60, maxSessionMinutes: 480, signOutOnClose: true });
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain("every device");
    expect(lines[0]).toContain("15 minutes");
  });
});
