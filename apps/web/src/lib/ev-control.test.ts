import { describe, expect, it } from "vitest";
import { elapsedText, hubMessage, parseTarget, sessionKwh, startBody, stripKind } from "./ev-control";

describe("startBody", () => {
  it("asks for connector 1 with the WayTara tag, and a target only when it is a positive number", () => {
    expect(startBody(null)).toEqual({ connector_id: 1, id_tag: "WAYTARA" });
    expect(startBody(7.5)).toEqual({ connector_id: 1, id_tag: "WAYTARA", target_kwh: 7.5 });
    expect(startBody(0)).toEqual({ connector_id: 1, id_tag: "WAYTARA" });
    expect(startBody(5000).target_kwh).toBe(1000);
  });
});

describe("parseTarget", () => {
  it("treats empty as no target and refuses nonsense", () => {
    expect(parseTarget("")).toEqual({ ok: true, kwh: null });
    expect(parseTarget(" 12.5 ")).toEqual({ ok: true, kwh: 12.5 });
    expect(parseTarget("abc")).toEqual({ ok: false });
    expect(parseTarget("-3")).toEqual({ ok: false });
    expect(parseTarget("2000")).toEqual({ ok: false });
  });
});

describe("hubMessage", () => {
  it("says what happened in plain words", () => {
    expect(hubMessage(409, "The charger is not connected right now.")).toBe("The charger is not connected right now.");
    expect(hubMessage(409)).toBe("The charger is not connected right now.");
    expect(hubMessage(504)).toMatch(/did not answer/);
    expect(hubMessage(404)).toMatch(/not available/);
    expect(hubMessage(0)).toMatch(/Could not reach/);
    expect(hubMessage(500)).toMatch(/Something went wrong/);
  });
});

describe("elapsedText", () => {
  it("counts minutes, then hours and minutes", () => {
    const t = Date.parse("2026-10-23T10:00:00Z");
    expect(elapsedText(t, t + 20_000)).toBe("Just started");
    expect(elapsedText(t, t + 12 * 60_000)).toBe("12 min");
    expect(elapsedText(t, t + 65 * 60_000)).toBe("1 h 05 min");
    expect(elapsedText(t, t - 5_000)).toBe("Just started");
  });
});

describe("stripKind", () => {
  it("shows details for an open charge, start for a ready charger, and says when it cannot be started", () => {
    expect(stripKind({ open: true, connected: false })).toBe("details");
    expect(stripKind({ open: false, connected: true })).toBe("start");
    expect(stripKind({ open: false, connected: false })).toBe("offline");
    expect(stripKind({ open: false, connected: null })).toBe("unknown");
  });
});

describe("sessionKwh", () => {
  it("is the meter difference, never negative, and unknown when a meter is missing", () => {
    expect(sessionKwh(100, 103.25)).toBeCloseTo(3.25);
    expect(sessionKwh(100, 99)).toBe(0);
    expect(sessionKwh(null, 5)).toBeNull();
  });
});
