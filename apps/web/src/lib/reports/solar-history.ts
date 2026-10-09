// The day-by-day energy of a solar inverter and the monthly bills worked out from it - the one place the Reports page, the
// statement PDF and Performance's Cost & Savings get them, so their numbers cannot drift apart. Pure functions over the rows the
// daily rollup returns.

import { istDate } from "@/lib/telemetry/combine";
import { DAY_KEYS, LIFETIME_KEYS } from "@/lib/performance-metrics";
import { byMonth, olderSavings, priceMonths, sumBills, type Bill, type DayEnergy, type MonthRow, type Rates, type TimelineEntry } from "@/lib/savings";

export interface DailyRow {
  key_name: string;
  value: number | null;
  ts: string;
}

/** Rollup rows (one reading per day per counter) -> one energy row per day, oldest first. */
export function daysFromRows(rows: DailyRow[]): DayEnergy[] {
  const byDay = new Map<string, DayEnergy>();
  for (const r of rows) {
    if (r.value === null) continue;
    const day = istDate(new Date(r.ts).getTime());
    const d = byDay.get(day) ?? { day, loadKwh: 0, importKwh: 0, exportKwh: 0, pvKwh: 0 };
    if (r.key_name === DAY_KEYS.load) d.loadKwh = r.value;
    else if (r.key_name === DAY_KEYS.imported) d.importKwh = r.value;
    else if (r.key_name === DAY_KEYS.exported) d.exportKwh = r.value;
    else if (r.key_name === DAY_KEYS.pv) d.pvKwh = r.value;
    else if (r.key_name === DAY_KEYS.charged) d.chargedKwh = r.value;
    else if (r.key_name === DAY_KEYS.discharged) d.dischargedKwh = r.value;
    byDay.set(day, d);
  }
  return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
}

export interface Lifetime {
  loadKwh: number;
  importKwh: number;
  exportKwh: number;
  pvKwh: number;
}

/** The inverter's lifetime counters (since commissioning), or null when the load/import/export ones are missing. */
export function lifetimeFrom(latest: Map<string, number | null | undefined>): Lifetime | null {
  const has = (k: string) => typeof latest.get(k) === "number";
  if (!(has(LIFETIME_KEYS.load) && has(LIFETIME_KEYS.imported) && has(LIFETIME_KEYS.exported))) return null;
  return {
    loadKwh: latest.get(LIFETIME_KEYS.load) as number,
    importKwh: latest.get(LIFETIME_KEYS.imported) as number,
    exportKwh: latest.get(LIFETIME_KEYS.exported) as number,
    pvKwh: (latest.get(LIFETIME_KEYS.pv) as number | undefined) ?? 0,
  };
}

/** Since commissioning = the months on file, each on its own bill, plus whatever the counters hold from before the history starts
 *  (priced at the tariff's typical rate - there is no month to put it in). */
export function lifetimeBillFor(days: DayEnergy[], months: MonthRow[], lifetime: Lifetime | null, rates: Rates): Bill | null {
  if (!lifetime) return null;
  const inWindow = days.reduce((s, d) => ({ loadKwh: s.loadKwh + d.loadKwh, importKwh: s.importKwh + d.importKwh, exportKwh: s.exportKwh + d.exportKwh }), { loadKwh: 0, importKwh: 0, exportKwh: 0 });
  const older = {
    loadKwh: Math.max(0, lifetime.loadKwh - inWindow.loadKwh),
    importKwh: Math.max(0, lifetime.importKwh - inWindow.importKwh),
    exportKwh: Math.max(0, lifetime.exportKwh - inWindow.exportKwh),
  };
  return sumBills([...months.map((m) => m.bill), olderSavings(older, rates)]);
}

/** Days -> priced months on the tariff in force then (the same call Performance makes). */
export function pricedMonths(days: DayEnergy[], timeline: TimelineEntry[], rates: Rates, today: string): MonthRow[] {
  return priceMonths(byMonth(days), timeline, rates, today);
}
