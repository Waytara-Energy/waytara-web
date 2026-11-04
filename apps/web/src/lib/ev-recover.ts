// A charge that WayTara closed by itself: the charger's stop report never reached the database (it was down or unreachable at that moment), so the
// session row has an end time but is still marked "active", with no end reading, peak or sources. Everything a list, a report or a download
// shows for it is worked out here from the readings it did get, the same way the charge's own page does, so it is not listed as still charging
// and its energy is not lost. Pure functions; the fetch at the bottom only gathers the rows.

import type { createClient } from "@waytara/supabase/server";
import type { EvPerfSession } from "./ev-perf-stats";
import { buildSessionDetail } from "./ev-session-detail";
import type { EvSampleRow } from "./ev-sessions";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/** The status a recovered session carries. */
export const CLOSED_AUTO = "closed_auto";

/** A session that has an end time but was never marked finished. */
export const isClosedWithoutReport = (s: { status: string; ended_at: string | null }): boolean => s.status === "active" && s.ended_at !== null;

export type RecoverySample = EvSampleRow & { temperature_c?: number | null; current_offered_a?: number | null };

/** The session with what its readings give: its end (the last reading), energy, peak, average, charging time and where the energy came from. */
export function recoverSession(s: EvPerfSession, samples: readonly RecoverySample[], nowMs: number): EvPerfSession {
  if (!isClosedWithoutReport(s) || samples.length === 0) return isClosedWithoutReport(s) ? { ...s, status: CLOSED_AUTO } : s;
  const d = buildSessionDetail(
    { ...s, equipment_id: "", ocpp_transaction_id: null, target_kwh: null, cost_amount: null, max_current_a: null, site_data_coverage_pct: null, is_test: !!s.is_test, source: s.source ?? "ocpp" } as never,
    samples.map((x) => ({ temperature_c: null, current_offered_a: null, ...x })) as never,
    [],
    0,
    nowMs,
  );
  const share = (key: "solar" | "battery" | "grid" | "unattributed") => d.shares?.find((x) => x.key === key)?.kwh ?? null;
  const solar = share("solar");
  const battery = share("battery");
  const grid = share("grid");
  const real = (solar ?? 0) + (battery ?? 0) + (grid ?? 0);
  const patched: EvPerfSession = {
    ...s,
    status: CLOSED_AUTO,
    ended_at: d.endedAt ?? s.ended_at,
    stop_reason: null,
    peak_power_kw: s.peak_power_kw ?? d.peakKw,
    avg_power_kw: s.avg_power_kw ?? d.avgKw,
    charging_seconds: s.charging_seconds ?? d.chargingS,
    energy_from_solar_kwh: s.energy_from_solar_kwh ?? solar,
    energy_from_battery_kwh: s.energy_from_battery_kwh ?? battery,
    energy_from_grid_kwh: s.energy_from_grid_kwh ?? grid,
    energy_unattributed_kwh: s.energy_unattributed_kwh ?? share("unattributed"),
    solar_share_pct: s.solar_share_pct ?? (solar !== null && real > 0 ? (solar / real) * 100 : null),
  };
  // the end reading: the charger's own register when the start was recorded that way, else the meter
  if (d.kwh !== null) {
    if (s.start_energy_kwh !== null) patched.end_energy_kwh = s.end_energy_kwh ?? s.start_energy_kwh + d.kwh;
    else if (s.meter_start_wh !== null) patched.meter_stop_wh = s.meter_stop_wh ?? Math.round(s.meter_start_wh + d.kwh * 1000);
  }
  return patched;
}

const SAMPLE_COLUMNS = "session_id, ts, energy_kwh, power_kw, current_a_l1, voltage_v_l1, temperature_c, current_offered_a, soc_pct, ev_from_solar_w, ev_from_battery_w, ev_from_grid_w";
/** The most closed-by-WayTara sessions recovered in one read (the newest; each needs its readings). */
const MAX_RECOVERED = 20;

/** The sessions, with those WayTara closed by itself recovered from their readings (one read of the readings for all of them). */
export async function recoverClosedSessions(supabase: SupabaseServerClient, sessions: EvPerfSession[]): Promise<EvPerfSession[]> {
  const broken = sessions.filter(isClosedWithoutReport);
  if (broken.length === 0) return sessions;
  const ids = broken
    .slice()
    .sort((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at))
    .slice(0, MAX_RECOVERED)
    .map((s) => s.id);
  const { data } = await supabase.from("ev_session_samples").select(SAMPLE_COLUMNS).in("session_id", ids).order("ts", { ascending: true }).limit(8000);
  const bySession = new Map<string, RecoverySample[]>();
  for (const r of (data ?? []) as unknown as (RecoverySample & { session_id: string })[]) {
    const list = bySession.get(r.session_id) ?? [];
    list.push(r);
    bySession.set(r.session_id, list);
  }
  const now = Date.now();
  return sessions.map((s) => (isClosedWithoutReport(s) ? recoverSession(s, bySession.get(s.id) ?? [], now) : s));
}
