// A custom report as CSV (for a spreadsheet): one row per day or month, one column per parameter under the name the customer gave
// it, then the totals and averages.

import { formatValue, type CustomReport } from "./custom-report";

const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
const num = (v: number | null) => (v === null ? "" : Number.isInteger(v) ? String(v) : v.toFixed(2));

export function customReportCsv(report: CustomReport): string {
  const head = [report.granularity === "month" ? "Month" : "Day", ...report.series.map((s) => `${s.label} ${s.unit}`)];
  const lines: (string | number)[][] = [head];
  report.buckets.forEach((b, i) => lines.push([b.key, ...report.series.map((s) => num(s.values[i]))]));
  lines.push([report.series.some((s) => s.unit === "%") ? "Total, percentages for the whole period" : "Total", ...report.series.map((s) => num(s.total))]);
  lines.push(["Average", ...report.series.map((s) => num(s.avg))]);
  lines.push(["Lowest", ...report.series.map((s) => num(s.min))]);
  lines.push(["Highest", ...report.series.map((s) => num(s.max))]);
  if (report.comparePrevious) {
    lines.push(["Period before, total", ...report.series.map((s) => num(s.previousTotal))]);
    lines.push(["Change", ...report.series.map((s) => (s.changePct === null ? "" : `${s.changePct.toFixed(0)}%`))]);
  }
  return lines.map((l) => l.map(cell).join(",")).join("\r\n");
}

/** A one-line summary of what the report says, for the e-mail body and the saved-report card. */
export function reportHeadline(report: CustomReport): string {
  const first = report.series[0];
  if (!first) return report.name;
  return `${first.label}: ${formatValue(first.total, first.unit)}${report.series.length > 1 ? ` (and ${report.series.length - 1} more)` : ""}`;
}
