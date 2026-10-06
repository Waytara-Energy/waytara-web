// Report catalogue for the customer "Daily report" builder. Pure data + math, no
// server imports, so the picker (client), the JSON/CSV/PDF routes (server) and
// the unit tests all read one definition.
//
// Key names are the real Deye register keys in equipment_metrics (verified
// against a live inverter, 2026-10):
//   - Solar generation  = pv1_power_w + pv2_power_w + pv3_power_w (DC power of
//     each MPPT string). NOT inverter_output_power_w: that is AC output, which
//     also carries battery discharge and grid power. The day's official energy
//     is the inverter's own counter day_pv_energy_kwh.
//   - battery_power_w    : signed, positive = discharging, negative = charging (the rollups keep the positive and
//     negative parts separately, so discharge and charge energy are exact).
//   - grid_total_power_w : signed, positive = importing (buying), negative =
//     exporting (selling).
//   - load_total_power_w : always >= 0.
// Because battery and grid are signed, "charge/discharge" and "import/export"
// are the positive and negative halves of one register.

export type ReportUnit = "kW" | "%" | "°C";

export interface ReportSeries {
  id: string;
  label: string;
  unit: ReportUnit;
  color: string;
  kind: "bar" | "line";
  /** Raw telemetry keys (W / % / °C as the inverter reports them) this series needs. */
  keys: string[];
  /** The inverter's own cumulative "today" energy counter, when one exists —
   *  the authoritative kWh figure for the day (integrating power is an estimate). */
  counterKey?: string;
  /** Bucket average of the raw keys -> display value (kW, %, °C). Return null
   *  when there is no usable reading. */
  compute: (raw: RawBuckets) => number | null;
}

const num = (v: number | null | undefined): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** One metric's figures for one bucket, as telemetry_series returns them: the time-weighted average and, for signed
 *  metrics (battery and grid power), the average of the positive and of the negative part - so charge and
 *  discharge, import and export, are exact even when the sign flips inside the bucket. */
export interface RawBucket {
  avg: number | null;
  pos: number | null;
  neg: number | null;
}
export type RawBuckets = Record<string, RawBucket | undefined>;

function sumOfAvailable(raw: RawBuckets, keys: string[]): number | null {
  let total = 0;
  let any = false;
  for (const k of keys) {
    const v = num(raw[k]?.avg);
    if (v !== null) {
      total += v;
      any = true;
    }
  }
  return any ? total : null;
}

const toKw = (w: number | null) => (w === null ? null : w / 1000);

