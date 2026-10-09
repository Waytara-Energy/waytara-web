// A report the customer designs: a name, a period, and one or more parameters (each with the name it is shown under). With more than
// one parameter, from any categories, it is a comparison report. One function turns the definition into numbers; the screen, the CSV,
// the PDF and the scheduled e-mail all read what it returns, so they cannot disagree.

import { selfConsumptionPct, selfSufficiencyPct } from "@/lib/performance-metrics";
import { fmtDate, type DayEnergy, type MonthRow } from "@/lib/savings";
import { PARAMETER_BY_ID, categoryLabel, type ParamCategoryId, type ParamUnit } from "./parameters";
import { addDays, daysIn, daysInclusive, monthBounds, periodBill, previousWindow, summarize } from "./period-math";

export const PERIOD_PRESETS = [
  { id: "last7", label: "Last 7 days" },
  { id: "last30", label: "Last 30 days" },
  { id: "last90", label: "Last 90 days" },
  { id: "thisMonth", label: "This month so far" },
  { id: "lastMonth", label: "Last month" },
  { id: "last12m", label: "Last 12 months" },
] as const;

export type PeriodPreset = (typeof PERIOD_PRESETS)[number]["id"];
export type PeriodSpec = PeriodPreset | { from: string; to: string };

export interface SeriesDef {
  param: string;
  /** The name it is shown under in the report (the parameter's own name when empty). */
  label?: string;
}

export interface CustomReportDef {
  name: string;
  series: SeriesDef[];
  period: PeriodSpec;
  /** Also work out each parameter for the period just before and show how it changed. */
  comparePrevious?: boolean;
}

export const MAX_SERIES = 6;
// Past this many days a report is grouped by month, so a long period stays readable.
const MONTHLY_AFTER_DAYS = 92;

