// The day-by-day energy of a period as CSV (for a spreadsheet): one row per day with a reading, and a total row at the end.

import { selfConsumptionPct, selfSufficiencyPct } from "@/lib/performance-metrics";
import type { DayEnergy } from "@/lib/savings";
import { summarize } from "./period-math";

const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
const kwh = (n: number) => n.toFixed(2);
const pct = (n: number | null) => (n === null ? "" : n.toFixed(0));

export const PERIOD_CSV_HEADER = ["Date", "Generated kWh", "Used kWh", "Bought from grid kWh", "Sent to grid kWh", "Solar used on site %", "Home covered by solar %"];

export function periodCsv(rows: DayEnergy[]): string {
  const lines: (string | number)[][] = [PERIOD_CSV_HEADER];
  for (const d of rows) {
    lines.push([d.day, kwh(d.pvKwh ?? 0), kwh(d.loadKwh), kwh(d.importKwh), kwh(d.exportKwh), pct(selfConsumptionPct(d.pvKwh ?? 0, d.exportKwh)), pct(selfSufficiencyPct(d.loadKwh, d.importKwh))]);
  }
  const t = summarize(rows);
  lines.push(["Total", kwh(t.pvKwh), kwh(t.loadKwh), kwh(t.importKwh), kwh(t.exportKwh), pct(t.selfUsePct), pct(t.selfSufficiencyPct)]);
  return lines.map((l) => l.map(cell).join(",")).join("\r\n");
}
