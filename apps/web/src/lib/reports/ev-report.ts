// The EV charging report: one charger over a period of days, as figures, a table of its sessions, and a CSV file. Pure, so it is tested without a database;
// ev-report-pdf.tsx draws the same thing as a PDF and ev-report-data.ts reads the sessions.

import { evPerfStats, spanOfDays, type EvPerfSession, type EvPerfStats } from "@/lib/ev-perf-stats";
import { formatSeconds, sessionStatusLabel, stopReasonLabel } from "@/lib/ev-sessions";
import { daysInclusive } from "./period-math";
import { filterEvSessions, filtersNote, NO_EV_FILTERS, type EvReportFilters, type EvReportMode } from "./ev-filters";

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
  /** What the report is narrowed to; none by default. */
  filters?: EvReportFilters;
}

export interface EvReport extends Omit<EvReportInput, "sessions" | "filters"> {
  days: number;
  stats: EvPerfStats;
  filters: EvReportFilters;
  /** The filters in words (empty when nothing is filtered). */
  filterNotes: string[];
}

export function buildEvReport(input: EvReportInput): EvReport {
  const { sessions, filters = NO_EV_FILTERS, ...rest } = input;
  const kept = filterEvSessions(sessions, filters);
  return { ...rest, filters, filterNotes: filtersNote(filters), days: daysInclusive(input.from, input.to), stats: evPerfStats(kept, spanOfDays(input.from, input.to), input.tariffRate) };
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

export const EV_DAILY_CSV_HEADER = ["Day", "Charging sessions", "Energy kWh", "Solar kWh", "Battery kWh", "Grid kWh", "Not matched to a source kWh", "Charging time min", "Peak kW", "Paid to the grid Rs.", "Saved by solar and battery Rs."];

/** The days of the period that had a charge, oldest first (a day with none is not a row). */
export const evChargingDays = (r: EvReport) => r.stats.dayFigures.filter((d) => d.sessions > 0);

/** One row per day with a charge, then the total; for a statement, also the bill: what the grid part cost and what solar and battery saved. */
function evDailyCsv(r: EvReport, statement: boolean): string {
  const s = r.stats;
  const lines: (string | number)[][] = [];
  if (statement) {
    lines.push(["EV charging statement", `${r.from} to ${r.to}`], ["Customer", r.customerName], ["Site", r.siteName ?? ""], ["Charger", r.deviceLabel ?? ""]);
    for (const note of r.filterNotes) lines.push(["Filter", note]);
    lines.push([]);
  }
  lines.push(EV_DAILY_CSV_HEADER);
  for (const d of evChargingDays(r)) {
    lines.push([d.date, d.sessions, n(d.energyKwh), n(d.solarKwh), n(d.batteryKwh), n(d.gridKwh), n(d.unknownKwh), Math.round(d.chargingSeconds / 60), n(d.peakKw, 1), n(d.gridCost), n(d.saved)]);
  }
  lines.push(["Total", s.sessions, n(s.energyKwh), n(s.sources.solarKwh), n(s.sources.batteryKwh), n(s.sources.gridKwh), n(s.sources.unknownKwh), Math.round(s.chargingSeconds / 60), n(s.peakKw, 1), s.cost ? s.cost.gridCost.toFixed(2) : "", s.cost ? s.cost.saved.toFixed(2) : ""]);
  if (statement && s.cost) {
    lines.push([], [`Estimated at Rs. ${s.cost.rate.toFixed(2)} per kWh${r.tariffNote ? ` (${r.tariffNote})` : ""}`]);
    lines.push(["Paid to the grid, Rs.", s.cost.gridCost.toFixed(2)], ["Saved by solar and battery, Rs.", s.cost.saved.toFixed(2)], ["If all from the grid, Rs.", s.cost.allGridCost.toFixed(2)]);
  }
  return lines.map((l) => l.map(cell).join(",")).join("\r\n");
}

/** The report as CSV: a row per session (oldest first), then the totals, and what the energy cost when a tariff is known. */
export function evReportCsv(r: EvReport, mode: EvReportMode = "sessions"): string {
  if (mode !== "sessions") return evDailyCsv(r, mode === "statement");
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
