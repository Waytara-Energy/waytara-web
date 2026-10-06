import { describe, expect, it } from "vitest";
import {
  REPORT_TYPES,
  availableReportTypes,
  resolveReportType,
  bucketKeyIst,
  dayBucketKeys,
  getReportType,
  isValidReportDate,
  reportKeys,
  summarizeSeries,
  todayIst,
  type RawBuckets,
  type ReportPoint,
} from "./report-types";

/** Bucket figures as the database returns them for a bucket holding one steady value. */
const r = (values: Record<string, number>): RawBuckets =>
  Object.fromEntries(Object.entries(values).map(([k, v]) => [k, { avg: v, pos: Math.max(v, 0), neg: Math.max(-v, 0) }]));

const seriesOf = (typeId: string, seriesId: string) => getReportType(typeId).series.find((s) => s.id === seriesId)!;

describe("report series maths (real Deye keys)", () => {
  it("solar generation is the sum of the three PV strings in kW, not inverter output", () => {
    const solar = seriesOf("solar", "solar");
    expect(solar.keys).toEqual(["pv1_power_w", "pv2_power_w", "pv3_power_w"]);
    expect(solar.counterKey).toBe("day_pv_energy_kwh");
    expect(solar.compute(r({ pv1_power_w: 3183, pv2_power_w: 3127, pv3_power_w: 0 }))).toBeCloseTo(6.31);
    // a string with no reading doesn't null out the others
    expect(solar.compute(r({ pv1_power_w: 1000 }))).toBeCloseTo(1);
    expect(solar.compute({})).toBeNull();
  });

  it("splits the signed battery register: positive = discharging, negative = charging", () => {
    const charge = seriesOf("battery_both", "batteryCharge");
    const discharge = seriesOf("battery_both", "batteryDischarge");
    expect(charge.compute(r({ battery_power_w: -2500 }))).toBeCloseTo(2.5);
    expect(discharge.compute(r({ battery_power_w: -2500 }))).toBe(0);
    expect(discharge.compute(r({ battery_power_w: 132 }))).toBeCloseTo(0.132);
    expect(charge.compute(r({ battery_power_w: 132 }))).toBe(0);
    expect(charge.compute({})).toBeNull();
  });

  it("splits the signed grid register: positive = import, negative = export", () => {
    const imp = seriesOf("grid_both", "gridImport");
    const exp = seriesOf("grid_both", "gridExport");
    expect(exp.compute(r({ grid_total_power_w: -6332 }))).toBeCloseTo(6.332);
    expect(imp.compute(r({ grid_total_power_w: -6332 }))).toBe(0);
    expect(imp.compute(r({ grid_total_power_w: 800 }))).toBeCloseTo(0.8);
    expect(exp.compute(r({ grid_total_power_w: 800 }))).toBe(0);
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
    expect(s.maxAt).toBe("2026-10-05T06:30");
    expect(s.min).toBe(0);
    expect(s.avg).toBeCloseTo(2);
  });

  it("energy follows the seconds the device reported, not the bucket width", () => {
    const withGap: ReportPoint[] = [
      { time: "2026-10-05T06:00", solar: 4, "solar:c": 900 },
      { time: "2026-10-05T06:15", solar: 4, "solar:c": 450 }, // the device was offline for half of this bucket
    ];
    expect(summarizeSeries(solar, withGap, 15, {}).energyKwh).toBeCloseTo(4 * 900 / 3600 + 4 * 450 / 3600);
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

describe("reports follow the device's enabled metrics (equipment_metrics read + show_for_user)", () => {
  // The live inverter: two MPPT inputs, so no pv3; all other keys below are enabled.
  const enabled = new Set([
    "pv1_power_w", "pv2_power_w", "battery_power_w", "battery_soc_pct", "grid_total_power_w", "load_total_power_w",
    "day_pv_energy_kwh", "day_load_energy_kwh", "day_grid_import_energy_kwh", "day_grid_export_energy_kwh",
    "day_battery_charge_energy_kwh", "day_battery_discharge_energy_kwh",
    "inverter_dc_temperature_c", "inverter_ac_temperature_c", "battery_temperature_c",
  ]);

  it("solar generation sums only the enabled strings", () => {
    const solar = resolveReportType(getReportType("solar"), enabled)!.series[0];
    expect(solar.keys).toEqual(["pv1_power_w", "pv2_power_w"]);
    expect(reportKeys(resolveReportType(getReportType("solar"), enabled)!).sampleKeys).not.toContain("pv3_power_w");
    // even if a stray pv3 reading existed it can't leak in: only fetched keys reach compute
    expect(solar.compute(r({ pv1_power_w: 3183, pv2_power_w: 3127 }))).toBeCloseTo(6.31);
  });

  it("drops a string that isn't enabled from the per-string report", () => {
    const strings = resolveReportType(getReportType("solar_strings"), enabled)!;
    expect(strings.series.map((s) => s.id)).toEqual(["pv1", "pv2"]);
  });

  it("drops reports whose metrics are not enabled and offers none for an empty device", () => {
    expect(resolveReportType(getReportType("battery_soc"), new Set(["pv1_power_w"]))).toBeNull();
    expect(availableReportTypes(new Set())).toEqual([]);
    const onlyPv = availableReportTypes(new Set(["pv1_power_w"]));
    // every report that survives was cut down to the one enabled key
    expect(onlyPv.map((t) => t.id).sort()).toEqual(["energy_balance", "solar", "solar_strings", "solar_vs_load"]);
    expect(onlyPv.every((t) => t.series.every((s) => s.keys.every((k) => k === "pv1_power_w")))).toBe(true);
  });

  it("only uses an energy counter when that counter is enabled", () => {
    const noCounter = new Set([...enabled].filter((k) => k !== "day_pv_energy_kwh"));
    const solar = resolveReportType(getReportType("solar"), noCounter)!;
    expect(solar.series[0].counterKey).toBeUndefined();
    expect(reportKeys(solar).counterKeys).toEqual([]);
    expect(resolveReportType(getReportType("solar"), enabled)!.series[0].counterKey).toBe("day_pv_energy_kwh");
  });

  it("a mixed report keeps the series that exist (balance without grid export keeps the rest)", () => {
    const noGrid = new Set([...enabled].filter((k) => k !== "grid_total_power_w"));
    const balance = resolveReportType(getReportType("energy_balance"), noGrid)!;
    expect(balance.series.map((s) => s.id)).toEqual(["solar", "load", "batteryCharge", "batteryDischarge"]);
  });
});
