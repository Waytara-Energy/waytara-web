import { describe, expect, it } from "vitest";
import type { Bill, DayEnergy, MonthRow } from "@/lib/savings";
import { addDays, completenessPct, daysInclusive, lastYearWindow, monthBounds, monthsWithData, pctChange, periodBill, previousWindow, summarize } from "./period-math";
import { periodCsv, PERIOD_CSV_HEADER } from "./period-csv";

const day = (d: string, pv: number, load: number, imp: number, exp: number): DayEnergy => ({ day: d, pvKwh: pv, loadKwh: load, importKwh: imp, exportKwh: exp });

describe("windows", () => {
  it("counts days both ends included and shifts windows", () => {
    expect(daysInclusive("2026-10-01", "2026-10-07")).toBe(7);
    expect(addDays("2026-10-01", -1)).toBe("2026-09-30");
    expect(previousWindow("2026-10-08", "2026-10-14")).toEqual({ from: "2026-10-01", to: "2026-10-07" });
    expect(lastYearWindow("2026-10-01", "2026-10-07")).toEqual({ from: "2025-10-01", to: "2025-10-07" });
  });
  it("finds the bounds of a month, leap years included", () => {
    expect(monthBounds("2026-10")).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(monthBounds("2028-02")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
  });
  it("lists the months that have readings, newest first", () => {
    expect(monthsWithData([day("2026-09-30", 1, 1, 0, 0), day("2026-10-01", 1, 1, 0, 0), day("2026-10-02", 1, 1, 0, 0)])).toEqual(["2026-10", "2026-09"]);
  });
});

describe("summarize", () => {
  const rows = [day("2026-10-01", 20, 10, 2, 12), day("2026-10-02", 10, 8, 4, 6), day("2026-10-03", 0, 9, 9, 0)];
  it("adds the energy up and says how the solar was used", () => {
    const s = summarize(rows);
    expect(s).toMatchObject({ days: 3, pvKwh: 30, loadKwh: 27, importKwh: 15, exportKwh: 18 });
    expect(s.selfUsePct).toBeCloseTo(40);             // (30 - 18) / 30
    expect(s.selfSufficiencyPct).toBeCloseTo(44.44, 1); // (27 - 15) / 27
    expect(s.avgPvPerDay).toBe(10);
    expect(s.best).toEqual({ day: "2026-10-01", kwh: 20 });
    expect(s.lowest).toEqual({ day: "2026-10-02", kwh: 10 }); // a day with no solar at all is not a "lowest generating day"
  });
  it("copes with no days", () => {
    const s = summarize([]);
    expect(s).toMatchObject({ days: 0, pvKwh: 0, selfUsePct: null, avgPvPerDay: null, best: null });
  });
});

describe("pctChange and completeness", () => {
  it("is null with nothing to compare against", () => {
    expect(pctChange(10, 0)).toBeNull();
    expect(pctChange(15, 10)).toBeCloseTo(50);
    expect(pctChange(5, 10)).toBeCloseTo(-50);
  });
  it("is the share of the period's days that have readings", () => {
    expect(completenessPct(5, "2026-10-01", "2026-10-10")).toBe(50);
    expect(completenessPct(20, "2026-10-01", "2026-10-10")).toBe(100);
  });
});

describe("periodBill", () => {
  const bill = (saved: number): Bill => ({ withoutSolar: saved * 2, withSolar: saved, avoided: saved, exportIncome: 0, saved, banked: 0 });
  const month = (m: string, saved: number): MonthRow => ({ month: m, label: m, bill: bill(saved), days: 0, energy: { loadKwh: 0, importKwh: 0, exportKwh: 0 } });
  const days = [...["01", "02", "03", "04"].map((d) => day(`2026-09-${d}`, 1, 1, 0, 0)), ...["01", "02", "03", "04"].map((d) => day(`2026-10-${d}`, 1, 1, 0, 0))];
  const months = [month("2026-09", 400), month("2026-10", 800)];

  it("is exactly the month's bill for a whole month", () => {
    const p = periodBill(months, days, "2026-10-01", "2026-10-31");
    expect(p.saved).toBe(800);
    expect(p.exact).toBe(true);
  });
  it("is a share of the month's bill for part of it, and says so", () => {
    const p = periodBill(months, days, "2026-10-01", "2026-10-02");
    expect(p.saved).toBe(400);           // 2 of the month's 4 days with readings
    expect(p.exact).toBe(false);
  });
  it("adds the months it spans", () => {
    expect(periodBill(months, days, "2026-09-01", "2026-10-31").saved).toBe(1200);
  });
  it("is zero when no month has readings inside the period", () => {
    expect(periodBill(months, days, "2026-11-01", "2026-11-05").saved).toBe(0);
  });
});

describe("periodCsv", () => {
  it("has a header, a row per day and a total", () => {
    const csv = periodCsv([day("2026-10-01", 20, 10, 2, 12), day("2026-10-02", 10, 8, 4, 6)]).split("\r\n");
    expect(csv).toHaveLength(4);
    expect(csv[0]).toBe(PERIOD_CSV_HEADER.map((h) => `"${h}"`).join(","));
    expect(csv[1]).toBe('"2026-10-01","20.00","10.00","2.00","12.00","40","80"');
    expect(csv[3]).toBe('"Total","30.00","18.00","6.00","18.00","40","67"');
  });
});
