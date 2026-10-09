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

export type ReportUnit = "kW" | "%" | "°C" | "V" | "A" | "Hz";

/** Decimal places a value of this unit is shown with. */
export const unitDecimals = (unit: string): number => (unit === "kW" || unit === "Hz" ? 2 : 1);

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
    label: "Battery level",
    unit: "%",
    color: "var(--chart-1)",
    kind: "line",
    keys: ["battery_soc_pct"],
    compute: (raw) => num(raw.battery_soc_pct?.avg),
  },
  load: {
    id: "load",
    label: "Load consumption",
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
  pv1Voltage: {
    id: "pv1Voltage",
    label: "PV string 1 voltage",
    unit: "V",
    color: "var(--chart-3)",
    kind: "line",
    keys: ["pv1_voltage_v"],
    compute: (raw) => num(raw.pv1_voltage_v?.avg),
  },
  pv1Current: {
    id: "pv1Current",
    label: "PV string 1 current",
    unit: "A",
    color: "var(--chart-3)",
    kind: "line",
    keys: ["pv1_current_a"],
    compute: (raw) => num(raw.pv1_current_a?.avg),
  },
  pv2Voltage: {
    id: "pv2Voltage",
    label: "PV string 2 voltage",
    unit: "V",
    color: "var(--chart-1)",
    kind: "line",
    keys: ["pv2_voltage_v"],
    compute: (raw) => num(raw.pv2_voltage_v?.avg),
  },
  pv2Current: {
    id: "pv2Current",
    label: "PV string 2 current",
    unit: "A",
    color: "var(--chart-1)",
    kind: "line",
    keys: ["pv2_current_a"],
    compute: (raw) => num(raw.pv2_current_a?.avg),
  },
  pv3Voltage: {
    id: "pv3Voltage",
    label: "PV string 3 voltage",
    unit: "V",
    color: "var(--chart-4)",
    kind: "line",
    keys: ["pv3_voltage_v"],
    compute: (raw) => num(raw.pv3_voltage_v?.avg),
  },
  pv3Current: {
    id: "pv3Current",
    label: "PV string 3 current",
    unit: "A",
    color: "var(--chart-4)",
    kind: "line",
    keys: ["pv3_current_a"],
    compute: (raw) => num(raw.pv3_current_a?.avg),
  },
  batteryVoltage: {
    id: "batteryVoltage",
    label: "Battery voltage",
    unit: "V",
    color: "var(--chart-1)",
    kind: "line",
    keys: ["battery_voltage_v"],
    compute: (raw) => num(raw.battery_voltage_v?.avg),
  },
  batteryCurrent: {
    id: "batteryCurrent",
    label: "Battery current",
    unit: "A",
    color: "var(--chart-4)",
    kind: "line",
    keys: ["battery_current_a"],
    compute: (raw) => num(raw.battery_current_a?.avg),
  },
  loadL1Power: {
    id: "loadL1Power",
    label: "Load L1 power",
    unit: "kW",
    color: "var(--chart-5)",
    kind: "bar",
    keys: ["load_l1_power_w"],
    compute: (raw) => toKw(num(raw.load_l1_power_w?.avg)),
  },
  loadVoltage: {
    id: "loadVoltage",
    label: "Load voltage",
    unit: "V",
    color: "var(--chart-2)",
    kind: "line",
    keys: ["load_l1_voltage_v"],
    compute: (raw) => num(raw.load_l1_voltage_v?.avg),
  },
  loadCurrent: {
    id: "loadCurrent",
    label: "Load current",
    unit: "A",
    color: "var(--chart-4)",
    kind: "line",
    keys: ["load_l1_current_a"],
    compute: (raw) => num(raw.load_l1_current_a?.avg),
  },
  loadFrequency: {
    id: "loadFrequency",
    label: "Load frequency",
    unit: "Hz",
    color: "var(--chart-3)",
    kind: "line",
    keys: ["load_frequency_hz"],
    compute: (raw) => num(raw.load_frequency_hz?.avg),
  },
  gridVoltage: {
    id: "gridVoltage",
    label: "Grid voltage",
    unit: "V",
    color: "var(--chart-2)",
    kind: "line",
    keys: ["grid_l1_voltage_v"],
    compute: (raw) => num(raw.grid_l1_voltage_v?.avg),
  },
  gridCurrent: {
    id: "gridCurrent",
    label: "Grid current",
    unit: "A",
    color: "var(--chart-4)",
    kind: "line",
    keys: ["grid_l1_current_a"],
    compute: (raw) => num(raw.grid_l1_current_a?.avg),
  },
  gridFrequency: {
    id: "gridFrequency",
    label: "Grid frequency",
    unit: "Hz",
    color: "var(--chart-3)",
    kind: "line",
    keys: ["grid_frequency_hz"],
    compute: (raw) => num(raw.grid_frequency_hz?.avg),
  },
  ctPower: {
    id: "ctPower",
    label: "CT meter power",
    unit: "kW",
    color: "var(--chart-5)",
    kind: "bar",
    keys: ["grid_ct_total_power_w"],
    compute: (raw) => toKw(num(raw.grid_ct_total_power_w?.avg)),
  },
  ctCurrent: {
    id: "ctCurrent",
    label: "CT meter current",
    unit: "A",
    color: "var(--chart-1)",
    kind: "line",
    keys: ["grid_ct_l1_current_a"],
    compute: (raw) => num(raw.grid_ct_l1_current_a?.avg),
  },
  generatorPower: {
    id: "generatorPower",
    label: "Generator power",
    unit: "kW",
    color: "var(--chart-3)",
    kind: "bar",
    keys: ["generator_power_w"],
    compute: (raw) => toKw(num(raw.generator_power_w?.avg)),
  },
  generatorVoltage: {
    id: "generatorVoltage",
    label: "Generator voltage",
    unit: "V",
    color: "var(--chart-2)",
    kind: "line",
    keys: ["generator_voltage_v"],
    compute: (raw) => num(raw.generator_voltage_v?.avg),
  },
  generatorFrequency: {
    id: "generatorFrequency",
    label: "Generator frequency",
    unit: "Hz",
    color: "var(--chart-4)",
    kind: "line",
    keys: ["generator_frequency_hz"],
    compute: (raw) => num(raw.generator_frequency_hz?.avg),
  },
  inverterPower: {
    id: "inverterPower",
    label: "Inverter output power",
    unit: "kW",
    color: "var(--chart-3)",
    kind: "bar",
    keys: ["inverter_output_power_w"],
    compute: (raw) => toKw(num(raw.inverter_output_power_w?.avg)),
  },
  inverterVoltage: {
    id: "inverterVoltage",
    label: "Inverter output voltage",
    unit: "V",
    color: "var(--chart-2)",
    kind: "line",
    keys: ["inverter_l1_voltage_v"],
    compute: (raw) => num(raw.inverter_l1_voltage_v?.avg),
  },
  inverterCurrent: {
    id: "inverterCurrent",
    label: "Inverter output current",
    unit: "A",
    color: "var(--chart-4)",
    kind: "line",
    keys: ["inverter_l1_current_a"],
    compute: (raw) => num(raw.inverter_l1_current_a?.avg),
  },
  inverterFrequency: {
    id: "inverterFrequency",
    label: "Inverter output frequency",
    unit: "Hz",
    color: "var(--chart-1)",
    kind: "line",
    keys: ["inverter_output_frequency_hz"],
    compute: (raw) => num(raw.inverter_output_frequency_hz?.avg),
  },
};

