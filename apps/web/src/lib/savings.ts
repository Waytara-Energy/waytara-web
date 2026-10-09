// What solar saves a customer, as two bills: what they would have paid with no solar (everything the site used, bought from the
// grid) against what they pay with it (what they still buy, less what they sent back). Pure functions over the energy counters.
//
// A bill is worked out one MONTH at a time from the state's tariff - bands, free units, duty (see tariff-schedule.ts) - because
// the bands are per bill: a month's use is priced on its own, not as one lump. Where the utility nets export against import
// (no export rate on file), units sent beyond a month's purchases are carried to the next month until the financial year ends.

import { monthlyEnergyBill, typicalRate, type Schedule } from "./tariff-schedule";

export interface Energy {
  /** What the site used, kWh. */
  loadKwh: number;
  /** What it bought from the grid. */
  importKwh: number;
  /** What it sent to the grid. */
  exportKwh: number;
  /** What the panels made. */
  pvKwh?: number;
}

export interface Rates {
  /** The typical Rs per kWh; used for the bill only when there is no schedule. */
  rate: number;
  /** Rs per kWh a unit sent to the grid earns (when it is paid for, not netted). */
  exportRate: number;
  /** The bands, free units and duty; without one every unit costs `rate`. */
  schedule?: Schedule;
  /** Export is netted against import (and carried forward) instead of paid for. */
  netMetering?: boolean;
}

