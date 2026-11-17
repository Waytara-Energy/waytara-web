import { describe, expect, it } from "vitest";
import type { DayEnergy } from "@/lib/savings";
import { buildCarbonPack, carbonPeriods, financialYearOf, fmtCo2 } from "./carbon-data";
import { carbonCsv } from "./carbon-csv";

const d = (day: string, pv: number, imp: number): DayEnergy => ({ day, pvKwh: pv, loadKwh: 5, importKwh: imp, exportKwh: 1 });
const base = {
  customerName: "Asha <Rao>",
  siteName: "Home",
  deviceLabel: "Inverter",
  deviceId: "3f9a1c00-0000-0000-0000-000000000000",
  generatedAt: "2026-10-09T10:00:00Z",
  today: "2026-10-09",
  days: [d("2026-02-10", 10, 2), d("2026-03-05", 20, 4), d("2026-04-01", 8, 1), d("2026-10-02", 12, 3)],
  lifetime: { loadKwh: 900, importKwh: 300, exportKwh: 100, pvKwh: 1155 },
  co2KgPerKwh: 0.5,
  co2Note: "0.5 kg CO2/kWh - Test source, 2024-25, provisional",
};

describe("financial years", () => {
  it("start on 1 April", () => {
    expect(financialYearOf("2026-03-31")).toBe(2025);
    expect(financialYearOf("2026-04-01")).toBe(2026);
    expect(financialYearOf("2026-12-31")).toBe(2026);
  });
});

describe("carbonPeriods", () => {
  it("lists each financial year with readings, newest first, then everything on file", () => {
    const p = carbonPeriods(base.days, base.today);
    expect(p.map((x) => x.id)).toEqual(["fy-2026", "fy-2025", "all"]);
    expect(p[0]).toMatchObject({ label: "FY 2026-27 (so far)", from: "2026-04-01", to: "2026-10-09", partial: true });
    expect(p[1]).toMatchObject({ label: "FY 2025-26", from: "2025-04-01", to: "2026-03-31", partial: false });
    expect(p[2]).toMatchObject({ label: "All history on file", from: "2026-02-10", to: "2026-10-09" });
  });
  it("has nothing to offer without readings", () => {
    expect(carbonPeriods([], base.today)).toEqual([]);
  });
});

describe("buildCarbonPack", () => {
  const pack = buildCarbonPack(base, "fy-2025")!;

  it("adds up the generation and works out the CO2 avoided with the stated factor", () => {
    expect(pack.totals.pvKwh).toBe(30);
    expect(pack.totals.co2AvoidedKg).toBe(15);
    expect(pack.factor.kgPerKwh).toBe(0.5);
    expect(pack.totals.trees).toBeCloseTo(15 / 21, 5);
    expect(pack.totals.carKm).toBeCloseTo(15 / (2.31 / 15), 3);
  });
  it("works out the grid electricity bought as a location-based Scope 2 estimate, separately", () => {
    expect(pack.totals.importKwh).toBe(6);
    expect(pack.totals.gridCo2Kg).toBe(3);
  });
  it("says how much of the period has readings (an older year is honest about it)", () => {
    expect(pack.totals).toMatchObject({ days: 2, daysInPeriod: 365, completeness: 1 });
  });
  it("lists every month of the period, with the ones that have no reading at zero", () => {
    expect(pack.months).toHaveLength(12);
    expect(pack.months[0]).toMatchObject({ month: "2025-04", label: "Apr 2025", days: 0, pvKwh: 0, co2AvoidedKg: 0 });
    expect(pack.months.find((m) => m.month === "2026-02")).toMatchObject({ days: 1, pvKwh: 10, co2AvoidedKg: 5, importKwh: 2, gridCo2Kg: 1 });
    expect(pack.months.reduce((s, m) => s + m.co2AvoidedKg, 0)).toBe(pack.totals.co2AvoidedKg);
  });
  it("keeps one row per day with its CO2", () => {
    expect(pack.daily).toEqual([
      { day: "2026-02-10", pvKwh: 10, importKwh: 2, co2AvoidedKg: 5 },
      { day: "2026-03-05", pvKwh: 20, importKwh: 4, co2AvoidedKg: 10 },
    ]);
  });
  it("gives a stable ID and the method version, and a so-far period carries its end date", () => {
    expect(pack.id).toBe("WTC-FY2025-3F9A1C");
    expect(pack.methodVersion).toBe("1.0");
    expect(buildCarbonPack(base, "fy-2026")!.id).toBe("WTC-FY2026-20261009-3F9A1C");
    expect(buildCarbonPack(base, "all")!.id).toBe("WTC-ALL-20261009-3F9A1C");
  });
  it("uses the lifetime counter for the figure since commissioning, when there is one", () => {
    expect(pack.sinceCommissioning).toEqual({ pvKwh: 1155, co2AvoidedKg: 577.5 });
    expect(buildCarbonPack({ ...base, lifetime: null }, "all")!.sinceCommissioning).toBeNull();
  });
  it("never counts negative readings", () => {
    const p = buildCarbonPack({ ...base, days: [d("2026-05-01", -4, -2), d("2026-05-02", 6, 1)] }, "fy-2026")!;
    expect(p.totals.pvKwh).toBe(6);
    expect(p.totals.importKwh).toBe(1);
  });
  it("is null for a period that is not on offer", () => {
    expect(buildCarbonPack(base, "fy-2019")).toBeNull();
    expect(buildCarbonPack(base, "nonsense")).toBeNull();
  });
});

describe("fmtCo2", () => {
  it("reads in the unit that fits", () => {
    expect(fmtCo2(38.46)).toBe("38.5 kg");
    expect(fmtCo2(412.4)).toBe("412 kg");
    expect(fmtCo2(1240)).toBe("1.24 t");
    expect(fmtCo2(0)).toBe("0.0 kg");
  });
});

describe("carbonCsv", () => {
  const csv = carbonCsv(buildCarbonPack(base, "fy-2025")!);
  it("starts with what the numbers are and how they were made", () => {
    expect(csv).toContain('"Report ID","WTC-FY2025-3F9A1C"');
    expect(csv).toContain('"Method version","1.0"');
    expect(csv).toContain("Inverter-measured");
    expect(csv).toContain("not the electricity board's revenue-grade meter");
    expect(csv).toContain("Not a carbon credit and not verified");
    expect(csv).toContain('"Emission factor kg CO2/kWh","0.5"');
    expect(csv).toContain("Test source, 2024-25, provisional");
  });
  it("has the summary, every month and every day, and what WayTara does not hold", () => {
    expect(csv).toContain('"CO2 avoided","15.0","kg"');
    expect(csv).toContain('"Grid CO2, location-based Scope 2 estimate","3.0","kg"');
    expect(csv).toContain('"CO2 avoided since commissioning","578","kg"');
    expect(csv).toContain('"2026-02","1","28","10.00","5.0","2.00","1.0"');
    expect(csv).toContain('"2026-03-05","20.00","4.00","10.00"');
    expect(csv).toContain("Meter calibration records");
  });
  it("quotes a customer name that needs it", () => {
    expect(carbonCsv(buildCarbonPack({ ...base, customerName: 'A "B", C' }, "fy-2025")!)).toContain('"A ""B"", C"');
  });
});