export interface ReportType {
  id: string;
  label: string;
  group: "Solar" | "Battery" | "Load" | "Grid" | "Generator" | "Inverter" | "Combined" | "Health";
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
    description: "Power from each solar input such as PV1, PV2 and PV3 on its own.",
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
    label: "Battery level",
    group: "Battery",
    description: "State of charge through the day.",
    series: [SERIES.batterySoc],
  },
  {
    id: "load",
    label: "Load consumption",
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

/** Which category each single reading belongs to, for the filter's grouped picker. */
export const READING_GROUP: Record<string, ReportType["group"]> = {
  solar: "Solar",
  pv1: "Solar",
  pv2: "Solar",
  pv3: "Solar",
  pv1Voltage: "Solar",
  pv1Current: "Solar",
  pv2Voltage: "Solar",
  pv2Current: "Solar",
  pv3Voltage: "Solar",
  pv3Current: "Solar",
  batteryCharge: "Battery",
  batteryDischarge: "Battery",
  batterySoc: "Battery",
  batteryVoltage: "Battery",
  batteryCurrent: "Battery",
  batteryTemp: "Battery",
  load: "Load",
  loadL1Power: "Load",
  loadVoltage: "Load",
  loadCurrent: "Load",
  loadFrequency: "Load",
  gridImport: "Grid",
  gridExport: "Grid",
  gridVoltage: "Grid",
  gridCurrent: "Grid",
  gridFrequency: "Grid",
  ctPower: "Grid",
  ctCurrent: "Grid",
  generatorPower: "Generator",
  generatorVoltage: "Generator",
  generatorFrequency: "Generator",
  inverterPower: "Inverter",
  inverterVoltage: "Inverter",
  inverterCurrent: "Inverter",
  inverterFrequency: "Inverter",
  inverterDcTemp: "Inverter",
  inverterAcTemp: "Inverter",
};

/** The picker's categories, named after the Monitoring page's tabs. */
export const READING_GROUP_ORDER: ReportType["group"][] = ["Inverter", "Solar", "Battery", "Load", "Grid", "Generator"];

/** What the customer picks from in the filter: every single reading (id, label, unit), by category. */
export function readingOptions(): { id: string; label: string; unit: ReportUnit; group: ReportType["group"] }[] {
  // Within a category: power first, then voltage, current, frequency, level and temperature.
  const rank: ReportUnit[] = ["kW", "V", "A", "Hz", "%", "°C"];
  return Object.values(SERIES)
    .map((s) => ({ id: s.id, label: s.label, unit: s.unit, group: READING_GROUP[s.id] ?? "Combined" }))
    .sort((a, b) => rank.indexOf(a.unit) - rank.indexOf(b.unit));
}

export const getSeries = (id: string): ReportSeries | undefined => SERIES[id];

const CHART_PALETTE = ["var(--chart-3)", "var(--chart-2)", "var(--chart-1)", "var(--chart-4)", "var(--chart-5)"];
/** Readings picked together never share a colour: a later one that would repeat an earlier one's takes the next free one. */
export function withDistinctColors(series: ReportSeries[]): ReportSeries[] {
  const used = new Set<string>();
  return series.map((s) => {
    const color = used.has(s.color) ? (CHART_PALETTE.find((c) => !used.has(c)) ?? s.color) : s.color;
    used.add(color);
    return color === s.color ? s : { ...s, color };
  });
}

/** Every single reading the device reports (at least one of its keys is enabled for customers), for the filter's picker. */
export function availableReadingIds(enabled: ReadonlySet<string>): string[] {
  return Object.values(SERIES).filter((s) => s.keys.some((k) => enabled.has(k))).map((s) => s.id);
}

export const SELECTION_ID = "selection";

/** A report made of whichever single readings were picked, narrowed to what the device really reports; null when none can be drawn. */
export function resolveSelection(ids: string[], enabled: ReadonlySet<string>): ReportType | null {
  const picked = ids.map((id) => SERIES[id]).filter((s): s is ReportSeries => !!s);
  const type: ReportType = { id: SELECTION_ID, label: picked.length === 1 ? picked[0].label : "Selected readings", group: "Combined", description: "The readings you picked, side by side.", series: picked };
  return picked.length > 0 ? resolveReportType(type, enabled) : null;
}

/** A time of day to look at on each day, "HH:mm" in India time; `to` is not included ("13:00" to "17:00" is 13:00 up to 16:59). */
export interface TimeWindow {
  from: string;
  to: string;
}
export const HM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
/** Minutes since midnight; the end of the day ("23:59" or later) counts as 24:00. */
const hmMinutes = (hm: string, end = false) => (end && hm >= "23:59" ? 1440 : Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5)));
/** The window as it is kept: null when it is the whole day. */
export function normalizeWindow(from: string | null | undefined, to: string | null | undefined): TimeWindow | null {
  if (!from || !to || !HM_RE.test(from) || !HM_RE.test(to)) return null;
  if (hmMinutes(from) >= hmMinutes(to, true)) return null;
  if (from === "00:00" && hmMinutes(to, true) >= 1440) return null;
  return { from, to };
}
/** True when the bucket starting at `time` ("YYYY-MM-DDTHH:mm") is inside the window. */
export function inWindow(time: string, w: TimeWindow | null): boolean {
  if (!w) return true;
  const m = hmMinutes(time.slice(11, 16));
  return m >= hmMinutes(w.from) && m < hmMinutes(w.to, true);
}
export const windowText = (w: TimeWindow) => `${w.from} to ${w.to >= "23:59" ? "24:00" : w.to}`;

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
