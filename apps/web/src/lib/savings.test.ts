import { describe, expect, it } from "vitest";
import { billModel, byMonth, fmtDate, inr, olderSavings, paybackMonths, priceMonths, ratesOn, recentSavedPerDay, sumBills, type DayEnergy } from "./savings";
import { flatSchedule, type Schedule } from "./tariff-schedule";

const r = { rate: 8, exportRate: 8 };

describe("billModel", () => {
  it("compares the bill with no solar against the bill with it", () => {
    // used 100, bought 20, sold 60 at Rs 8: without = 800, avoided = 80 x 8 = 640, sold 480, with = 800 - 640 - 480 = -320
    const b = billModel({ loadKwh: 100, importKwh: 20, exportKwh: 60 }, r);
    expect(b).toEqual({ withoutSolar: 800, withSolar: -320, avoided: 640, exportIncome: 480, saved: 1120, banked: 0 });
    expect(b.withoutSolar - b.withSolar).toBe(b.saved);
  });

  it("values what is sold at the export rate", () => {
    const b = billModel({ loadKwh: 100, importKwh: 20, exportKwh: 60 }, { rate: 8, exportRate: 3 });
    expect(b.exportIncome).toBe(180);
    expect(b.saved).toBe(820);
  });

  it("never counts energy it did not use as saved, even if the counters are slightly out", () => {
    const b = billModel({ loadKwh: 10, importKwh: 12, exportKwh: 0 }, r);
    expect(b.avoided).toBe(0);
    expect(b.saved).toBe(0);
  });

  it("matches the live Waytara office counters", () => {
    // 12.6 kWh used, 7.6 bought, 116.3 sold, at Rs 8
    const b = billModel({ loadKwh: 12.6, importKwh: 7.6, exportKwh: 116.3 }, r);
    expect(b.avoided).toBe(40);
    expect(b.exportIncome).toBe(930.4);
  });
});

describe("byMonth", () => {
  const days: DayEnergy[] = [
    { day: "2026-10-07", loadKwh: 1, importKwh: 0.5, exportKwh: 10, pvKwh: 12 },
    { day: "2026-10-08", loadKwh: 2, importKwh: 1, exportKwh: 12, pvKwh: 15 },
    { day: "2026-11-01", loadKwh: 3, importKwh: 1, exportKwh: 9, pvKwh: 11 },
  ];
  it("adds the days up month by month, oldest first", () => {
    const m = byMonth([...days].reverse());
    expect(m.map((x) => x.month)).toEqual(["2026-10", "2026-11"]);
    expect(m[0].energy).toEqual({ loadKwh: 3, importKwh: 1.5, exportKwh: 22, pvKwh: 27 });
    expect(m[0].days).toBe(2);
  });
});

describe("payback", () => {
  it("is the months left to recover the cost at the recent pace", () => {
    expect(paybackMonths(60000, 6000, 90)).toBe(20);
    expect(paybackMonths(60000, 70000, 90)).toBe(0);
    expect(paybackMonths(60000, 6000, null)).toBeNull();
    expect(paybackMonths(60000, 6000, 0)).toBeNull();
    expect(paybackMonths(0, 100, 5)).toBeNull();
  });
  it("takes the pace from the last 30 days and needs at least three", () => {
    const days: DayEnergy[] = Array.from({ length: 40 }, (_, i) => ({ day: `2026-09-${String(i + 1).padStart(2, "0")}`.replace("2026-09-3", "2026-10-0").slice(0, 10), loadKwh: 10, importKwh: 0, exportKwh: 0 }));
    expect(recentSavedPerDay(days.slice(0, 2), r)).toBeNull();
    expect(recentSavedPerDay(days, r)).toBe(80);
  });
});

describe("formatting", () => {
  it("writes rupees and dates the Indian way", () => {
    expect(inr(1234567)).toBe("₹12,34,567");
    expect(inr(-320)).toBe("-₹320");
    expect(fmtDate("2026-07-01")).toBe("1 Jul 2026");
  });
});

