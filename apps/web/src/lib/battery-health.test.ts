import { describe, expect, it } from "vitest";
import {
  batteryHealth,
  batteryProfileFromUnits,
  capacityEstimates,
  cyclesPerDay,
  cycleLifeUsedPct,
  equivalentFullCycles,
  healthFromUsage,
  yearsLeft,
  type BatteryProfile,
  type BatterySlot,
} from "./battery-health";

const profile: BatteryProfile = { ratedCapacityKwh: 10, ratedCycleLife: 6000, endOfLifePct: 80, baselineDischargedKwh: 0, installedOn: null, chemistry: "LFP" };
const SLOT = 900_000;

/** A night's discharge: `slots` slots at `kw`, SOC falling from `from` to `to` in equal steps. */
function discharge(startT: number, slots: number, kw: number, from: number, to: number): BatterySlot[] {
  return Array.from({ length: slots }, (_, i) => ({
    t: startT + i * SLOT,
    socMax: from - ((from - to) * i) / slots,
    socMin: from - ((from - to) * (i + 1)) / slots,
    powerW: kw * 1000,
    coveredS: 900,
  }));
}

describe("equivalent full cycles", () => {
  it("is the energy delivered divided by the rated usable capacity", () => {
    expect(equivalentFullCycles(250, profile)).toBe(25);
    expect(equivalentFullCycles(6.6, { ratedCapacityKwh: 10, baselineDischargedKwh: 0 })).toBeCloseTo(0.66);
  });
  it("starts again from zero for a replaced battery", () => {
    expect(equivalentFullCycles(1250, { ratedCapacityKwh: 10, baselineDischargedKwh: 1000 })).toBe(25);
    expect(equivalentFullCycles(900, { ratedCapacityKwh: 10, baselineDischargedKwh: 1000 })).toBe(0);
  });
  it("is unknown without a counter or a size", () => {
    expect(equivalentFullCycles(null, profile)).toBeNull();
    expect(equivalentFullCycles(10, { ratedCapacityKwh: 0, baselineDischargedKwh: 0 })).toBeNull();
  });
});

describe("life used and what is left", () => {
  it("shows the share of the rated cycles used", () => {
    expect(cycleLifeUsedPct(600, 6000)).toBe(10);
    expect(cycleLifeUsedPct(null, 6000)).toBeNull();
  });
  it("fades straight to the end-of-life capacity at the rated cycle life", () => {
    expect(healthFromUsage(0, profile)).toBe(100);
    expect(healthFromUsage(3000, profile)).toBe(90);
    expect(healthFromUsage(6000, profile)).toBe(80);
    expect(healthFromUsage(9000, profile)).toBe(70);
  });
  it("works out years left at the recent pace and says nothing for a battery that is barely used", () => {
    expect(yearsLeft(1000, 6000, 1)).toBeCloseTo(5000 / 365, 5);
    expect(yearsLeft(7000, 6000, 1)).toBe(0);
    expect(yearsLeft(10, 6000, 0.005)).toBeNull();
    expect(yearsLeft(10, 6000, null)).toBeNull();
  });
  it("averages the daily discharge into cycles per day, and needs a few days", () => {
    expect(cyclesPerDay([8, 9, 7, null, 8], 10)).toBeCloseTo(0.8);
    expect(cyclesPerDay([8, 9], 10)).toBeNull();
  });
});

describe("measuring the capacity from a discharge", () => {
  it("finds the capacity: 4 kWh out over a 40-point swing is a 10 kWh battery", () => {
    const e = capacityEstimates(discharge(0, 8, 2, 90, 50));   // 8 slots x 15 min x 2 kW = 4 kWh
    expect(e).toHaveLength(1);
    expect(e[0].socSwing).toBeCloseTo(40);
    expect(e[0].energyKwh).toBeCloseTo(4);
    expect(e[0].kwh).toBeCloseTo(10);
  });

  it("ignores a discharge too shallow to measure well", () => {
    expect(capacityEstimates(discharge(0, 8, 2, 90, 70))).toEqual([]);   // only 20 points
  });

  it("ignores a short burst", () => {
    expect(capacityEstimates(discharge(0, 2, 8, 90, 40))).toEqual([]);
  });

  it("treats a gap in the readings as the end of a discharge", () => {
    const night = [...discharge(0, 5, 2, 90, 60), ...discharge(10 * SLOT, 5, 2, 60, 30)];   // five slots missing between the two
    const e = capacityEstimates(night);
    expect(e).toHaveLength(2);                                                              // each half is a 30-point swing on its own
    expect(e[0].kwh).toBeCloseTo(2.5 / 0.3);                                                // 5 slots x 15 min x 2 kW over 30 points
  });

  it("treats a charging or idle slot as the end of a discharge", () => {
    const slots = [...discharge(0, 6, 2, 95, 55), { t: 6 * SLOT, socMax: 55, socMin: 55, powerW: -3000, coveredS: 900 }, ...discharge(7 * SLOT, 6, 2, 55, 20)];
    const e = capacityEstimates(slots);
    expect(e).toHaveLength(2);
  });

  it("skips slots with no readings", () => {
    const slots = discharge(0, 8, 2, 90, 50).map((s, i) => (i === 3 ? { ...s, powerW: null, coveredS: 0 } : s));
    expect(capacityEstimates(slots)).toEqual([]);   // the gap cuts the discharge in two short pieces
  });
});

