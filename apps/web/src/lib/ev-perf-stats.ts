// What the Performance and Reports pages say about an EV charger over a period, worked out from its charging sessions (the ev_sessions table). Pure
// functions, so the figures are tested without a database. Test sessions (made by the simulator) are left out, and an unknown figure stays unknown.

import { sessionEnergyKwh } from "./ev-sessions";

const DAY_MS = 86_400_000;
const IST_MS = 19_800_000;
const istDate = (ms: number) => new Date(ms + IST_MS).toISOString().slice(0, 10);

/** The columns of ev_sessions these pages read. */
export const EV_PERF_COLUMNS =
  "id, started_at, ended_at, status, source, is_test, stop_reason, start_energy_kwh, end_energy_kwh, meter_start_wh, meter_stop_wh, peak_power_kw, avg_power_kw, charging_seconds, energy_from_solar_kwh, energy_from_battery_kwh, energy_from_grid_kwh, energy_unattributed_kwh, solar_share_pct";

export interface EvPerfSession {
  id: string;
  started_at: string;
  ended_at: string | null;
  status: string;
  source: string | null;
  is_test: boolean | null;
  stop_reason: string | null;
  start_energy_kwh: number | null;
  end_energy_kwh: number | null;
  meter_start_wh: number | null;
  meter_stop_wh: number | null;
  peak_power_kw: number | null;
  avg_power_kw: number | null;
  charging_seconds: number | null;
  energy_from_solar_kwh: number | null;
  energy_from_battery_kwh: number | null;
  energy_from_grid_kwh: number | null;
  energy_unattributed_kwh: number | null;
  solar_share_pct: number | null;
}

/** The window of a period: from the first millisecond of its first day to the start of the day after its last (both in India time). */
export interface EvSpan {
  fromMs: number;
  /** Exclusive. */
  toMs: number;
}

export interface EvRow {
  id: string;
  startedAt: string;
  endedAt: string | null;
  energyKwh: number | null;
  /** From the charger's own count of charging seconds, else from the start and end times; null while the session is open and has no count. */
  durationS: number | null;
  peakKw: number | null;
  avgKw: number | null;
  solarSharePct: number | null;
  status: string;
  stopReason: string | null;
}

export interface EvCost {
  /** The tariff the figures are priced on, rupees per kWh. */
  rate: number;
  /** What the grid part of the charging cost (energy with no source split counts as grid). */
  gridCost: number;
  /** What the solar and battery part would have cost from the grid. */
  saved: number;
  /** What all of it would have cost from the grid. */
  allGridCost: number;
}

export interface EvPerfStats {
  sessions: number;
  energyKwh: number;
  /** Sessions whose energy is not known are not in the average. */
  avgSessionKwh: number | null;
  peakKw: number | null;
  /** The energy-weighted average of the sessions' average power. */
  avgKw: number | null;
  chargingSeconds: number;
  sources: { solarKwh: number; batteryKwh: number; gridKwh: number; unknownKwh: number };
  /** Solar's share of the energy whose source is known; null when no session has a split. */
  solarSharePct: number | null;
  /** Every day of the period with its energy (a day with no charging is 0). */
  daily: { date: string; value: number }[];
  rows: EvRow[];
  cost: EvCost | null;
}

const num = (v: number | null | undefined): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

function durationOf(s: EvPerfSession): number | null {
  const counted = num(s.charging_seconds);
  if (counted !== null) return counted;
  if (!s.ended_at) return null;
  const d = (Date.parse(s.ended_at) - Date.parse(s.started_at)) / 1000;
  return Number.isFinite(d) && d >= 0 ? d : null;
}

/** The days of a span as YYYY-MM-DD, oldest first. */
export function spanDays(span: EvSpan): string[] {
  const out: string[] = [];
  for (let t = span.fromMs; t < span.toMs && out.length < 800; t += DAY_MS) out.push(istDate(t));
  return out;
}

/** The span of two India days, both included (YYYY-MM-DD). */
export function spanOfDays(from: string, to: string): EvSpan {
  return { fromMs: Date.parse(`${from}T00:00:00+05:30`), toMs: Date.parse(`${to}T00:00:00+05:30`) + DAY_MS };
}

