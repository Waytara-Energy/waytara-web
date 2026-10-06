import type { DayReport } from "@/lib/report-day-data";

const esc = (cell: string | number) => `"${String(cell).replace(/"/g, '""')}"`;

/** One row per bucket for the whole window (a day, or up to 90 days), 00:00 to 23:59, one column per series.
 *  Empty cell = the device reported nothing in that bucket (never a made-up 0).
 *  A leading BOM keeps Excel from mangling the degree sign. */
export function dayReportCsv(report: DayReport): string {
  const header = ["Date", "Time (IST)", ...report.type.series.map((s) => `${s.label} (${s.unit})`)];
  const rows = report.points.map((p) => [
    p.time.slice(0, 10),
    p.time.slice(11, 16),
    ...report.type.series.map((s) => {
      const v = p[s.id];
      return typeof v === "number" ? v.toFixed(s.unit === "kW" ? 3 : 1) : "";
    }),
  ]);
  return "﻿" + [header, ...rows].map((r) => r.map(esc).join(",")).join("\r\n");
}