describe("pricing a month at its own rate", () => {
  const timeline = [
    { effectiveFrom: "2025-07-01", rate: 8, exportRate: 8 },
    { effectiveFrom: "2026-10-01", rate: 9, exportRate: 4 },
  ];
  const fallback = { rate: 7, exportRate: 7 };

  it("picks the rate in force on a day", () => {
    expect(ratesOn(timeline, "2026-09-30", fallback)).toEqual({ rate: 8, exportRate: 8 });
    expect(ratesOn(timeline, "2026-10-01", fallback)).toEqual({ rate: 9, exportRate: 4 });
    expect(ratesOn(timeline, "2024-01-01", fallback)).toEqual({ rate: 8, exportRate: 8 });   // before the first rate on file: the first
    expect(ratesOn([], "2026-10-01", fallback)).toEqual(fallback);
  });

  it("prices September at the old rate and October at the new one", () => {
    const energy = { loadKwh: 100, importKwh: 20, exportKwh: 50 };
    const m = priceMonths([{ month: "2026-09", energy, days: 30 }, { month: "2026-10", energy, days: 8 }], timeline, fallback, "2026-10-08");
    expect(m[0].bill.avoided).toBe(640);          // 80 x 8
    expect(m[0].bill.exportIncome).toBe(400);     // 50 x 8
    expect(m[1].bill.avoided).toBe(720);          // 80 x 9
    expect(m[1].bill.exportIncome).toBe(200);     // 50 x 4
    expect(m[0].label).toMatch(/2026/);
  });
});

describe("a bill on slabs", () => {
  const slabs: Schedule = { ...flatSchedule(0), slabs: [{ upTo: 200, rate: 3 }, { upTo: 400, rate: 4.5 }, { upTo: null, rate: 6.5 }] };
  const paid = { rate: 4, exportRate: 4, schedule: slabs, netMetering: false };

  it("values the units not bought at the top slabs they would have reached, not at one average rate", () => {
    // used 500, bought 100: without = 200x3 + 200x4.5 + 100x6.5 = 2150, with = 100x3 = 300
    const b = billModel({ loadKwh: 500, importKwh: 100, exportKwh: 0 }, paid);
    expect(b).toMatchObject({ withoutSolar: 2150, withSolar: 300, avoided: 1850, exportIncome: 0, saved: 1850 });
  });

  it("pays export at the export rate when the utility buys it", () => {
    const b = billModel({ loadKwh: 500, importKwh: 100, exportKwh: 50 }, { ...paid, exportRate: 3 });
    expect(b.exportIncome).toBe(150);
    expect(b.withSolar).toBe(150);
    expect(b.saved).toBe(2000);
  });

  it("nets export against import under net metering and banks any surplus", () => {
    const net = { ...paid, netMetering: true };
    // bought 300, sent 150: billed on 150 units = 450; without = 2150; bought alone would be 600 + 450 = 1050
    const b = billModel({ loadKwh: 500, importKwh: 300, exportKwh: 150 }, net);
    expect(b).toMatchObject({ withoutSolar: 2150, withSolar: 450, avoided: 1100, exportIncome: 600, saved: 1700, banked: 0 });
    // bought 100, sent 400: nothing to pay, 300 units banked
    const surplus = billModel({ loadKwh: 500, importKwh: 100, exportKwh: 400 }, net);
    expect(surplus).toMatchObject({ withSolar: 0, banked: 300 });
    // the banked units cancel next month's purchases
    expect(billModel({ loadKwh: 100, importKwh: 100, exportKwh: 0 }, net, 300)).toMatchObject({ withSolar: 0, saved: 300, banked: 200 });
  });

  it("carries banked units month to month and starts afresh in April", () => {
    const e = (loadKwh: number, importKwh: number, exportKwh: number) => ({ loadKwh, importKwh, exportKwh });
    const rows = priceMonths(
      [
        { month: "2027-02", energy: e(100, 0, 100), days: 28 },
        { month: "2027-03", energy: e(100, 100, 0), days: 31 },
        { month: "2027-04", energy: e(100, 100, 0), days: 30 },
      ],
      [{ effectiveFrom: "2025-04-01", ...paid, netMetering: true }],
      paid,
      "2027-05-01"
    );
    expect(rows[0].bill).toMatchObject({ withSolar: 0, banked: 100 });
    expect(rows[1].bill).toMatchObject({ withSolar: 0, saved: 300 });   // March's 100 units cancelled by February's surplus
    expect(rows[2].bill).toMatchObject({ withSolar: 300, saved: 0 });   // April: nothing carried over
  });

  it("takes the recent pace from a month of that use, bands and all", () => {
    const days: DayEnergy[] = Array.from({ length: 30 }, (_, i) => ({ day: `2026-09-${String(i + 1).padStart(2, "0")}`, loadKwh: 500 / 30, importKwh: 100 / 30, exportKwh: 0 }));
    expect(recentSavedPerDay(days, paid)).toBeCloseTo(1850 / 30, 6);
  });

  it("adds month bills up, and prices older energy at the typical rate", () => {
    const m = billModel({ loadKwh: 500, importKwh: 100, exportKwh: 0 }, paid);
    expect(sumBills([m, m]).saved).toBe(3700);
    expect(olderSavings({ loadKwh: 100, importKwh: 0, exportKwh: 0 }, paid).saved).toBeCloseTo(100 * ((200 * 3 + 50 * 4.5) / 250), 1);
  });
});