/**
 * The figures of the sessions that started inside `span`. `rate` (rupees per kWh) prices them; without one there is no cost.
 */
export function evPerfStats(all: readonly EvPerfSession[], span: EvSpan, rate: number | null = null): EvPerfStats {
  const inSpan = all.filter((s) => !s.is_test && s.source !== "simulated").filter((s) => {
    const t = Date.parse(s.started_at);
    return t >= span.fromMs && t < span.toMs;
  });
  const days = new Map(spanDays(span).map((d) => [d, 0]));
  let energy = 0;
  let counted = 0;
  let peak: number | null = null;
  let weighted = 0;
  let weight = 0;
  let seconds = 0;
  const src = { solarKwh: 0, batteryKwh: 0, gridKwh: 0, unknownKwh: 0 };
  let anySplit = false;

  const rows: EvRow[] = inSpan
    .slice()
    .sort((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at))
    .map((s) => {
      const e = sessionEnergyKwh(s);
      const dur = durationOf(s);
      if (e !== null) {
        energy += e;
        counted++;
        const day = istDate(Date.parse(s.started_at));
        days.set(day, (days.get(day) ?? 0) + e);
        const avg = num(s.avg_power_kw);
        if (avg !== null && e > 0) {
          weighted += avg * e;
          weight += e;
        }
      }
      const p = num(s.peak_power_kw);
      if (p !== null) peak = peak === null ? p : Math.max(peak, p);
      if (dur !== null) seconds += dur;
      const solar = num(s.energy_from_solar_kwh);
      const battery = num(s.energy_from_battery_kwh);
      const grid = num(s.energy_from_grid_kwh);
      if (solar !== null || battery !== null || grid !== null) {
        anySplit = true;
        src.solarKwh += solar ?? 0;
        src.batteryKwh += battery ?? 0;
        src.gridKwh += grid ?? 0;
        src.unknownKwh += num(s.energy_unattributed_kwh) ?? 0;
      }
      return {
        id: s.id,
        startedAt: s.started_at,
        endedAt: s.ended_at,
        energyKwh: e,
        durationS: dur,
        peakKw: p,
        avgKw: num(s.avg_power_kw),
        solarSharePct: num(s.solar_share_pct),
        status: s.status,
        stopReason: s.stop_reason,
      };
    });

  const known = src.solarKwh + src.batteryKwh + src.gridKwh;
  const cost: EvCost | null =
    rate !== null && rate > 0
      ? {
          rate,
          gridCost: (src.gridKwh + src.unknownKwh + (anySplit ? 0 : energy)) * rate,
          saved: (src.solarKwh + src.batteryKwh) * rate,
          allGridCost: energy * rate,
        }
      : null;

  return {
    sessions: inSpan.length,
    energyKwh: energy,
    avgSessionKwh: counted > 0 ? energy / counted : null,
    peakKw: peak,
    avgKw: weight > 0 ? weighted / weight : null,
    chargingSeconds: seconds,
    sources: src,
    solarSharePct: anySplit && known > 0 ? (src.solarKwh / known) * 100 : null,
    daily: [...days].map(([date, value]) => ({ date, value })),
    rows,
    cost,
  };
}

/** The charging as a share of the home's energy use over the same days (the load counter normally includes the charger). Null when the load is not known. */
export function chargingShareOfLoadPct(evKwh: number, loadKwh: number | null): number | null {
  if (loadKwh === null || !Number.isFinite(loadKwh) || loadKwh <= 0) return null;
  return Math.min(100, (evKwh / loadKwh) * 100);
}

/** The home's energy use over a span, from one value per day (the inverter's day counter). Null when no day in the span has one. */
export function loadKwhInSpan(daily: readonly { ts: string; value: number }[], span: EvSpan): number | null {
  let sum = 0;
  let any = false;
  for (const d of daily) {
    const t = Date.parse(d.ts);
    if (t >= span.fromMs && t < span.toMs && Number.isFinite(d.value)) {
      sum += d.value;
      any = true;
    }
  }
  return any ? sum : null;
}
