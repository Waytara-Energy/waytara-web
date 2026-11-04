/** What the Monitoring page's EV tab works out from the charger's session rows. Pure functions, tested without a database. */

import { curvePoints, sessionEnergyKwh, formatSeconds, type EvSampleRow, type EvSessionRow, type SourceShare } from "./ev-sessions";

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
  /** only read for the session that is running (the live tiles) */
  target_kwh?: number | null;
  energy_from_solar_kwh?: number | null;
  energy_from_battery_kwh?: number | null;
  energy_from_grid_kwh?: number | null;
  energy_unattributed_kwh?: number | null;
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

/** The charger's own energy count (kWh) when the running session began: its meter reading, or the older energy reading. Null when unknown. */
export function sessionStartKwh(s: Pick<TabSession, "meter_start_wh" | "start_energy_kwh">): number | null {
  if (s.meter_start_wh !== null) return s.meter_start_wh / 1000;
  return s.start_energy_kwh;
}

export interface LiveInput {
  kw: number | null;
  /** the charger's energy count now (kWh) and when the session began (kWh), so the difference is this charge */
  registerKwh: number | null;
  startKwh: number | null;
  ratedKw: number | null;
  targetKwh: number | null;
  startedAt: string | null;
  charging: boolean;
  now: number;
}

export interface LiveFigures {
  /** the power as a share of the charger's rating, 0 to 100 */
  powerPct: number | null;
  sessionKwh: number | null;
  /** this charge as a share of the target, 0 to 100 (null without a target) */
  progressPct: number | null;
  elapsedMin: number | null;
  /** minutes to the target at the present power (null without a target or without power) */
  remainingMin: number | null;
}

const clampPct = (v: number) => Math.max(0, Math.min(100, v));

/** What the live tiles of the EV tab show for the charge that is running. Nothing is made up: without a charge every figure is null. */
export function evLiveFigures(i: LiveInput): LiveFigures {
  if (!i.charging) return { powerPct: null, sessionKwh: null, progressPct: null, elapsedMin: null, remainingMin: null };
  const sessionKwh = i.registerKwh !== null && i.startKwh !== null ? Math.max(0, i.registerKwh - i.startKwh) : null;
  const target = i.targetKwh !== null && i.targetKwh > 0 ? i.targetKwh : null;
  const started = i.startedAt ? Date.parse(i.startedAt) : NaN;
  return {
    powerPct: i.kw !== null && i.ratedKw !== null && i.ratedKw > 0 ? clampPct((i.kw / i.ratedKw) * 100) : null,
    sessionKwh,
    progressPct: target !== null && sessionKwh !== null ? clampPct((sessionKwh / target) * 100) : null,
    elapsedMin: Number.isFinite(started) ? Math.max(0, Math.round((i.now - started) / 60_000)) : null,
    remainingMin: target !== null && sessionKwh !== null && i.kw !== null && i.kw > 0.2 ? Math.max(0, Math.round(((target - sessionKwh) / i.kw) * 60)) : null,
  };
}

/** "58 min" / "1 h 05 min". */
export function minutesText(min: number): string {
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")} min`;
}

export interface TodayPoint {
  t: number;
  kw: number | null;
  solar: number | null;
  battery: number | null;
  grid: number | null;
}

/** Today's charging as one chart series: each session's samples in time order, with an empty point after each session so the line stops between charges instead of joining them. */
export function todayChartPoints(sessions: readonly EvSampleRow[][]): TodayPoint[] {
  const out: TodayPoint[] = [];
  for (const rows of sessions) {
    const pts = curvePoints([...rows]);
    if (pts.length === 0) continue;
    out.push(...pts);
    out.push({ t: pts[pts.length - 1].t + 1000, kw: null, solar: null, battery: null, grid: null });
  }
  out.sort((a, b) => a.t - b.t);
  while (out.length > 0 && out[out.length - 1].kw === null) out.pop();
  return out;
}

export type { EvSessionRow, SourceShare };