const SERIES: Record<string, ReportSeries> = {
  solar: {
    id: "solar",
    label: "Solar generation",
    unit: "kW",
    color: "var(--chart-3)",
    kind: "bar",
    keys: ["pv1_power_w", "pv2_power_w", "pv3_power_w"],
    counterKey: "day_pv_energy_kwh",
    compute: (raw) => toKw(sumOfAvailable(raw, ["pv1_power_w", "pv2_power_w", "pv3_power_w"])),
  },
  pv1: {
    id: "pv1",
    label: "PV string 1",
    unit: "kW",
    color: "var(--chart-3)",
    kind: "bar",
    keys: ["pv1_power_w"],
    compute: (raw) => toKw(num(raw.pv1_power_w?.avg)),
  },
  pv2: {
    id: "pv2",
    label: "PV string 2",
    unit: "kW",
    color: "var(--chart-1)",
    kind: "bar",
    keys: ["pv2_power_w"],
    compute: (raw) => toKw(num(raw.pv2_power_w?.avg)),
  },
  pv3: {
    id: "pv3",
    label: "PV string 3",
    unit: "kW",
    color: "var(--chart-4)",
    kind: "bar",
    keys: ["pv3_power_w"],
    compute: (raw) => toKw(num(raw.pv3_power_w?.avg)),
  },
  batteryCharge: {
    id: "batteryCharge",
    label: "Battery charge",
    unit: "kW",
    color: "var(--chart-1)",
    kind: "bar",
    keys: ["battery_power_w"],
    counterKey: "day_battery_charge_energy_kwh",
    compute: (raw) => toKw(num(raw.battery_power_w?.neg)),
  },
  batteryDischarge: {
    id: "batteryDischarge",
    label: "Battery discharge",
    unit: "kW",
    color: "var(--chart-4)",
    kind: "bar",
    keys: ["battery_power_w"],
    counterKey: "day_battery_discharge_energy_kwh",
    compute: (raw) => toKw(num(raw.battery_power_w?.pos)),
  },
  batterySoc: {
    id: "batterySoc",
    label: "Battery level (SOC)",
    unit: "%",
    color: "var(--chart-1)",
    kind: "line",
    keys: ["battery_soc_pct"],
    compute: (raw) => num(raw.battery_soc_pct?.avg),
  },
  load: {
    id: "load",
    label: "Load (consumption)",
    unit: "kW",
    color: "var(--chart-2)",
    kind: "bar",
    keys: ["load_total_power_w"],
    counterKey: "day_load_energy_kwh",
    compute: (raw) => toKw(num(raw.load_total_power_w?.avg)),
  },
  gridImport: {
    id: "gridImport",
    label: "Grid import",
    unit: "kW",
    color: "var(--chart-2)",
    kind: "bar",
    keys: ["grid_total_power_w"],
    counterKey: "day_grid_import_energy_kwh",
    compute: (raw) => toKw(num(raw.grid_total_power_w?.pos)),
  },
  gridExport: {
    id: "gridExport",
    label: "Grid export",
    unit: "kW",
    color: "var(--chart-5)",
    kind: "bar",
    keys: ["grid_total_power_w"],
    counterKey: "day_grid_export_energy_kwh",
    compute: (raw) => toKw(num(raw.grid_total_power_w?.neg)),
  },
  inverterDcTemp: {
    id: "inverterDcTemp",
    label: "Inverter DC temperature",
    unit: "°C",
    color: "var(--chart-3)",
    kind: "line",
    keys: ["inverter_dc_temperature_c"],
    compute: (raw) => num(raw.inverter_dc_temperature_c?.avg),
  },
  inverterAcTemp: {
    id: "inverterAcTemp",
    label: "Inverter AC temperature",
    unit: "°C",
    color: "var(--chart-2)",
    kind: "line",
    keys: ["inverter_ac_temperature_c"],
    compute: (raw) => num(raw.inverter_ac_temperature_c?.avg),
  },
  batteryTemp: {
    id: "batteryTemp",
    label: "Battery temperature",
    unit: "°C",
    color: "var(--chart-1)",
    kind: "line",
    keys: ["battery_temperature_c"],
    compute: (raw) => num(raw.battery_temperature_c?.avg),
  },
};

export interface ReportType {
  id: string;
  label: string;
  group: "Solar" | "Battery" | "Load" | "Grid" | "Combined" | "Health";
  description: string;
  series: ReportSeries[];
}

export const REPORT_TYPES: ReportType[] = [
  {
    id: "solar",
    label: "Solar generation",
    group: "Solar",
    description: "Total PV power from all solar strings, with the inverter's own energy count for the day.",
    series: [SERIES.solar],
  },
  {
    id: "solar_strings",
    label: "Solar generation by string",
    group: "Solar",
    description: "Power from each solar input (PV1, PV2, PV3) on its own.",
    series: [SERIES.pv1, SERIES.pv2, SERIES.pv3],
  },
  {
    id: "battery_charge",
    label: "Battery charge",
    group: "Battery",
    description: "Power going into the battery.",
    series: [SERIES.batteryCharge],
  },
  {
    id: "battery_discharge",
    label: "Battery discharge",
    group: "Battery",
    description: "Power coming out of the battery.",
    series: [SERIES.batteryDischarge],
  },
  {
    id: "battery_both",
    label: "Battery charge & discharge",
    group: "Battery",
    description: "Charging and discharging together.",
    series: [SERIES.batteryCharge, SERIES.batteryDischarge],
  },
  {
    id: "battery_soc",
    label: "Battery level (SOC)",
    group: "Battery",
    description: "State of charge through the day.",
    series: [SERIES.batterySoc],
  },
  {
    id: "load",
    label: "Load (consumption)",
    group: "Load",
    description: "Power your home or site is using.",
    series: [SERIES.load],
  },
  {
    id: "grid_import",
    label: "Grid import",
    group: "Grid",
    description: "Power bought from the grid.",
    series: [SERIES.gridImport],
  },
  {
    id: "grid_export",
    label: "Grid export",
    group: "Grid",
    description: "Power sold back to the grid.",
    series: [SERIES.gridExport],
  },
  {
    id: "grid_both",
    label: "Grid import & export",
    group: "Grid",
    description: "Buying and selling together.",
    series: [SERIES.gridImport, SERIES.gridExport],
  },
  {
    id: "solar_vs_load",
    label: "Solar vs load",
    group: "Combined",
    description: "What the panels produced against what you used.",
    series: [SERIES.solar, SERIES.load],
  },
  {
    id: "energy_balance",
    label: "Full energy balance",
    group: "Combined",
    description: "Solar, load, battery and grid in one view.",
    series: [SERIES.solar, SERIES.load, SERIES.batteryCharge, SERIES.batteryDischarge, SERIES.gridImport, SERIES.gridExport],
  },
  {
    id: "temperatures",
    label: "Temperatures",
    group: "Health",
    description: "Inverter and battery temperatures.",
    series: [SERIES.inverterDcTemp, SERIES.inverterAcTemp, SERIES.batteryTemp],
  },
];