export interface Bill {
  /** Everything used, bought at the tariff. */
  withoutSolar: number;
  /** What is still paid after the solar: purchases at the tariff, less what the export earned (negative = a net credit). */
  withSolar: number;
  /** The bill that not buying the solar-made energy removed. */
  avoided: number;
  /** What the energy sent to the grid was worth (paid for, or the units it cancelled). */
  exportIncome: number;
  /** avoided + exportIncome. */
  saved: number;
  /** Units sent beyond this month's purchases, banked for the next month (net metering only). */
  banked: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** One month's bill with and without solar. `bankedIn` = units carried from earlier months (net metering). */
export function billModel(e: Energy, r: Rates, bankedIn = 0): Bill {
  const load = Math.max(0, e.loadKwh);
  const imported = Math.min(Math.max(0, e.importKwh), load);
  const exported = Math.max(0, e.exportKwh);

  if (!r.schedule) {
    const avoided = (load - imported) * r.rate;
    const exportIncome = exported * r.exportRate;
    const withoutSolar = load * r.rate;
    return { withoutSolar: round2(withoutSolar), withSolar: round2(withoutSolar - avoided - exportIncome), avoided: round2(avoided), exportIncome: round2(exportIncome), saved: round2(avoided + exportIncome), banked: 0 };
  }

  const bill = (units: number) => monthlyEnergyBill(r.schedule as Schedule, units);
  const withoutSolar = bill(load);
  const bought = bill(imported);
  const avoided = withoutSolar - bought;
  if (r.netMetering) {
    const net = imported - exported - Math.max(0, bankedIn);
    const withSolar = bill(Math.max(0, net));
    return { withoutSolar: round2(withoutSolar), withSolar: round2(withSolar), avoided: round2(avoided), exportIncome: round2(bought - withSolar), saved: round2(withoutSolar - withSolar), banked: Math.max(0, -net) };
  }
  const exportIncome = exported * r.exportRate;
  return { withoutSolar: round2(withoutSolar), withSolar: round2(bought - exportIncome), avoided: round2(avoided), exportIncome: round2(exportIncome), saved: round2(avoided + exportIncome), banked: 0 };
}

export interface DayEnergy extends Energy {
  /** YYYY-MM-DD */
  day: string;
  /** What went into / came out of the battery that day, when the inverter reports it. */
  chargedKwh?: number;
  dischargedKwh?: number;
}

/** Day rows -> one row per month (YYYY-MM), oldest first. */
export function byMonth(days: DayEnergy[]): { month: string; energy: Energy; days: number }[] {
  const months = new Map<string, { energy: Energy; days: number }>();
  for (const d of [...days].sort((a, b) => a.day.localeCompare(b.day))) {
    const key = d.day.slice(0, 7);
    const m = months.get(key) ?? { energy: { loadKwh: 0, importKwh: 0, exportKwh: 0, pvKwh: 0 }, days: 0 };
    m.energy.loadKwh += d.loadKwh;
    m.energy.importKwh += d.importKwh;
    m.energy.exportKwh += d.exportKwh;
    m.energy.pvKwh = (m.energy.pvKwh ?? 0) + (d.pvKwh ?? 0);
    m.days += 1;
    months.set(key, m);
  }
  return [...months.entries()].map(([month, v]) => ({ month, ...v }));
}

/** Months until the system has paid for itself at the recent pace; 0 once it has, null when the pace is not known yet. */
export function paybackMonths(invested: number, savedToDate: number, savedPerDay: number | null): number | null {
  if (invested <= 0) return null;
  const remaining = invested - savedToDate;
  if (remaining <= 0) return 0;
  if (savedPerDay === null || savedPerDay <= 0) return null;
  return remaining / (savedPerDay * 30);
}

/** The average saving per day over the last `last` days (days with a reading only), worked out as a month of that use so the
 *  bands apply as they would on a bill. Null with fewer than three days. */
export function recentSavedPerDay(days: DayEnergy[], r: Rates, last = 30): number | null {
  const recent = [...days].sort((a, b) => a.day.localeCompare(b.day)).slice(-last);
  if (recent.length < 3) return null;
  const sum = recent.reduce((s, d) => ({ loadKwh: s.loadKwh + d.loadKwh, importKwh: s.importKwh + d.importKwh, exportKwh: s.exportKwh + d.exportKwh }), { loadKwh: 0, importKwh: 0, exportKwh: 0 });
  const scale = 30 / recent.length;
  const month = billModel({ loadKwh: sum.loadKwh * scale, importKwh: sum.importKwh * scale, exportKwh: sum.exportKwh * scale }, { ...r, netMetering: false });
  return month.saved / 30;
}

/** "27 Oct 2026" style date for a YYYY-MM-DD string. */
export function fmtDate(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export const inr = (n: number) => `${n < 0 ? "-" : ""}₹${Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

/** One rate in force from a date (the timeline of a tariff, oldest first). */
export interface TimelineEntry extends Rates {
  effectiveFrom: string;
}

/** The rates in force on a day, from a timeline (oldest first). A day before the first one uses the first; no timeline uses the fallback. */
export function ratesOn(timeline: TimelineEntry[], day: string, fallback: Rates): Rates {
  if (timeline.length === 0) return fallback;
  let chosen = timeline[0];
  for (const t of timeline) if (t.effectiveFrom <= day) chosen = t;
  return { rate: chosen.rate, exportRate: chosen.exportRate, schedule: chosen.schedule, netMetering: chosen.netMetering };
}

export interface MonthRow {
  /** YYYY-MM */
  month: string;
  label: string;
  /** The bill that month, worked out on the tariff in force then. */
  bill: Bill;
  days: number;
  energy: Energy;
}

/** Months of day rows, each priced on the tariff in force at the end of it (or today, for the current month), oldest first.
 *  Units banked under net metering carry from month to month and are dropped when a new financial year (April) starts. */
export function priceMonths(months: { month: string; energy: Energy; days: number }[], timeline: TimelineEntry[], fallback: Rates, today: string): MonthRow[] {
  let banked = 0;
  return months.map((m) => {
    const last = new Date(Date.UTC(Number(m.month.slice(0, 4)), Number(m.month.slice(5, 7)), 0)).toISOString().slice(0, 10);
    const day = last > today ? today : last;
    if (m.month.slice(5, 7) === "04") banked = 0;
    const bill = billModel(m.energy, ratesOn(timeline, day, fallback), banked);
    banked = bill.banked;
    return {
      month: m.month,
      label: new Date(`${m.month}-15T00:00:00Z`).toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" }),
      bill,
      days: m.days,
      energy: m.energy,
    };
  });
}

/** Adds month bills up (lifetime / year totals). */
export function sumBills(bills: Bill[]): Bill {
  const total = bills.reduce(
    (s, b) => ({ withoutSolar: s.withoutSolar + b.withoutSolar, withSolar: s.withSolar + b.withSolar, avoided: s.avoided + b.avoided, exportIncome: s.exportIncome + b.exportIncome, saved: s.saved + b.saved, banked: b.banked }),
    { withoutSolar: 0, withSolar: 0, avoided: 0, exportIncome: 0, saved: 0, banked: 0 }
  );
  return { withoutSolar: round2(total.withoutSolar), withSolar: round2(total.withSolar), avoided: round2(total.avoided), exportIncome: round2(total.exportIncome), saved: round2(total.saved), banked: total.banked };
}

/** What a stretch of energy beyond the months on file (the counters count from commissioning, the history only a year) was worth, at
 *  the tariff's typical rate for every unit - there is no month to price it in. */
export function olderSavings(older: Energy, r: Rates): Bill {
  const flat = r.schedule ? typicalRate(r.schedule) : r.rate;
  return billModel(older, { rate: flat, exportRate: r.netMetering ? flat : r.exportRate });
}
