// The carbon and sustainability pack: how much CO2 a site's solar has avoided over a financial year (April to March, as Indian reporting runs) or all the history on
// file, month by month, with the emission factor it was worked out with, the grid electricity bought (a location-based Scope 2 estimate), and a dataset a verifier, an
// auditor or an aggregator can read (the CSV). Pure, so the screen, the PDF, the CSV and the tests all share one set of numbers.
//
// What it is NOT: a carbon credit, or a claim to one. Credits (CCTS, REC, I-REC, Verra, Gold Standard) need a registered project, a methodology and independent
// verification. This is "MRV-ready": measured data, a stated method and its limits.

import { PETROL_CAR } from "@/lib/emission-factor";
import { treesEquivalent } from "@/lib/environmental-impact";
import type { DayGap } from "@/lib/data-gaps";
import type { DayEnergy } from "@/lib/savings";
import type { ReportsBase } from "./gather";
import { daysWithoutReadings } from "./gaps";
import { completenessPct, daysInclusive, monthBounds } from "./period-math";

/** Changes whenever the way the figures are worked out changes, so an old report can be told from a new one. */
export const CARBON_METHOD_VERSION = "1.0";

export interface CarbonPeriod {
  /** "fy-2026" (1 April 2026 to 31 March 2027) or "all". */
  id: string;
  /** "FY 2026-27", "FY 2026-27 (so far)" or "All history on file". */
  label: string;
  from: string;
  to: string;
  /** The period is not over: the figures are "so far". */
  partial: boolean;
}

export interface CarbonMonth {
  month: string;
  /** "Oct 2026" */
  label: string;
  /** Days that have a reading, out of the days of the month inside the period. */
  days: number;
  daysInPeriod: number;
  pvKwh: number;
  co2AvoidedKg: number;
  importKwh: number;
  gridCo2Kg: number;
}

export interface CarbonDay {
  day: string;
  pvKwh: number;
  importKwh: number;
  co2AvoidedKg: number;
}

export interface CarbonPack {
  /** A stable name for this report, so it can be quoted: WTC-FY2026-3F9A1C. */
  id: string;
  methodVersion: string;
  period: CarbonPeriod;
  customerName: string;
  siteName: string | null;
  deviceLabel: string | null;
  generatedAt: string;
  /** The grid emission factor used, and where it comes from ("0.71 kg CO2/kWh - CEA CO2 Baseline Database v21.0, weighted average, 2024-25, provisional"). */
  factor: { kgPerKwh: number; note: string };
  totals: {
    /** Days in the period that have a reading, and the days the period covers. */
    days: number;
    daysInPeriod: number;
    completeness: number;
    pvKwh: number;
    co2AvoidedKg: number;
    /** Trees a year that would absorb as much (an estimate). */
    trees: number;
    /** Kilometres in a petrol car that give off as much (an estimate). */
    carKm: number;
    importKwh: number;
    /** Location-based Scope 2 estimate: grid electricity bought times the grid factor. */
    gridCo2Kg: number;
  };
  /** Everything since commissioning, from the inverter's lifetime generation counter (null when it does not report one). */
  sinceCommissioning: { pvKwh: number; co2AvoidedKg: number } | null;
  months: CarbonMonth[];
  daily: CarbonDay[];
  gaps: DayGap[];
}