export const DEFAULT_REPORT_TYPE = "solar";

export function getReportType(id: string | null | undefined): ReportType {
  return REPORT_TYPES.find((t) => t.id === id) ?? REPORT_TYPES.find((t) => t.id === DEFAULT_REPORT_TYPE)!;
}

export const REPORT_BUCKET_OPTIONS = [
  { minutes: 15, label: "15 min" },
  { minutes: 30, label: "30 min" },
  { minutes: 60, label: "1 hour" },
  { minutes: 120, label: "2 hours" },
] as const;

export const DEFAULT_REPORT_BUCKET_MINUTES = 15;

/** Every raw key the given report needs (series keys + their energy counters). */
export function reportKeys(type: ReportType): { sampleKeys: string[]; counterKeys: string[] } {
  const sampleKeys = Array.from(new Set(type.series.flatMap((s) => s.keys)));
  const counterKeys = Array.from(new Set(type.series.flatMap((s) => (s.counterKey ? [s.counterKey] : []))));
  return { sampleKeys, counterKeys };
}

export interface ReportPoint {
  /** Bucket start, IST wall clock: "YYYY-MM-DDTHH:mm". */
  time: string;
  /** Per series: the value, and under "<id>:c" the seconds of the bucket the device actually reported. */
  [seriesId: string]: number | string | null;
}

export interface ReportSeriesSummary {
  id: string;
  label: string;
  unit: ReportUnit;
  /** kW series: estimated energy (sum of bucket average x hours). */
  energyKwh: number | null;
  /** The inverter's own energy counter for the day, when the series has one. */
  counterKwh: number | null;
  /** Highest / lowest / average bucket value, and when the peak happened (the bucket's "YYYY-MM-DDTHH:mm"). */
  max: number | null;
  min: number | null;
  avg: number | null;
  maxAt: string | null;
}

export function summarizeSeries(
  series: ReportSeries,
  points: ReportPoint[],
  bucketMinutes: number,
  counters: Record<string, number | null | undefined>
): ReportSeriesSummary {
  let max: number | null = null;
  let min: number | null = null;
  let maxAt: string | null = null;
  let sum = 0;
  let n = 0;
  let energySeconds = 0;
  for (const p of points) {
    const v = p[series.id];
    if (typeof v !== "number") continue;
    sum += v;
    n++;
    // energy follows the seconds the device reported, so an offline gap is not counted as if it had produced
    const covered = p[`${series.id}:c`];
    energySeconds += v * (typeof covered === "number" ? covered : bucketMinutes * 60);
    if (max === null || v > max) {
      max = v;
      maxAt = p.time;
    }
    if (min === null || v < min) min = v;
  }
  const counter = series.counterKey ? num(counters[series.counterKey]) : null;
  return {
    id: series.id,
    label: series.label,
    unit: series.unit,
    energyKwh: series.unit === "kW" && n > 0 ? energySeconds / 3600 : null,
    counterKwh: counter,
    max,
    min,
    avg: n > 0 ? sum / n : null,
    maxAt,
  };
}

