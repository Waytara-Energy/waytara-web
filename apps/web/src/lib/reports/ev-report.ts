// The EV charging report: one charger over a period of days, as figures, a table of its sessions, and a CSV file. Pure, so it is tested without a database;
// ev-report-pdf.tsx draws the same thing as a PDF and ev-report-data.ts reads the sessions.

import { evPerfStats, spanOfDays, type EvPerfSession, type EvPerfStats } from "@/lib/ev-perf-stats";
import { formatSeconds, sessionStatusLabel, stopReasonLabel } from "@/lib/ev-sessions";
import { daysInclusive } from "./period-math";

export interface EvReportInput {
  customerName: string;
  siteName: string | null;
  deviceLabel: string | null;
  generatedAt: string;
  /** The first and last day of the period, YYYY-MM-DD (India time), both included. */
  from: string;
  to: string;
  /** Rupees per kWh, when a tariff is known. */
  tariffRate: number | null;
  tariffNote: string;
  sessions: EvPerfSession[];
}

export interface EvReport extends Omit<EvReportInput, "sessions"> {
  days: number;
  stats: EvPerfStats;
}

export function buildEvReport(input: EvReportInput): EvReport {
  const { sessions, ...rest } = input;
  return { ...rest, days: daysInclusive(input.from, input.to), stats: evPerfStats(sessions, spanOfDays(input.from, input.to), input.tariffRate) };
}

const IST_MS = 19_800_000;
/** "2026-10-23 14:02" in India time. */
export const istStamp = (iso: string | null): string => {
  if (!iso) return "";
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t + IST_MS).toISOString().slice(0, 16).replace("T", " ") : "";
};

const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
const n = (v: number | null, digits = 2) => (v === null ? "" : v.toFixed(digits));

export const EV_CSV_HEADER = ["Started (IST)", "Ended (IST)", "Energy kWh", "Charging time min", "Peak kW", "Average kW", "Solar %", "Status", "Reason it stopped"];

/** The report as CSV: a row per session (oldest first), then the totals, and what the energy cost when a tariff is known. */
export function evReportCsv(r: EvReport): string {
  const s = r.stats;
  const lines: (string | number)[][] = [EV_CSV_HEADER];
  for (const row of s.rows.slice().reverse()) {
    lines.push([
      istStamp(row.startedAt),
      istStamp(row.endedAt),
      n(row.energyKwh),
      row.durationS === null ? "" : Math.round(row.durationS / 60),
      n(row.peakKw, 1),
      n(row.avgKw, 1),
      n(row.solarSharePct, 0),
      sessionStatusLabel(row.status).label,
      stopReasonLabel(row.stopReason) ?? "",
    ]);
  }
  lines.push(["Total", "", n(s.energyKwh), Math.round(s.chargingSeconds / 60), n(s.peakKw, 1), n(s.avgKw, 1), n(s.solarSharePct, 0), `${s.sessions} sessions`, ""]);
  if (s.cost) {
    lines.push([`Estimated at Rs. ${s.cost.rate.toFixed(2)} per kWh`, "", "", "", "", "", "", "", ""]);
    lines.push(["Paid to the grid, Rs.", "", s.cost.gridCost.toFixed(2)]);
    lines.push(["Saved by solar and battery, Rs.", "", s.cost.saved.toFixed(2)]);
    lines.push(["If all from the grid, Rs.", "", s.cost.allGridCost.toFixed(2)]);
  }
  return lines.map((l) => l.map(cell).join(",")).join("\r\n");
}

/** The figures of the summary, as label and value pairs (the page and the PDF show the same ones). */
export function evSummaryFigures(r: EvReport): { label: string; value: string }[] {
  const s = r.stats;
  const out = [
    { label: "Charging sessions", value: String(s.sessions) },
    { label: "Energy delivered", value: `${s.energyKwh.toFixed(1)} kWh` },
    { label: "Average per session", value: s.avgSessionKwh === null ? "-" : `${s.avgSessionKwh.toFixed(1)} kWh` },
    { label: "Charging time", value: s.sessions > 0 ? formatSeconds(s.chargingSeconds) : "-" },
    { label: "Peak power", value: s.peakKw === null ? "-" : `${s.peakKw.toFixed(1)} kW` },
    { label: "Solar share", value: s.solarSharePct === null ? "-" : `${s.solarSharePct.toFixed(0)}%` },
  ];
  if (s.cost) {
    out.push({ label: "Paid to the grid", value: `Rs. ${s.cost.gridCost.toFixed(0)}` }, { label: "Saved by solar and battery", value: `Rs. ${s.cost.saved.toFixed(0)}` });
  }
  return out;
}