type Input = Pick<ReportsBase, "customerName" | "siteName" | "deviceLabel" | "deviceId" | "generatedAt" | "today" | "days" | "lifetime" | "co2KgPerKwh" | "co2Note">;

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthLabel = (month: string) => `${MONTH_SHORT[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;

/** The financial year (April to March) a day belongs to, as the year it starts in. */
export const financialYearOf = (day: string): number => {
  const y = Number(day.slice(0, 4));
  return Number(day.slice(5, 7)) >= 4 ? y : y - 1;
};

const fyLabel = (y: number) => `FY ${y}-${String(y + 1).slice(2)}`;

/**
 * What the pack can be made for, newest first: each financial year that has readings, then everything on file. The history on file is the last two years of daily
 * figures, so an older year shows how complete it is rather than pretending to be whole.
 */
export function carbonPeriods(days: DayEnergy[], today: string): CarbonPeriod[] {
  if (days.length === 0) return [];
  const years = [...new Set(days.map((d) => financialYearOf(d.day)))].sort((a, b) => b - a);
  const out: CarbonPeriod[] = years.map((y) => {
    const end = `${y + 1}-03-31`;
    const partial = end > today;
    return { id: `fy-${y}`, label: `${fyLabel(y)}${partial ? " (so far)" : ""}`, from: `${y}-04-01`, to: partial ? today : end, partial };
  });
  const first = days.reduce((m, d) => (d.day < m ? d.day : m), days[0].day);
  out.push({ id: "all", label: "All history on file", from: first, to: today, partial: true });
  return out;
}

/** The months (YYYY-MM) a period touches, oldest first. */
function monthsOf(from: string, to: string): string[] {
  const out: string[] = [];
  let y = Number(from.slice(0, 4));
  let m = Number(from.slice(5, 7));
  const last = to.slice(0, 7);
  for (;;) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    out.push(key);
    if (key >= last) break;
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

const compact = (day: string) => day.replace(/-/g, "");

/** The pack for one period. `periodId` must be one of carbonPeriods(); an unknown id gives null. */
export function buildCarbonPack(base: Input, periodId: string): CarbonPack | null {
  const period = carbonPeriods(base.days, base.today).find((p) => p.id === periodId);
  if (!period) return null;
  const f = base.co2KgPerKwh;
  const rows = base.days.filter((d) => d.day >= period.from && d.day <= period.to);
  const pv = (d: DayEnergy) => Math.max(0, d.pvKwh ?? 0);

  const months: CarbonMonth[] = monthsOf(period.from, period.to).map((month) => {
    const b = monthBounds(month);
    const from = b.from < period.from ? period.from : b.from;
    const to = b.to > period.to ? period.to : b.to;
    const inMonth = rows.filter((d) => d.day >= from && d.day <= to);
    const pvKwh = inMonth.reduce((s, d) => s + pv(d), 0);
    const importKwh = inMonth.reduce((s, d) => s + Math.max(0, d.importKwh), 0);
    return { month, label: monthLabel(month), days: inMonth.length, daysInPeriod: daysInclusive(from, to), pvKwh, co2AvoidedKg: pvKwh * f, importKwh, gridCo2Kg: importKwh * f };
  });

  const pvKwh = rows.reduce((s, d) => s + pv(d), 0);
  const importKwh = rows.reduce((s, d) => s + Math.max(0, d.importKwh), 0);
  const co2AvoidedKg = pvKwh * f;
  const daysInPeriod = daysInclusive(period.from, period.to);
  const key = period.id.startsWith("fy-") ? `FY${period.id.slice(3)}${period.partial ? `-${compact(period.to)}` : ""}` : `ALL-${compact(period.to)}`;
  const device = (base.deviceId ?? "SITE").replace(/-/g, "").slice(0, 6).toUpperCase();

  return {
    id: `WTC-${key}-${device}`,
    methodVersion: CARBON_METHOD_VERSION,
    period,
    customerName: base.customerName,
    siteName: base.siteName,
    deviceLabel: base.deviceLabel,
    generatedAt: base.generatedAt,
    factor: { kgPerKwh: f, note: base.co2Note },
    totals: {
      days: rows.length,
      daysInPeriod,
      completeness: completenessPct(rows.length, period.from, period.to),
      pvKwh,
      co2AvoidedKg,
      trees: treesEquivalent(co2AvoidedKg),
      carKm: co2AvoidedKg / PETROL_CAR.kgPerKm,
      importKwh,
      gridCo2Kg: importKwh * f,
    },
    sinceCommissioning: base.lifetime && base.lifetime.pvKwh > 0 ? { pvKwh: base.lifetime.pvKwh, co2AvoidedKg: base.lifetime.pvKwh * f } : null,
    months,
    daily: rows.map((d) => ({ day: d.day, pvKwh: pv(d), importKwh: Math.max(0, d.importKwh), co2AvoidedKg: pv(d) * f })),
    gaps: daysWithoutReadings(rows, period.from, period.to, base.today),
  };
}

/** CO2 in the unit that reads best: "412 kg", "38.5 kg", "1.24 t". */
export function fmtCo2(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(2)} t`;
  return `${kg.toFixed(kg >= 100 ? 0 : 1)} kg`;
}
