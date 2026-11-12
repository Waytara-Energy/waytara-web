import type { createClient } from "@waytara/supabase/server";
import { sourceShares, type SourceShare } from "@/lib/ev-sessions";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/** Sessions that delivered less than this are the charger's bookkeeping (a plug-in that never charged), not charges worth listing. */
const MIN_KWH = 0.01;
/** The statistic shows this many days back, today included. */
export const HISTORY_DAYS = 30;

/** One finished charge, as the Overview lists it. */
export interface EvHistorySession {
  id: string;
  startedAt: string;
  endedAt: string;
  kwh: number;
  /** seconds the car was drawing power (the charger's own count), else start to end */
  durationS: number;
  peakKw: number | null;
  /** the share of the energy that came from the site's solar (null when the site's numbers were not available for it) */
  solarSharePct: number | null;
  /** where its energy came from (solar, battery, grid), null when the site's figures were not available for it */
  shares: SourceShare[] | null;
  /** what it cost: the recorded amount, else the energy at the customer's rate */
  cost: number | null;
  stopReason: string | null;
  /** the kWh the charge was asked to stop at (null = no limit) */
  targetKwh: number | null;
  /** closed by WayTara itself after the charger's stop report was lost (its energy is then the last reading's) */
  closedAutomatically: boolean;
}

export interface EvDayEnergy {
  /** the calendar day in IST, YYYY-MM-DD */
  day: string;
  kwh: number;
}

export interface EvHistory {
  /** the finished charges, newest first (up to the last twelve) */
  recent: EvHistorySession[];
  /** energy per day for the last HISTORY_DAYS days, oldest first, a day with no charge being 0 */
  daily: EvDayEnergy[];
  sessions30: number;
  kwh30: number;
}

const IST_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" });
/** The IST calendar day of an instant, as YYYY-MM-DD. */
export const istDay = (ms: number): string => IST_DAY.format(ms);

/** The energy of one session row: end - start of the charger's register, else of the meter values the OCPP stop carried. */
function rowKwh(r: { start_energy_kwh: number | null; end_energy_kwh: number | null; meter_start_wh: number | null; meter_stop_wh: number | null }): number | null {
  if (r.start_energy_kwh !== null && r.end_energy_kwh !== null) return r.end_energy_kwh - r.start_energy_kwh;
  if (r.meter_start_wh !== null && r.meter_stop_wh !== null) return (r.meter_stop_wh - r.meter_start_wh) / 1000;
  return null;
}

/** The charger's finished charges (test sessions and zero-energy ones left out) and the energy per day, for the Overview's last-charge,
 *  history and statistic cards. One read of the newest sessions; the charge that is open right now is the hero card's business. */
export async function fetchEvHistory(supabase: SupabaseServerClient, chargerId: string, tariffRate: number): Promise<EvHistory> {
  const { data } = await supabase
    .from("ev_sessions")
    .select("id, started_at, ended_at, start_energy_kwh, end_energy_kwh, meter_start_wh, meter_stop_wh, stop_reason, status, is_test, peak_power_kw, charging_seconds, solar_share_pct, cost_amount, target_kwh, energy_from_solar_kwh, energy_from_battery_kwh, energy_from_grid_kwh, energy_unattributed_kwh")
    .eq("equipment_id", chargerId)
    .not("ended_at", "is", null)
    .order("started_at", { ascending: false })
    .limit(300);
  const rows = (data ?? []).filter((r) => !r.is_test && r.ended_at !== null);

  // A charge whose end was never reported has no end reading: its energy is the newest reading it did get, less its start.
  const lacking = rows.filter((r) => rowKwh(r) === null && (r.start_energy_kwh !== null || r.meter_start_wh !== null)).slice(0, 20);
  const lastReading = new Map<string, { kwh: number; ts: string }>();
  if (lacking.length > 0) {
    const { data: samples } = await supabase.from("ev_session_samples").select("session_id, energy_kwh, ts").in("session_id", lacking.map((r) => r.id)).not("energy_kwh", "is", null).order("ts", { ascending: false }).limit(400);
    for (const m of samples ?? []) if (m.energy_kwh !== null && !lastReading.has(m.session_id)) lastReading.set(m.session_id, { kwh: m.energy_kwh, ts: m.ts });
  }

  const all: EvHistorySession[] = [];
  for (const r of rows) {
    const closedAutomatically = r.status === "active";
    let kwh = rowKwh(r);
    // a charge closed by WayTara ends where its last reading was, not where WayTara gave up waiting
    let endedAt = r.ended_at;
    if (kwh === null) {
      const last = lastReading.get(r.id);
      const from = r.start_energy_kwh ?? (r.meter_start_wh !== null ? r.meter_start_wh / 1000 : null);
      if (last !== undefined && from !== null) {
        kwh = Math.max(0, last.kwh - from);
        if (closedAutomatically) endedAt = last.ts;
      }
    }
    if (endedAt === null || kwh === null || kwh < MIN_KWH) continue;
    const spanS = Math.max(0, Math.round((Date.parse(endedAt) - Date.parse(r.started_at)) / 1000));
    all.push({
      id: r.id,
      startedAt: r.started_at,
      endedAt,
      kwh,
      durationS: r.charging_seconds ?? spanS,
      peakKw: r.peak_power_kw,
      solarSharePct: r.solar_share_pct,
      shares: sourceShares(r),
      cost: r.cost_amount ?? kwh * tariffRate,
      stopReason: r.stop_reason,
      targetKwh: r.target_kwh,
      closedAutomatically,
    });
  }

  // one bucket per IST day, today last
  const now = Date.now();
  const days: EvDayEnergy[] = [];
  for (let i = HISTORY_DAYS - 1; i >= 0; i--) days.push({ day: istDay(now - i * 86_400_000), kwh: 0 });
  const byDay = new Map(days.map((d) => [d.day, d]));
  let sessions30 = 0;
  let kwh30 = 0;
  for (const s of all) {
    const bucket = byDay.get(istDay(Date.parse(s.startedAt)));
    if (!bucket) continue;
    bucket.kwh += s.kwh;
    sessions30 += 1;
    kwh30 += s.kwh;
  }
  return { recent: all.slice(0, 12), daily: days, sessions30, kwh30 };
}
