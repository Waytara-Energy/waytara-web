import { describe, expect, it } from "vitest";
import {
  REPORT_TYPES,
  bucketKeyIst,
  dayBucketKeys,
  getReportType,
  isValidReportDate,
  reportKeys,
  summarizeSeries,
  todayIst,
  type ReportPoint,
} from "./report-types";

const seriesOf = (typeId: string, seriesId: string) => getReportType(typeId).series.find((s) => s.id === seriesId)!;

describe("report series maths (real Deye keys)", () => {
  it("solar generation is the sum of the three PV strings in kW, not inverter output", () => {
    const solar = seriesOf("solar", "solar");
    expect(solar.keys).toEqual(["pv1_power_w", "pv2_power_w", "pv3_power_w"]);
    expect(solar.counterKey).toBe("day_pv_energy_kwh");
    expect(solar.compute({ pv1_power_w: 3183, pv2_power_w: 3127, pv3_power_w: 0 })).toBeCloseTo(6.31);
    // a string with no reading doesn't null out the others
    expect(solar.compute({ pv1_power_w: 1000 })).toBeCloseTo(1);
    expect(solar.compute({})).toBeNull();
  });

  it("splits the signed battery register: positive = discharging, negative = charging", () => {
    const charge = seriesOf("battery_both", "batteryCharge");
    const discharge = seriesOf("battery_both", "batteryDischarge");
    expect(charge.compute({ battery_power_w: -2500 })).toBeCloseTo(2.5);
    expect(discharge.compute({ battery_power_w: -2500 })).toBe(0);
    expect(discharge.compute({ battery_power_w: 132 })).toBeCloseTo(0.132);
    expect(charge.compute({ battery_power_w: 132 })).toBe(0);
    expect(charge.compute({})).toBeNull();
  });

  it("splits the signed grid register: positive = import, negative = export", () => {
    const imp = seriesOf("grid_both", "gridImport");
    const exp = seriesOf("grid_both", "gridExport");
    expect(exp.compute({ grid_total_power_w: -6332 })).toBeCloseTo(6.332);
    expect(imp.compute({ grid_total_power_w: -6332 })).toBe(0);
    expect(imp.compute({ grid_total_power_w: 800 })).toBeCloseTo(0.8);
    expect(exp.compute({ grid_total_power_w: 800 })).toBe(0);
  });

  it("every report has at least one series and only lists keys it actually uses", () => {
    for (const t of REPORT_TYPES) {
      expect(t.series.length).toBeGreaterThan(0);
      const { sampleKeys, counterKeys } = reportKeys(t);
      expect(sampleKeys.length).toBeGreaterThan(0);
      expect(new Set(sampleKeys).size).toBe(sampleKeys.length);
      for (const c of counterKeys) expect(c.startsWith("day_")).toBe(true);
      // one axis per chart: a report never mixes units
      expect(new Set(t.series.map((s) => s.unit)).size).toBe(1);
    }
  });

  it("an unknown report id falls back to solar generation", () => {
    expect(getReportType("nope").id).toBe("solar");
    expect(getReportType(null).id).toBe("solar");
  });
});

describe("IST day helpers", () => {
  it("builds every bucket of a day", () => {
    const keys = dayBucketKeys("2026-10-05", 15);
    expect(keys).toHaveLength(96);
    expect(keys[0]).toBe("2026-10-05T00:00");
    expect(keys[95]).toBe("2026-10-05T23:45");
    expect(dayBucketKeys("2026-10-05", 60)).toHaveLength(24);
  });

  it("keys a timestamp by its IST bucket and rejects other days", () => {
    // 2026-10-05 00:10 IST == 2026-10-04 18:40 UTC
    expect(bucketKeyIst("2026-10-04T18:40:00Z", "2026-10-05", 15)).toBe("2026-10-05T00:00");
    // 23:59 IST on the 5th
    expect(bucketKeyIst("2026-10-05T18:29:59Z", "2026-10-05", 60)).toBe("2026-10-05T23:00");
    // 00:00 IST on the 6th belongs to the next day
    expect(bucketKeyIst("2026-10-05T18:30:00Z", "2026-10-05", 15)).toBeNull();
    // the same instant rendered with an IST offset gives the same bucket
    expect(bucketKeyIst("2026-10-05T12:44:55+05:30", "2026-10-05", 5)).toBe("2026-10-05T12:40");
  });

  it("validates dates: real, well-formed, not in the future", () => {
    const now = new Date("2026-10-06T08:00:00Z"); // 13:30 IST on the 6th
    expect(isValidReportDate("2026-10-05", now)).toBe(true);
    expect(isValidReportDate("2026-10-06", now)).toBe(true);
    expect(isValidReportDate("2026-10-07", now)).toBe(false);
    expect(isValidReportDate("2026-02-31", now)).toBe(false);
    expect(isValidReportDate("05-10-2026", now)).toBe(false);
    expect(isValidReportDate("", now)).toBe(false);
    expect(isValidReportDate(null, now)).toBe(false);
  });

  it("todayIst rolls over at Indian midnight, not UTC midnight", () => {
    expect(todayIst(new Date("2026-10-05T18:29:00Z"))).toBe("2026-10-05");
    expect(todayIst(new Date("2026-10-05T18:31:00Z"))).toBe("2026-10-06");
  });
});

describe("summarizeSeries", () => {
  const solar = seriesOf("solar", "solar");
  const points: ReportPoint[] = [
    { time: "2026-10-05T06:00", solar: 0 },
    { time: "2026-10-05T06:15", solar: 2 },
    { time: "2026-10-05T06:30", solar: 4 },
    { time: "2026-10-05T06:45", solar: null },
  ];

  it("integrates kW buckets into kWh and reports the meter counter separately", () => {
    const s = summarizeSeries(solar, points, 15, { day_pv_energy_kwh: 24.9 });
    expect(s.energyKwh).toBeCloseTo(1.5); // (0+2+4) kW x 0.25 h
    expect(s.counterKwh).toBe(24.9);
    expect(s.max).toBe(4);
    expect(s.maxAt).toBe("06:30");
    expect(s.min).toBe(0);
    expect(s.avg).toBeCloseTo(2);
  });

  it("gaps are ignored, not counted as zero; an all-empty day has no figures", () => {
    const s = summarizeSeries(solar, [{ time: "2026-10-05T00:00", solar: null }], 15, {});
    expect(s.energyKwh).toBeNull();
    expect(s.max).toBeNull();
    expect(s.counterKwh).toBeNull();
  });

  it("non-power series get no kWh", () => {
    const soc = seriesOf("battery_soc", "batterySoc");
    const s = summarizeSeries(soc, [{ time: "2026-10-05T00:00", batterySoc: 98 }], 15, {});
    expect(s.energyKwh).toBeNull();
    expect(s.avg).toBe(98);
  });
});
