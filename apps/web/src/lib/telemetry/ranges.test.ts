import { describe, expect, it } from "vitest";
import { DAY_MS, isValidCustomStart, normalizeRange, planRange, rangeLabel, windowFor } from "./ranges";

const TODAY = Date.parse("2026-10-05T18:30:00Z");       // 2026-10-06 00:00 IST
const NOW = TODAY + 10 * 3600_000;

describe("windowFor", () => {
  it("builds IST day windows for the presets", () => {
    expect(windowFor("today", NOW)).toEqual({ fromMs: TODAY, toMs: TODAY + DAY_MS });
    expect(windowFor("7d", NOW)).toEqual({ fromMs: TODAY - 6 * DAY_MS, toMs: TODAY + DAY_MS });
    expect(windowFor("30d", NOW).fromMs).toBe(TODAY - 29 * DAY_MS);
    expect(windowFor("90d", NOW).fromMs).toBe(TODAY - 89 * DAY_MS);
    expect(windowFor("1y", NOW)).toEqual({ fromMs: TODAY - 364 * DAY_MS, toMs: TODAY + DAY_MS });
    expect(windowFor("2y", NOW)).toEqual({ fromMs: TODAY - 729 * DAY_MS, toMs: TODAY + DAY_MS });
  });

  it("a custom window saved without an end day keeps its old length: 30 days from the start, never past today", () => {
    const w = windowFor("custom", NOW, "2026-09-01");
    expect(w.toMs - w.fromMs).toBe(30 * DAY_MS);
    const recent = windowFor("custom", NOW, "2026-10-03");
    expect(recent.toMs).toBe(TODAY + DAY_MS);                 // clipped to the end of today
    expect(recent.fromMs).toBe(TODAY - 3 * DAY_MS);
  });

  it("a custom window runs from the first day to the end of the last day chosen", () => {
    const w = windowFor("custom", NOW, "2026-09-10", "2026-09-20");
    expect(w.toMs - w.fromMs).toBe(11 * DAY_MS);              // both days included
    const one = windowFor("custom", NOW, "2026-09-10", "2026-09-10");
    expect(one.toMs - one.fromMs).toBe(DAY_MS);               // a single day
  });

  it("a custom window can be up to 90 days, and no more", () => {
    const ninety = windowFor("custom", NOW, "2026-07-01", "2026-09-28");
    expect(ninety.toMs - ninety.fromMs).toBe(90 * DAY_MS);
    const tooLong = windowFor("custom", NOW, "2026-06-01", "2026-10-01");
    expect(tooLong.toMs - tooLong.fromMs).toBe(90 * DAY_MS);  // cut back to 90
  });

  it("a custom window never ends after today and never ends before it starts", () => {
    expect(windowFor("custom", NOW, "2026-10-01", "2026-12-31").toMs).toBe(TODAY + DAY_MS);
    const back = windowFor("custom", NOW, "2026-10-01", "2026-09-20");
    expect(back.toMs - back.fromMs).toBe(DAY_MS);
  });
});

describe("rangeLabel", () => {
  it("says a day, a range within a month, across months and across years", () => {
    expect(rangeLabel("2026-10-09", "2026-10-09")).toBe("9 Oct 2026");
    expect(rangeLabel("2026-10-09", "2026-10-20")).toBe("9 - 20 Oct 2026");
    expect(rangeLabel("2026-09-28", "2026-10-03")).toMatch(/^28 Sept? - 3 Oct 2026$/);
    expect(rangeLabel("2025-12-30", "2026-01-03")).toBe("30 Dec 2025 - 3 Jan 2026");
  });
});

describe("normalizeRange", () => {
  const today = "2026-10-06";
  it("puts the earlier day first, whichever was tapped first", () => {
    expect(normalizeRange("2026-09-20", "2026-09-10", today, null)).toEqual({ start: "2026-09-10", end: "2026-09-20" });
  });
  it("keeps it between the first reading and today", () => {
    expect(normalizeRange("2026-08-01", "2026-12-01", today, "2026-09-01")).toEqual({ start: "2026-09-01", end: "2026-10-06" });
  });
  it("allows 90 days and pulls a longer range back to 90", () => {
    expect(normalizeRange("2026-07-01", "2026-09-28", today, null)).toEqual({ start: "2026-07-01", end: "2026-09-28" });
    expect(normalizeRange("2026-06-01", "2026-10-01", today, null)).toEqual({ start: "2026-06-01", end: "2026-08-29" });
  });
  it("takes a smaller limit when a page has one (the cadence files: 7 days)", () => {
    expect(normalizeRange("2026-10-01", "2026-10-06", today, null, 7)).toEqual({ start: "2026-10-01", end: "2026-10-06" });
    expect(normalizeRange("2026-09-20", "2026-10-06", today, null, 7)).toEqual({ start: "2026-09-20", end: "2026-09-26" });
  });
  it("one day tapped twice is that one day", () => {
    expect(normalizeRange("2026-09-10", "2026-09-10", today, null)).toEqual({ start: "2026-09-10", end: "2026-09-10" });
  });
});

describe("planRange", () => {
  it("today: 15 minutes by default, all four intervals", () => {
    const p = planRange(windowFor("today", NOW), NOW);
    expect(p).toEqual({ base: 15, options: [15, 30, 60, 120], default: 15 });
  });

  it("7 days: fetches 15 minutes, defaults to 1 hour (168 points), offers the coarser views", () => {
    const p = planRange(windowFor("7d", NOW), NOW);
    expect(p.base).toBe(15);
    expect(p.default).toBe(60);
    expect(p.options).toEqual([15, 30, 60, 120, 1440]);
  });

  it("30 days: hourly base, 2 hours by default, 1 day available; no 15/30 minutes", () => {
    const p = planRange(windowFor("30d", NOW), NOW);
    expect(p).toEqual({ base: 60, options: [60, 120, 1440], default: 120 });
  });

  it("90 days: daily only", () => {
    expect(planRange(windowFor("90d", NOW), NOW)).toEqual({ base: 1440, options: [1440], default: 1440 });
  });

  it("a custom window older than the fine retention can't go below 1 hour", () => {
    const p = planRange(windowFor("custom", NOW, "2026-08-01"), NOW);
    expect(p.options.includes(15)).toBe(false);
    expect(p.options.includes(30)).toBe(false);
    expect(p.base).toBe(60);
  });

  it("never plans more than 750 points per metric", () => {
    for (const preset of ["today", "7d", "30d", "90d", "1y", "2y"] as const) {
      const w = windowFor(preset, NOW);
      const p = planRange(w, NOW);
      for (const i of p.options) expect((w.toMs - w.fromMs) / 60_000 / i).toBeLessThanOrEqual(750);
    }
  });
});

describe("isValidCustomStart", () => {
  it("must be a real day, not before the first reading, not in the future", () => {
    expect(isValidCustomStart("2026-10-05", "2026-10-05", "2026-10-06")).toBe(true);
    expect(isValidCustomStart("2026-10-04", "2026-10-05", "2026-10-06")).toBe(false);
    expect(isValidCustomStart("2026-10-07", "2026-10-05", "2026-10-06")).toBe(false);
    expect(isValidCustomStart("nope", null, "2026-10-06")).toBe(false);
    expect(isValidCustomStart("2026-10-04", null, "2026-10-06")).toBe(true);
  });
});