/** Every bucket start of an IST day, "YYYY-MM-DDTHH:mm", 00:00 through the last
 *  bucket before the next midnight. */
export function dayBucketKeys(date: string, bucketMinutes: number): string[] {
  const total = Math.ceil((24 * 60) / bucketMinutes);
  const keys: string[] = [];
  for (let i = 0; i < total; i++) {
    const m = i * bucketMinutes;
    keys.push(`${date}T${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  }
  return keys;
}

/** The instant a YYYY-MM-DD IST day starts. */
export function istDayStart(date: string): Date {
  return new Date(`${date}T00:00:00+05:30`);
}

export const REPORT_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Today's date in India, YYYY-MM-DD. */
export function todayIst(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** True for a real calendar date that is not in the future (IST). */
export function isValidReportDate(date: string | null | undefined, now: Date = new Date()): date is string {
  if (!date || !REPORT_DATE_RE.test(date)) return false;
  const start = istDayStart(date);
  if (Number.isNaN(start.getTime())) return false;
  // Rejects 2026-02-31-style dates that Date would silently roll over.
  if (new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(start) !== date) {
    return false;
  }
  return date <= todayIst(now);
}

/** "HH:mm" key of a timestamp's bucket start, in IST, for a day starting at `dayStart`. */
export function bucketKeyIst(ts: string | Date, date: string, bucketMinutes: number): string | null {
  const t = new Date(ts).getTime();
  const offsetMin = Math.floor((t - istDayStart(date).getTime()) / 60000);
  if (offsetMin < 0 || offsetMin >= 24 * 60) return null;
  const m = offsetMin - (offsetMin % bucketMinutes);
  return `${date}T${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Per-device resolution. A report may only use metrics this device actually has
// in equipment_metrics with direction = 'read' AND show_for_user = true (the
// same rule every other customer page and the Python agent follow: a hidden or
// missing metric is never read, so it must never be charted or exported).
// ---------------------------------------------------------------------------

/** The report narrowed to the device's enabled metrics, or null when none of its
 *  series can be drawn. Series with no enabled key are dropped (e.g. PV3 on a
 *  2-input inverter); a series that has some of its keys keeps just those
 *  (solar generation = the enabled PV strings only); an energy counter that
 *  isn't enabled is simply not used. */
export function resolveReportType(type: ReportType, enabled: ReadonlySet<string>): ReportType | null {
  const series = type.series
    .map((s): ReportSeries | null => {
      const keys = s.keys.filter((k) => enabled.has(k));
      if (keys.length === 0) return null;
      return { ...s, keys, counterKey: s.counterKey && enabled.has(s.counterKey) ? s.counterKey : undefined };
    })
    .filter((s): s is ReportSeries => s !== null);
  return series.length > 0 ? { ...type, series } : null;
}

export function availableReportTypes(enabled: ReadonlySet<string>): ReportType[] {
  return REPORT_TYPES.map((t) => resolveReportType(t, enabled)).filter((t): t is ReportType => t !== null);
}

/** Serializable form for passing to the client (the series carry functions). */
export interface AvailableReport {
  id: string;
  seriesIds: string[];
}

export const toAvailableReports = (types: ReportType[]): AvailableReport[] =>
  types.map((t) => ({ id: t.id, seriesIds: t.series.map((s) => s.id) }));

/** A calendar date shifted by whole days ("2026-10-05" + 2 = "2026-10-07"). */
export function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Every bucket start of `days` consecutive IST days beginning on `date`. */
export function windowBucketKeys(date: string, days: number, bucketMinutes: number): string[] {
  return Array.from({ length: days }, (_, i) => dayBucketKeys(shiftDate(date, i), bucketMinutes)).flat();
}

/** The bucket key ("YYYY-MM-DDTHH:mm", IST) a timestamp falls in at `bucketMinutes`. */
export function istBucketKey(ts: string | Date, bucketMinutes: number): string {
  const size = bucketMinutes * 60_000;
  const t = new Date(ts).getTime();
  const start = Math.floor((t + 19_800_000) / size) * size - 19_800_000;
  return new Date(start + 19_800_000).toISOString().slice(0, 16);
}

export const MAX_REPORT_DAYS = 90;
