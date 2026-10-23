/** What the Monitoring page's EV tab works out from the charger's session rows. Pure functions, tested without a database. */

import { sessionEnergyKwh, formatSeconds, type EvSessionRow } from "./ev-sessions";

export interface TabSession {
  id: string;
  started_at: string;
  ended_at: string | null;
  status: string;
  ocpp_transaction_id: number | null;
  peak_power_kw: number | null;
  solar_share_pct: number | null;
  charging_seconds: number | null;
  meter_start_wh: number | null;
  meter_stop_wh: number | null;
  start_energy_kwh: number | null;
  end_energy_kwh: number | null;
}

/** The session that is running now (not ended), newest first when there are several; null when none is. */
export function openSession<T extends Pick<TabSession, "ended_at" | "started_at">>(rows: readonly T[]): T | null {
  const open = rows.filter((r) => r.ended_at === null);
  if (open.length === 0) return null;
  return open.reduce((a, b) => (Date.parse(b.started_at) > Date.parse(a.started_at) ? b : a));
}

/** The OCPP transaction number that "Stop" must name (the charger ends the charge by it); null when no session runs or its number is not known. */
export function openTransactionId(rows: readonly TabSession[]): number | null {
  return openSession(rows)?.ocpp_transaction_id ?? null;
}

/** "1h 5m" / "42m" between two moments (the end defaults to now). */
export function durationShort(startedAt: string, endedAt: string | null, now = Date.now()): string {
  const end = endedAt ? Date.parse(endedAt) : now;
  const minutes = Math.max(0, Math.round((end - Date.parse(startedAt)) / 60_000));
  const h = Math.floor(minutes / 60);
  return h > 0 ? `${h}h ${minutes % 60}m` : `${minutes}m`;
}

/** The figures of one row of the tab's session list. */
export interface TabSessionFigures {
  energyKwh: number | null;
  duration: string;
  peakKw: number | null;
  solarPct: number | null;
}

export function sessionFigures(s: TabSession, now = Date.now()): TabSessionFigures {
  return {
    energyKwh: sessionEnergyKwh(s),
    duration: s.charging_seconds !== null ? formatSeconds(s.charging_seconds) : durationShort(s.started_at, s.ended_at, now),
    peakKw: s.peak_power_kw,
    solarPct: s.solar_share_pct,
  };
}

/** Today's energy: the sum of what every session delivered (sessions with no known energy count as nothing). */
export function energyOfSessions(rows: readonly TabSession[]): number {
  return rows.reduce((sum, r) => sum + (sessionEnergyKwh(r) ?? 0), 0);
}

export type { EvSessionRow };