/** The dates a period covers, and a name for it. `today` is the IST date. */
export function resolvePeriod(spec: PeriodSpec, today: string): { from: string; to: string; label: string } {
  if (typeof spec === "object") {
    const to = spec.to < today ? spec.to : today;
    return { from: spec.from, to, label: spec.from === to ? fmtDate(spec.from) : `${fmtDate(spec.from)} to ${fmtDate(to)}` };
  }
  const monthStart = `${today.slice(0, 7)}-01`;
  switch (spec) {
    case "last7":
      return { from: addDays(today, -6), to: today, label: "Last 7 days" };
    case "last30":
      return { from: addDays(today, -29), to: today, label: "Last 30 days" };
    case "last90":
      return { from: addDays(today, -89), to: today, label: "Last 90 days" };
    case "thisMonth":
      return { from: monthStart, to: today, label: "This month so far" };
    case "lastMonth": {
      const before = new Date(Date.parse(`${monthStart}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 7);
      return { ...monthBounds(before), label: "Last month" };
    }
    case "last12m":
      return { from: addDays(today, -364), to: today, label: "Last 12 months" };
  }
}

export interface ReportSeries {
  /** Unique within the report. */
  id: string;
  param: string;
  label: string;
  category: ParamCategoryId;
  categoryLabel: string;
  unit: ParamUnit;
  /** One value per bucket; null where there was nothing to measure. */
  values: (number | null)[];
  /** The whole period: a sum for energy, money and carbon; the period's own ratio for a percentage. */
  total: number | null;
  avg: number | null;
  min: number | null;
  max: number | null;
  /** The same total over the period just before (when asked for), and how it changed. */
  previousTotal: number | null;
  changePct: number | null;
}

export interface CustomReport {
  name: string;
  /** More than one parameter: a comparison. */
  comparison: boolean;
  period: { from: string; to: string; label: string; days: number };
  granularity: "day" | "month";
  buckets: { key: string; label: string }[];
  series: ReportSeries[];
  comparePrevious: boolean;
  previousPeriod: { from: string; to: string } | null;
  daysWithReadings: number;
  customerName: string;
  siteName: string | null;
  deviceLabel: string | null;
  generatedAt: string;
  tariffNote: string;
  co2Note: string;
}

export interface ReportInput {
  customerName: string;
  siteName: string | null;
  deviceLabel: string | null;
  generatedAt: string;
  days: DayEnergy[];
  months: MonthRow[];
  tariffNote: string;
  co2KgPerKwh: number;
  co2Note: string;
}

const sumOf = (rows: DayEnergy[], f: (d: DayEnergy) => number | undefined): number | null => {
  const vals = rows.map(f).filter((v): v is number => typeof v === "number");
  return vals.length === 0 ? null : vals.reduce((a, b) => a + b, 0);
};

/** One parameter over a group of days (one bucket, or the whole period). `bill` is the money for that group. */
function figure(param: string, rows: DayEnergy[], bill: { withoutSolar: number; withSolar: number; saved: number } | null, co2KgPerKwh: number): number | null {
  if (rows.length === 0) return null;
  const pv = sumOf(rows, (d) => d.pvKwh ?? 0) ?? 0;
  const load = sumOf(rows, (d) => d.loadKwh) ?? 0;
  const imp = sumOf(rows, (d) => d.importKwh) ?? 0;
  const exp = sumOf(rows, (d) => d.exportKwh) ?? 0;
  switch (param) {
    case "pv":
      return pv;
    case "load":
      return load;
    case "import":
      return imp;
    case "export":
      return exp;
    case "net":
      return exp - imp;
    case "charged":
      return sumOf(rows, (d) => d.chargedKwh);
    case "discharged":
      return sumOf(rows, (d) => d.dischargedKwh);
    case "selfUse":
      return selfConsumptionPct(pv, exp);
    case "covered":
      return selfSufficiencyPct(load, imp);
    case "co2":
      return pv * co2KgPerKwh;
    case "billWithout":
      return bill ? bill.withoutSolar : null;
    case "billWith":
      return bill ? bill.withSolar : null;
    case "saved":
      return bill ? bill.saved : null;
    default:
      return null;
  }
}

const monthLabel = (m: string) => new Date(`${m}-15T00:00:00Z`).toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" });
const dayLabel = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

export function buildCustomReport(input: ReportInput, def: CustomReportDef, today: string): CustomReport {
  const period = resolvePeriod(def.period, today);
  const chosen = def.series.filter((s) => PARAMETER_BY_ID[s.param]).slice(0, MAX_SERIES);
  const monthly = chosen.some((s) => PARAMETER_BY_ID[s.param].monthlyOnly) || daysInclusive(period.from, period.to) > MONTHLY_AFTER_DAYS;
  const rows = daysIn(input.days, period.from, period.to);

  // Buckets: each day with a reading, or each month that has one in the period (with its own slice of the month's bill).
  const groups: { key: string; label: string; rows: DayEnergy[]; bill: ReturnType<typeof periodBill> | null }[] = monthly
    ? [...new Set(rows.map((d) => d.day.slice(0, 7)))].sort().map((m) => {
        const b = monthBounds(m);
        const from = b.from > period.from ? b.from : period.from;
        const to = b.to < period.to ? b.to : period.to;
        return { key: m, label: monthLabel(m), rows: rows.filter((d) => d.day.slice(0, 7) === m), bill: periodBill(input.months, input.days, from, to) };
      })
    : rows.map((d) => ({ key: d.day, label: dayLabel(d.day), rows: [d], bill: null }));

  const prevWin = def.comparePrevious ? previousWindow(period.from, period.to) : null;
  const prevRows = prevWin ? daysIn(input.days, prevWin.from, prevWin.to) : [];
  const prevBill = prevWin && prevRows.length > 0 ? periodBill(input.months, input.days, prevWin.from, prevWin.to) : null;
  const periodMoney = monthly ? periodBill(input.months, input.days, period.from, period.to) : null;

  const series: ReportSeries[] = chosen.map((s, i) => {
    const p = PARAMETER_BY_ID[s.param];
    const values = groups.map((g) => figure(p.id, g.rows, g.bill, input.co2KgPerKwh));
    const present = values.filter((v): v is number => v !== null);
    const total = figure(p.id, rows, periodMoney, input.co2KgPerKwh);
    const previousTotal = prevWin ? figure(p.id, prevRows, prevBill, input.co2KgPerKwh) : null;
    const changePct = total !== null && previousTotal !== null && previousTotal !== 0 ? ((total - previousTotal) / Math.abs(previousTotal)) * 100 : null;
    return {
      id: `${p.id}-${i}`,
      param: p.id,
      label: s.label?.trim() || p.label,
      category: p.category,
      categoryLabel: categoryLabel(p.category),
      unit: p.unit,
      values,
      total,
      avg: present.length > 0 ? present.reduce((a, b) => a + b, 0) / present.length : null,
      min: present.length > 0 ? Math.min(...present) : null,
      max: present.length > 0 ? Math.max(...present) : null,
      previousTotal,
      changePct,
    };
  });

  return {
    name: def.name.trim() || "Report",
    comparison: series.length > 1,
    period: { ...period, days: daysInclusive(period.from, period.to) },
    granularity: monthly ? "month" : "day",
    buckets: groups.map((g) => ({ key: g.key, label: g.label })),
    series,
    comparePrevious: !!def.comparePrevious,
    previousPeriod: prevWin,
    daysWithReadings: summarize(rows).days,
    customerName: input.customerName,
    siteName: input.siteName,
    deviceLabel: input.deviceLabel,
    generatedAt: input.generatedAt,
    tariffNote: input.tariffNote,
    co2Note: input.co2Note,
  };
}

/** The series that share a unit, in the order the units first appear: one chart each (never two scales on one chart). */
export function unitGroups(report: CustomReport): { unit: ParamUnit; series: ReportSeries[] }[] {
  const out: { unit: ParamUnit; series: ReportSeries[] }[] = [];
  for (const s of report.series) {
    const g = out.find((x) => x.unit === s.unit);
    if (g) g.series.push(s);
    else out.push({ unit: s.unit, series: [s] });
  }
  return out;
}

/** A value with its unit, for tables and the PDF ("12.4 kWh", "₹1,200", "63%"). `plain` writes "Rs." for fonts without the rupee sign. */
export function formatValue(v: number | null, unit: ParamUnit, plain = false): string {
  if (v === null || !Number.isFinite(v)) return "-";
  switch (unit) {
    case "₹":
      return `${v < 0 ? "-" : ""}${plain ? "Rs. " : "₹"}${Math.abs(v).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
    case "%":
      return `${v.toFixed(0)}%`;
    case "kg":
      return `${v.toFixed(Math.abs(v) >= 100 ? 0 : 1)} kg`;
    default:
      return `${v.toFixed(Math.abs(v) >= 100 ? 0 : 1)} kWh`;
  }
}
