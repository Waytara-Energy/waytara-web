import { describe, expect, it } from "vitest";
import { DAY_MS, isValidCustomStart, planRange, windowFor } from "./ranges";

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

  it("a custom window is 30 days from the chosen start, never past today", () => {
    const w = windowFor("custom", NOW, "2026-09-01");
    expect(w.toMs - w.fromMs).toBe(30 * DAY_MS);
    const recent = windowFor("custom", NOW, "2026-10-03");
    expect(recent.toMs).toBe(TODAY + DAY_MS);                 // clipped to the end of today
    expect(recent.fromMs).toBe(TODAY - 3 * DAY_MS);
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
