// What a report says about a stretch of days: the energy added up, how it was used, how it compares with the stretch before, and
// what the bills were. Pure functions over the day rows (see solar-history.ts), so the page, the PDF and the CSV agree.

import { selfConsumptionPct, selfSufficiencyPct } from "@/lib/performance-metrics";
import type { Bill, DayEnergy, MonthRow } from "@/lib/savings";

const DAY_MS = 86_400_000;

/** YYYY-MM-DD plus a number of days. */
export function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

/** Days from `from` to `to`, both included. */
export function daysInclusive(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS) + 1;
}

/** The same number of days straight before [from, to]. */
export function previousWindow(from: string, to: string): { from: string; to: string } {
  const n = daysInclusive(from, to);
  return { from: addDays(from, -n), to: addDays(from, -1) };
}

/** The same dates a year earlier. */
export function lastYearWindow(from: string, to: string): { from: string; to: string } {
  const shift = (d: string) => `${Number(d.slice(0, 4)) - 1}${d.slice(4)}`;
  return { from: shift(from), to: shift(to) };
}

export function daysIn(days: DayEnergy[], from: string, to: string): DayEnergy[] {
  return days.filter((d) => d.day >= from && d.day <= to);
}

export interface EnergySummary {
  /** Days that have a reading. */
  days: number;
  pvKwh: number;
  loadKwh: number;
  importKwh: number;
  exportKwh: number;
  /** Share of the solar energy used on site (not sent to the grid). */
  selfUsePct: number | null;
  /** Share of what the site used that did not come from the grid. */
  selfSufficiencyPct: number | null;
  avgPvPerDay: number | null;
  best: { day: string; kwh: number } | null;
  lowest: { day: string; kwh: number } | null;
}

export function summarize(rows: DayEnergy[]): EnergySummary {
  const sum = rows.reduce(
    (s, d) => ({ pv: s.pv + (d.pvKwh ?? 0), load: s.load + d.loadKwh, imp: s.imp + d.importKwh, exp: s.exp + d.exportKwh }),
    { pv: 0, load: 0, imp: 0, exp: 0 }
  );
  const withPv = rows.filter((d) => (d.pvKwh ?? 0) > 0);
  const best = withPv.reduce<EnergySummary["best"]>((b, d) => (b === null || (d.pvKwh ?? 0) > b.kwh ? { day: d.day, kwh: d.pvKwh ?? 0 } : b), null);
  const lowest = withPv.reduce<EnergySummary["lowest"]>((b, d) => (b === null || (d.pvKwh ?? 0) < b.kwh ? { day: d.day, kwh: d.pvKwh ?? 0 } : b), null);
  return {
    days: rows.length,
    pvKwh: sum.pv,
    loadKwh: sum.load,
    importKwh: sum.imp,
    exportKwh: sum.exp,
    selfUsePct: selfConsumptionPct(sum.pv, sum.exp),
    selfSufficiencyPct: selfSufficiencyPct(sum.load, sum.imp),
    avgPvPerDay: rows.length > 0 ? sum.pv / rows.length : null,
    best,
    lowest,
  };
}

/** Percent change from `previous` to `current`; null when there is nothing to compare with. */
export function pctChange(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

/** How much of the period has readings: 0-100. */
export function completenessPct(daysWithData: number, from: string, to: string): number {
  const n = daysInclusive(from, to);
  return n <= 0 ? 0 : Math.min(100, Math.round((daysWithData / n) * 100));
}

export interface PeriodBill extends Bill {
  /** Every month the period touches is covered completely, so these are the bills as they were worked out (not shares of them). */
  exact: boolean;
}

/** The bills for a stretch of days: each month it touches contributes its bill, in proportion to how many of that month's days
 *  with readings fall inside the stretch. A whole month (or whole months) is therefore exactly Performance's figure; a part of a
 *  month is that month's bill's share - an estimate, since a month is billed on its own units. */
export function periodBill(months: MonthRow[], days: DayEnergy[], from: string, to: string): PeriodBill {
  const total: Bill = { withoutSolar: 0, withSolar: 0, avoided: 0, exportIncome: 0, saved: 0, banked: 0 };
  let exact = true;
  for (const m of months) {
    const monthDays = days.filter((d) => d.day.slice(0, 7) === m.month);
    const inside = monthDays.filter((d) => d.day >= from && d.day <= to).length;
    if (inside === 0) continue;
    const share = monthDays.length > 0 ? inside / monthDays.length : 0;
    if (inside !== monthDays.length) exact = false;
    total.withoutSolar += m.bill.withoutSolar * share;
    total.withSolar += m.bill.withSolar * share;
    total.avoided += m.bill.avoided * share;
    total.exportIncome += m.bill.exportIncome * share;
    total.saved += m.bill.saved * share;
    total.banked = m.bill.banked;
  }
  const r = (n: number) => Math.round(n * 100) / 100;
  return { withoutSolar: r(total.withoutSolar), withSolar: r(total.withSolar), avoided: r(total.avoided), exportIncome: r(total.exportIncome), saved: r(total.saved), banked: total.banked, exact };
}

/** The calendar months (YYYY-MM) that have readings, newest first. */
export function monthsWithData(days: DayEnergy[]): string[] {
  return [...new Set(days.map((d) => d.day.slice(0, 7)))].sort().reverse();
}

/** First and last day of a YYYY-MM month. */
export function monthBounds(month: string): { from: string; to: string } {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  return { from: `${month}-01`, to: new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10) };
}
