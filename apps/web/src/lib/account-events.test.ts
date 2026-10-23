import { describe, expect, it } from "vitest";
import { CLEARABLE_KINDS, RETENTION_CHOICES, describeEvent, eventWhere, isAccountEventKind, isClearable, parseActivityDays, whenText } from "./account-events";

describe("describeEvent", () => {
  it("names the known kinds and warns about the ones worth a look", () => {
    expect(describeEvent("signin")).toEqual({ title: "Signed in", tone: "info" });
    expect(describeEvent("password_changed").tone).toBe("warn");
    expect(describeEvent("mfa_enabled").tone).toBe("good");
  });
  it("copes with a kind it does not know", () => {
    expect(describeEvent("something_new")).toEqual({ title: "something new", tone: "info" });
    expect(isAccountEventKind("signin")).toBe(true);
    expect(isAccountEventKind("nope")).toBe(false);
  });
});

describe("eventWhere", () => {
  it("joins what is known", () => {
    expect(eventWhere({ device: "Chrome on Windows", place: "Chennai", ip: "1.2.3.4" })).toBe("Chrome on Windows · Chennai · 1.2.3.4");
    expect(eventWhere({ device: null, place: null, ip: "1.2.3.4" })).toBe("1.2.3.4");
    expect(eventWhere({ device: null, place: null, ip: null })).toBe("");
  });
});

describe("whenText", () => {
  const now = Date.parse("2026-10-23T12:00:00Z");
  it("says how long ago, then the day", () => {
    expect(whenText("2026-10-23T11:59:40Z", now)).toBe("just now");
    expect(whenText("2026-10-23T11:30:00Z", now)).toBe("30 min ago");
    expect(whenText("2026-10-23T07:00:00Z", now)).toBe("5 h ago");
    expect(whenText("2026-10-22T04:40:00Z", now)).toMatch(/^Yesterday, 10:10 am$/i);
    expect(whenText("2026-10-12T04:00:00Z", now)).toMatch(/^12 Oct, 9:30 am$/i);
  });
});

describe("how long activity is kept", () => {
  it("is 90 days unless the person chose one of the offered times", () => {
    expect(parseActivityDays(null)).toBe(90);
    expect(parseActivityDays({})).toBe(90);
    expect(parseActivityDays({ activity_days: 30 })).toBe(30);
    expect(parseActivityDays({ activity_days: 365 })).toBe(365);
    expect(parseActivityDays({ activity_days: 7 })).toBe(90);
    expect(parseActivityDays({ activity_days: "30" })).toBe(90);
    expect(RETENTION_CHOICES.map((c) => c.days)).toEqual([30, 90, 365]);
  });
});

describe("what clearing history removes", () => {
  it("is sign-ins and sign-outs only, never a password, e-mail or two-factor change", () => {
    expect(isClearable("signin")).toBe(true);
    expect(isClearable("signout_idle")).toBe(true);
    for (const k of ["password_changed", "email_changed", "mfa_enabled", "mfa_disabled", "unknown"]) expect(isClearable(k)).toBe(false);
    for (const k of CLEARABLE_KINDS) expect(isAccountEventKind(k)).toBe(true);
  });
});
