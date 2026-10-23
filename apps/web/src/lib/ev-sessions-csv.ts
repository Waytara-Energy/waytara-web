import { sessionEnergyKwh, type EvSessionRow } from "./ev-sessions";

/** The charging sessions of a period as CSV (for a spreadsheet): one row per session, times in India time. */

export type CsvSession = Pick<
  EvSessionRow,
  | "id"
  | "started_at"
  | "ended_at"
  | "status"
  | "stop_reason"
  | "start_energy_kwh"
  | "end_energy_kwh"
  | "meter_start_wh"
  | "meter_stop_wh"
  | "peak_power_kw"
  | "avg_power_kw"
  | "max_current_a"
  | "charging_seconds"
  | "energy_from_solar_kwh"
  | "energy_from_battery_kwh"
  | "energy_from_grid_kwh"
  | "solar_share_pct"
  | "target_kwh"
>;

export const EV_SESSIONS_CSV_HEADER = [
  "Started (IST)",
  "Ended (IST)",
  "Status",
  "Energy kWh",
  "Charging time min",
  "Peak kW",
  "Average kW",
  "Max current A",
  "From solar kWh",
  "From battery kWh",
  "From grid kWh",
  "Solar share %",
  "Target kWh",
  "Stopped by",
];

const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
const num = (v: number | null, digits = 2) => (v === null ? "" : v.toFixed(digits));
const ist = (iso: string | null) => (iso === null ? "" : new Date(Date.parse(iso) + 19_800_000).toISOString().slice(0, 16).replace("T", " "));

export function evSessionsCsv(rows: readonly CsvSession[]): string {
  const lines: (string | number)[][] = [EV_SESSIONS_CSV_HEADER];
  for (const s of rows) {
    lines.push([
      ist(s.started_at),
      ist(s.ended_at),
      s.status,
      num(sessionEnergyKwh(s)),
      s.charging_seconds === null ? "" : (s.charging_seconds / 60).toFixed(1),
      num(s.peak_power_kw),
      num(s.avg_power_kw),
      num(s.max_current_a, 1),
      num(s.energy_from_solar_kwh),
      num(s.energy_from_battery_kwh),
      num(s.energy_from_grid_kwh),
      num(s.solar_share_pct, 0),
      num(s.target_kwh),
      s.stop_reason ?? "",
    ]);
  }
  return lines.map((l) => l.map(cell).join(",")).join("\r\n");
}
