import { describe, expect, it } from "vitest";
import { describeEvent, eventWhere, isAccountEventKind, whenText } from "./account-events";

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
