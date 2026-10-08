import { describe, expect, it } from "vitest";
import { flatSchedule, freeUnitsFor, monthlyEnergyBill, parseSlabs, scheduleFromRow, slabCharge, typicalRate, type Schedule } from "./tariff-schedule";

const delhiLike: Schedule = { ...flatSchedule(0), slabs: [{ upTo: 200, rate: 3 }, { upTo: 400, rate: 4.5 }, { upTo: null, rate: 6.5 }] };
// Tamil Nadu from 10 May 2026: bills every two months, 200 free units while a bill stays within 500 units, else the earlier 100.
const tn: Schedule = {
  slabs: [{ upTo: 400, rate: 4.95 }, { upTo: 500, rate: 6.65 }, { upTo: 600, rate: 8.8 }, { upTo: 800, rate: 9.95 }, { upTo: 1000, rate: 11.05 }, { upTo: null, rate: 12.15 }],
  billingMonths: 2,
  dutyPct: 5,
  surchargePerKwh: 0,
  freeUnits: 200,
  freeUnitsCap: 500,
  freeUnitsOverCap: 100,
};

describe("slabCharge", () => {
  it("charges each band at its own rate", () => {
    expect(slabCharge(delhiLike.slabs, 0)).toBe(0);
    expect(slabCharge(delhiLike.slabs, 150)).toBe(450);
    expect(slabCharge(delhiLike.slabs, 200)).toBe(600);
    expect(slabCharge(delhiLike.slabs, 500)).toBe(200 * 3 + 200 * 4.5 + 100 * 6.5);
  });
});

describe("monthlyEnergyBill", () => {
  it("adds duty and a per-unit surcharge to the energy charge", () => {
    const s: Schedule = { ...flatSchedule(5), dutyPct: 10, surchargePerKwh: 1 };
    expect(monthlyEnergyBill(s, 100)).toBeCloseTo((100 * 5 + 100 * 1) * 1.1, 6);
  });

  it("takes the free units off before the bands are applied", () => {
    const karnataka: Schedule = { ...flatSchedule(5.8), dutyPct: 9, freeUnits: 200 };
    expect(monthlyEnergyBill(karnataka, 150)).toBe(0);
    expect(monthlyEnergyBill(karnataka, 250)).toBeCloseTo(50 * 5.8 * 1.09, 6);
  });

  it("charges the whole bill once the cap is passed when no free units remain (Punjab / Telangana style)", () => {
    const telangana: Schedule = { ...flatSchedule(0), slabs: [{ upTo: 200, rate: 5.1 }, { upTo: null, rate: 7.7 }], freeUnits: 200, freeUnitsCap: 200, freeUnitsOverCap: 0 };
    expect(monthlyEnergyBill(telangana, 200)).toBe(0);
    expect(monthlyEnergyBill(telangana, 201)).toBeCloseTo(200 * 5.1 + 7.7, 6);
  });

  it("works a two-monthly tariff out on two months of use (Tamil Nadu)", () => {
    // 220 units in the two months: 200 free, 20 charged at 4.95 + 5% duty, half of it each month
    expect(monthlyEnergyBill(tn, 110)).toBeCloseTo((20 * 4.95 * 1.05) / 2, 6);
    // 500 units: still within the cap, 300 charged
    expect(monthlyEnergyBill(tn, 250)).toBeCloseTo((300 * 4.95 * 1.05) / 2, 6);
    // 510 units: past the cap, only 100 free, so 410 charged across the first two bands - the sharp cut-off
    expect(monthlyEnergyBill(tn, 255)).toBeCloseTo(((400 * 4.95 + 10 * 6.65) * 1.05) / 2, 6);
    expect(monthlyEnergyBill(tn, 255)).toBeGreaterThan(monthlyEnergyBill(tn, 250) * 1.3);
  });

  it("is never negative or NaN", () => {
    expect(monthlyEnergyBill(tn, -5)).toBe(0);
    expect(monthlyEnergyBill(flatSchedule(8), 0)).toBe(0);
  });
});

describe("freeUnitsFor", () => {
  it("drops to the over-cap allowance past the cap, not at it", () => {
    expect(freeUnitsFor(tn, 500)).toBe(200);
    expect(freeUnitsFor(tn, 501)).toBe(100);
    expect(freeUnitsFor(flatSchedule(8), 9999)).toBe(0);
  });
});

describe("typicalRate", () => {
  it("is the average cost of a unit at 250 units a month, without the free units", () => {
    expect(typicalRate(flatSchedule(8))).toBe(8);
    expect(typicalRate(delhiLike)).toBeCloseTo((200 * 3 + 50 * 4.5) / 250, 6);
    // Tamil Nadu: 500 units in two months, 5% duty, no free units
    expect(typicalRate(tn)).toBeCloseTo(((400 * 4.95 + 100 * 6.65) * 1.05) / 500, 6);
  });
});

describe("reading a row", () => {
  it("builds the schedule from the columns, and from just a rate for an old row", () => {
    expect(scheduleFromRow({ rate_per_kwh: 8 })).toEqual(flatSchedule(8));
    const s = scheduleFromRow({ rate_per_kwh: 5.55, slabs: [{ upTo: 400, rate: 4.95 }, { upTo: null, rate: 6.65 }], billing_months: 2, duty_pct: "5", free_units: 200, free_units_cap: 500, free_units_over_cap: 100 });
    expect(s).toMatchObject({ billingMonths: 2, dutyPct: 5, freeUnits: 200, freeUnitsCap: 500, freeUnitsOverCap: 100 });
    expect(s.slabs).toHaveLength(2);
  });

  it("drops malformed bands, orders them and opens the last", () => {
    expect(parseSlabs(null)).toEqual([]);
    expect(parseSlabs([{ upTo: 300, rate: 6 }, { upTo: 100, rate: 3 }, { upTo: -5, rate: 1 }, { rate: "x" }])).toEqual([{ upTo: 100, rate: 3 }, { upTo: null, rate: 6 }]);
  });
});
