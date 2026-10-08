import { describe, expect, it } from "vitest";
import { averageAtHours, dailySeries, dayCounterValues, maxOf, minOf, peakAt, periodEfficiency, sumOf } from "./performance-period";

const IST = 19_800_000;
const at = (day: string, hour: number) => new Date(`${day}T00:00:00Z`).getTime() - IST + hour * 3_600_000;

describe("max, min, sum", () => {
  it("skip missing readings", () => {
    expect(maxOf([null, 3, 9, null])).toBe(9);
    expect(minOf([null, 3, 9])).toBe(3);
    expect(maxOf([null, null])).toBeNull();
    expect(sumOf([1, null, 2.5])).toBe(3.5);
  });
  it("finds the peak and when it was", () => {
    expect(peakAt([10, 20, 30], [1, 5, 2])).toEqual({ v: 5, t: 20 });
    expect(peakAt([10, 20], [0, null])).toBeNull();
  });
});

describe("dailySeries", () => {
  it("drops days without a reading", () => {
    expect(dailySeries(["2026-10-06", "2026-10-07"], [5, null])).toEqual([{ date: "2026-10-06", value: 5 }]);
  });
  it("uses the live reading for today, even when the stored value is higher (a stale carry-over after midnight)", () => {
    expect(dailySeries(["2026-10-07", "2026-10-08"], [5, 3], 4, "2026-10-08")).toEqual([{ date: "2026-10-07", value: 5 }, { date: "2026-10-08", value: 4 }]);
    expect(dailySeries(["2026-10-08"], [32.2], 15.2, "2026-10-08")).toEqual([{ date: "2026-10-08", value: 15.2 }]);
    expect(dailySeries(["2026-10-08"], [null], 2, "2026-10-08")).toEqual([{ date: "2026-10-08", value: 2 }]);
    expect(dailySeries(["2026-10-07"], [5], 99, "2026-10-08")).toEqual([{ date: "2026-10-07", value: 5 }]);
  });
});

describe("averageAtHours", () => {
  it("averages the slots between two hours of the IST day across all days", () => {
    const axis = [at("2026-10-06", 1), at("2026-10-06", 2), at("2026-10-06", 3), at("2026-10-07", 2), at("2026-10-07", 5)];
    expect(averageAtHours(axis, [9, 100, 300, 200, 9], 2, 4)).toBe(200);
  });
  it("is null when no slot falls in those hours (a daily series)", () => {
    expect(averageAtHours([at("2026-10-06", 0), at("2026-10-07", 0)], [1, 2], 2, 4)).toBeNull();
  });
});

describe("periodEfficiency", () => {
  it("is AC out over DC in across the working slots, and ignores idle ones", () => {
    const r = periodEfficiency([1, 0.05, 2, null], [1.25, 0.05, 2.5, 3]);
    expect(r.pct).toBeCloseTo((3 / 3.75) * 100, 6);
    expect(r.perSlot).toEqual([80, null, 80, null]);
  });
  it("is null with nothing to compare", () => {
    expect(periodEfficiency([null], [null]).pct).toBeNull();
  });
});

describe("dayCounterValues", () => {
  it("takes the day's highest reading", () => {
    expect(dayCounterValues([{ max: 20, last: 20 }, { max: 30, last: 30 }])).toEqual([20, 30]);
  });
  it("uses the last reading when the highest is yesterday's total still showing after midnight (Waytara office, 8 Oct)", () => {
    // 7 Oct finished at 32.2; the counter still read 32.2 just after midnight on the 8th, then reset and reached 15.2
    expect(dayCounterValues([{ max: 32.2, last: 32.2 }, { max: 32.2, last: 15.2 }])).toEqual([32.2, 15.2]);
  });
  it("keeps the highest when the new day beat yesterday, or there is no earlier day", () => {
    expect(dayCounterValues([{ max: 20, last: 20 }, { max: 33, last: 33 }])).toEqual([20, 33]);
    expect(dayCounterValues([{ max: 32.2, last: 15.2 }])).toEqual([32.2]);
  });
  it("skips days without a reading", () => {
    expect(dayCounterValues([{ max: null, last: null }, { max: 5, last: 5 }])).toEqual([null, 5]);
  });
});