describe("batteryHealth", () => {
  const base = { profile, dischargedKwh: 250, dailyDischargedKwh: [8, 8, 8, 8, 8, 8, 8] };

  it("falls back to the usage curve when no discharge has been long enough to measure", () => {
    const h = batteryHealth({ ...base, estimates: [] });
    expect(h.efc).toBe(25);
    expect(h.sohSource).toBe("usage");
    expect(h.sohPct).toBeCloseTo(100 - 20 * (25 / 6000), 5);
    expect(h.samples).toBe(0);
    expect(h.cyclesPerDay).toBeCloseTo(0.8);
    expect(h.yearsLeft).toBeCloseTo((6000 - 25) / 0.8 / 365, 3);
  });

  it("prefers the measurement, using the median of the newest discharges", () => {
    const mk = (kwh: number, startMs: number) => ({ kwh, socSwing: 40, energyKwh: kwh * 0.4, startMs });
    const h = batteryHealth({ ...base, estimates: [mk(9.2, 1), mk(9.0, 2), mk(9.4, 3)] });
    expect(h.sohSource).toBe("measured");
    expect(h.measuredKwh).toBeCloseTo(9.2);
    expect(h.sohPct).toBeCloseTo(92);
    expect(h.samples).toBe(3);
  });

  it("caps a measurement above the rating at 100%", () => {
    const h = batteryHealth({ ...base, estimates: [{ kwh: 11, socSwing: 40, energyKwh: 4.4, startMs: 1 }] });
    expect(h.sohPct).toBe(100);
  });

  it("has nothing to say without a counter", () => {
    const h = batteryHealth({ profile, dischargedKwh: null, dailyDischargedKwh: [], estimates: [] });
    expect(h.sohPct).toBeNull();
    expect(h.sohSource).toBeNull();
    expect(h.efc).toBeNull();
  });
});

describe("batteryProfileFromUnits", () => {
  const f5 = { installedAt: "2026-09-20T10:00:00Z", capacityValue: "5.12", capacityUnit: "kWh", specs: { chemistry: "LiFePO4", dod: "90%", usable_kwh: 4.6, eol_pct: 70 }, warranty: { cycle_life: 6000, years: 10 } };

  it("reads the usable energy, cycle life and end of life from the product record", () => {
    expect(batteryProfileFromUnits([f5])).toEqual({ ratedCapacityKwh: 4.6, ratedCycleLife: 6000, endOfLifePct: 70, baselineDischargedKwh: 0, installedOn: "2026-09-20", chemistry: "LiFePO4" });
  });

  it("works the usable energy out from the nominal energy and the depth of discharge when it is not stated", () => {
    const p = batteryProfileFromUnits([{ ...f5, specs: { dod: "90%" } }])!;
    expect(p.ratedCapacityKwh).toBeCloseTo(4.608);
    expect(p.endOfLifePct).toBe(80);                          // not stated: the usual 80%
  });

  it("adds up several batteries and takes the shortest rated life", () => {
    const p = batteryProfileFromUnits([f5, { ...f5, installedAt: "2026-10-01T00:00:00Z", warranty: { cycle_life: 4000 } }])!;
    expect(p.ratedCapacityKwh).toBeCloseTo(9.2);
    expect(p.ratedCycleLife).toBe(4000);
    expect(p.installedOn).toBe("2026-09-20");                 // the earliest
  });

  it("counts a row of several batteries once per battery", () => {
    expect(batteryProfileFromUnits([{ ...f5, quantity: 2 }])!.ratedCapacityKwh).toBeCloseTo(9.2);
  });

  it("starts the cycle count from the discharge counter of the day the battery was installed", () => {
    expect(batteryProfileFromUnits([{ ...f5, baselineDischargedKwh: 40 }])!.baselineDischargedKwh).toBe(40);
    expect(batteryProfileFromUnits([f5])!.baselineDischargedKwh).toBe(0);
  });

  it("understands watt-hours", () => {
    expect(batteryProfileFromUnits([{ ...f5, capacityValue: 5120, capacityUnit: "Wh", specs: { dod: "90%" } }])!.ratedCapacityKwh).toBeCloseTo(4.608);
  });

  it("says nothing when the record cannot say the size or the cycle life", () => {
    expect(batteryProfileFromUnits([])).toBeNull();
    expect(batteryProfileFromUnits([{ ...f5, warranty: { years: 10 } }])).toBeNull();
    expect(batteryProfileFromUnits([{ ...f5, capacityValue: null, specs: {} }])).toBeNull();
    expect(batteryProfileFromUnits([{ ...f5, capacityUnit: "Ah", specs: {} }])).toBeNull();
  });
});
