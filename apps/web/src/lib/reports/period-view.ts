// Everything the Reports page shows for the period chosen at the top, worked out in the browser from the data the server sent once
// (so changing the period needs no new request).

import { treesEquivalent } from "@/lib/environmental-impact";
import type { DayEnergy } from "@/lib/savings";
import type { ReportsBase } from "./gather";
import { completenessPct, daysIn, daysInclusive, lastYearWindow, periodBill, previousWindow, summarize, type EnergySummary, type PeriodBill } from "./period-math";

export interface PeriodView {
  from: string;
  to: string;
  /** Days in the period (with or without readings). */
  length: number;
  rows: DayEnergy[];
  current: EnergySummary;
  previousWindow: { from: string; to: string };
  previous: EnergySummary | null;
  lastYearWindow: { from: string; to: string };
  lastYear: EnergySummary | null;
  bill: PeriodBill;
  co2Kg: number;
  trees: number;
  completeness: number;
}

type Input = Pick<ReportsBase, "days" | "months" | "co2KgPerKwh">;

export function buildPeriodView(base: Input, from: string, to: string): PeriodView {
  const rows = daysIn(base.days, from, to);
  const current = summarize(rows);
  const prevWin = previousWindow(from, to);
  const yearWin = lastYearWindow(from, to);
  const other = (w: { from: string; to: string }) => {
    const r = daysIn(base.days, w.from, w.to);
    return r.length > 0 ? summarize(r) : null;
  };
  const co2Kg = current.pvKwh * base.co2KgPerKwh;
  return {
    from,
    to,
    length: daysInclusive(from, to),
    rows,
    current,
    previousWindow: prevWin,
    previous: other(prevWin),
    lastYearWindow: yearWin,
    lastYear: other(yearWin),
    bill: periodBill(base.months, base.days, from, to),
    co2Kg,
    trees: treesEquivalent(co2Kg),
    completeness: completenessPct(rows.length, from, to),
  };
}
