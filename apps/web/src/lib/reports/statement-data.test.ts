import { describe, expect, it } from "vitest";
import type { DayEnergy, MonthRow } from "@/lib/savings";
import { buildStatement } from "./statement-data";

const d = (day: string, pv: number, load: number, imp: number, exp: number): DayEnergy => ({ day, pvKwh: pv, loadKwh: load, importKwh: imp, exportKwh: exp });
const month = (m: string, saved: number): MonthRow => ({
  month: m, label: m, days: 0, energy: { loadKwh: 0, importKwh: 0, exportKwh: 0 },
  bill: { withoutSolar: saved * 2, withSolar: saved, avoided: saved, exportIncome: 0, saved, banked: 0 },
});
const base = {
  customerName: "A", siteName: "Home", deviceLabel: "Inverter", generatedAt: "2026-10-09T10:00:00Z", today: "2026-10-09",
  days: [d("2025-10-02", 10, 5, 1, 4), d("2026-09-05", 12, 6, 2, 5), d("2026-09-20", 99, 9, 9, 9), d("2026-10-01", 20, 10, 2, 12), d("2026-10-02", 10, 8, 4, 6)],
  months: [month("2025-10", 100), month("2026-09", 300), month("2026-10", 500)],
  lifetimeBill: null, tariffNote: "T", tariffIndicative: false, co2KgPerKwh: 0.5, co2Note: "N",
};

describe("buildStatement", () => {
  it("covers the month so far, and compares with the month before and a year ago", () => {
    const s = buildStatement(base, "2026-10");
    expect(s).toMatchObject({ label: "October 2026", from: "2026-10-01", to: "2026-10-09", partial: true });
    expect(s.current.pvKwh).toBe(30);
    expect(s.previous?.pvKwh).toBe(12);             // 1-9 September only: the 20th is not in the same days
    expect(s.lastYear?.pvKwh).toBe(10);
    expect(s.co2Kg).toBe(15);
    expect(s.daily).toHaveLength(2);
  });
  it("uses the whole month's bill, exactly, for a finished month", () => {
    const s = buildStatement(base, "2026-09");
    expect(s.partial).toBe(false);
    expect(s.bill).toMatchObject({ saved: 300, exact: true });
    expect(s.previous).toBeNull();                       // nothing in August
  });
  it("says how much of the month has readings", () => {
    expect(buildStatement(base, "2026-10").completeness).toBe(22); // 2 of the 9 days so far
  });
});
