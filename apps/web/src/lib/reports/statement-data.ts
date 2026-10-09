// What one month's statement says, worked out from the report base (see gather.ts). Pure, so the PDF and its tests share it.

import { treesEquivalent } from "@/lib/environmental-impact";
import type { DayEnergy } from "@/lib/savings";
import type { ReportsBase } from "./gather";
import { addDays, completenessPct, daysIn, daysInclusive, lastYearWindow, monthBounds, periodBill, summarize, type EnergySummary, type PeriodBill } from "./period-math";

export interface StatementData {
  month: string;
  /** "October 2026" */
  label: string;
  from: string;
  /** The last day covered: the month's end, or today when the month is not over. */
  to: string;
  /** The month is not over yet: the figures are "so far". */
  partial: boolean;
  customerName: string;
  siteName: string | null;
  deviceLabel: string | null;
  generatedAt: string;
  current: EnergySummary;
  /** The month before, and the same month a year ago; null when there are no readings in it. */
  previous: EnergySummary | null;
  lastYear: EnergySummary | null;
  bill: PeriodBill;
  co2Kg: number;
  trees: number;
  daily: DayEnergy[];
  completeness: number;
  savedSinceCommissioning: number | null;
  tariffNote: string;
  tariffIndicative: boolean;
  co2Note: string;
}

type Input = Pick<ReportsBase, "customerName" | "siteName" | "deviceLabel" | "generatedAt" | "today" | "days" | "months" | "lifetimeBill" | "tariffNote" | "tariffIndicative" | "co2KgPerKwh" | "co2Note">;

const minDay = (a: string, b: string) => (a < b ? a : b);
/** YYYY-MM plus a number of months. */
function shiftMonth(month: string, n: number): string {
  const d = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

const monthLabel = (month: string) => new Date(`${month}-15T00:00:00Z`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });

export function buildStatement(base: Input, month: string): StatementData {
  const bounds = monthBounds(month);
  const to = bounds.to > base.today ? base.today : bounds.to;
  const partial = bounds.to > base.today;
  // The month before, over the same number of days (a month in progress is compared with the same days of the last one, not with
  // all of it), and the same dates a year ago.
  const prevStart = monthBounds(shiftMonth(month, -1));
  const prevWin = { from: prevStart.from, to: minDay(addDays(prevStart.from, daysInclusive(bounds.from, to) - 1), prevStart.to) };
  const yearWin = lastYearWindow(bounds.from, to);

  const daily = daysIn(base.days, bounds.from, to);
  const current = summarize(daily);
  const earlier = (w: { from: string; to: string }) => {
    const rows = daysIn(base.days, w.from, w.to);
    return rows.length > 0 ? summarize(rows) : null;
  };
  const co2Kg = current.pvKwh * base.co2KgPerKwh;
  return {
    month,
    label: monthLabel(month),
    from: bounds.from,
    to,
    partial,
    customerName: base.customerName,
    siteName: base.siteName,
    deviceLabel: base.deviceLabel,
    generatedAt: base.generatedAt,
    current,
    previous: earlier(prevWin),
    lastYear: earlier(yearWin),
    bill: periodBill(base.months, base.days, bounds.from, to),
    co2Kg,
    trees: treesEquivalent(co2Kg),
    daily,
    completeness: completenessPct(daily.length, bounds.from, to),
    savedSinceCommissioning: base.lifetimeBill?.saved ?? null,
    tariffNote: base.tariffNote,
    tariffIndicative: base.tariffIndicative,
    co2Note: base.co2Note,
  };
}
