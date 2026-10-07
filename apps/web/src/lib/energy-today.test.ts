import { describe, expect, it } from "vitest";
import { areaPoints, axisTicks, deltaPct, fmtDelta, fmtKwh, peakOf, slotIndex, SLOT_MS } from "./energy-today";

describe("fmtKwh", () => {
  it("one decimal, none for large values, a dash for nothing", () => {
    expect(fmtKwh(12.34)).toBe("12.3 kWh");
    expect(fmtKwh(0)).toBe("0.0 kWh");
    expect(fmtKwh(123.4)).toBe("123 kWh");
    expect(fmtKwh(null)).toBe("—");
  });
});

describe("deltaPct", () => {
  it("compares today so far with yesterday at the same time", () => {
    expect(deltaPct(12, 10)).toBeCloseTo(20, 5);
    expect(deltaPct(5, 10)).toBeCloseTo(-50, 5);
    expect(fmtDelta(20.4)).toBe("↑ 20%");
    expect(fmtDelta(-49.6)).toBe("↓ 50%");
  });

  it("has nothing to say without a usable yesterday", () => {
    expect(deltaPct(5, null)).toBeNull();
    expect(deltaPct(5, 0)).toBeNull();
    expect(deltaPct(null, 5)).toBeNull();
  });
});

describe("slotIndex", () => {
  const axis = Array.from({ length: 96 }, (_, i) => 1000 + i * SLOT_MS);
  it("finds the slot containing a time", () => {
    expect(slotIndex(axis, 1000)).toBe(0);
    expect(slotIndex(axis, 1000 + SLOT_MS * 5 + 1)).toBe(5);
    expect(slotIndex(axis, 999)).toBeNull();
    expect(slotIndex(axis, 1000 + SLOT_MS * 96)).toBeNull();
  });
});

describe("areaPoints", () => {
  const axis = [0, SLOT_MS, 2 * SLOT_MS, 3 * SLOT_MS];
  it("stops at now and scales", () => {
    expect(areaPoints(axis, [1000, 2000, 3000, 4000], SLOT_MS + 1, 0.001)).toEqual([
      { t: 0, v: 1 },
      { t: SLOT_MS, v: 2 },
    ]);
  });

  it("keeps the sign and keeps gaps as gaps", () => {
    const pts = areaPoints(axis, [500, -300, null, 100], 3 * SLOT_MS, 0.001);
    expect(pts.map((p) => p.v)).toEqual([0.5, -0.3, null, 0.1]);
  });
});

describe("peakOf", () => {
  it("finds the biggest reading and ignores gaps and non-positive values", () => {
    expect(peakOf([{ t: 1, v: 2 }, { t: 2, v: null }, { t: 3, v: 5.5 }, { t: 4, v: -9 }])).toEqual({ v: 5.5, t: 3 });
    expect(peakOf([{ t: 1, v: 0 }, { t: 2, v: null }])).toBeNull();
    expect(peakOf([])).toBeNull();
  });
});

describe("axisTicks", () => {
  const H = 3_600_000;
  it("marks every 2 hours over a short span and every 3 over a long one", () => {
    expect(axisTicks(0, 6 * H)).toEqual([0, 2 * H, 4 * H, 6 * H]);
    expect(axisTicks(0, 15 * H).map((t) => t / H)).toEqual([0, 3, 6, 9, 12, 15]);
    expect(axisTicks(0, 24 * H).map((t) => t / H)).toEqual([0, 3, 6, 9, 12, 15, 18, 21, 24]);
  });
});
