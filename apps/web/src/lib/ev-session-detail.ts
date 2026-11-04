import type { createClient } from "@waytara/supabase/server";
import { curvePoints, formatSeconds, sessionStatusLabel, sourceShares, stopReasonLabel, type CurvePoint, type EvSampleRow, type EvSessionRow, type SourceShare } from "@/lib/ev-sessions";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/** One sample every 30 s: a silence longer than this between two of them is a gap worth saying so. */
export const GAP_S = 100;
/** A sample is "charging" above this power; a step in time is never counted longer than MAX_STEP_S (a gap is not charging). */
const CHARGING_KW = 0.1;
const MAX_STEP_S = 90;

export interface EvEventLine {
  ts: string;
  label: string;
  /** a short extra: the status the connector went to, who sent a command */
  note: string | null;
  tone: "good" | "neutral" | "warn";
}

export interface EvGap {
  from: string;
  to: string;
  seconds: number;
}

/** Everything the session's detail view shows. Numbers the charger or the server did not finish writing are worked out from the samples,
 *  and `notes` says which, so nothing is passed off as measured. */
export interface EvSessionDetail {
  id: string;
  startedAt: string;
  endedAt: string | null;
  status: { label: string; tone: "good" | "warn" | "neutral" };
  isTest: boolean;
  transactionId: number | null;
  stopReason: string | null;
  /** the kWh the person asked the charge to stop at (null = no limit) */
  bookedKwh: number | null;
  /** energy delivered, kWh */
  kwh: number | null;
  /** start to end (or to now while open), seconds */
  spanS: number;
  /** seconds the car was drawing power */
  chargingS: number | null;
  cost: number | null;
  tariffRate: number;
  /** what the solar share of the energy saved against the grid rate */
  savedBySolar: number | null;
  peakKw: number | null;
  avgKw: number | null;
  maxA: number | null;
  shares: SourceShare[] | null;
  coveragePct: number | null;
  voltage: { min: number; max: number } | null;
  temperature: { min: number; max: number } | null;
  offeredA: number | null;
  points: CurvePoint[];
  events: EvEventLine[];
  gaps: EvGap[];
  notes: string[];
}

const SESSION_COLUMNS =
  "id, equipment_id, started_at, ended_at, status, source, is_test, stop_reason, ocpp_transaction_id, start_energy_kwh, end_energy_kwh, meter_start_wh, meter_stop_wh, peak_power_kw, avg_power_kw, max_current_a, charging_seconds, energy_from_solar_kwh, energy_from_battery_kwh, energy_from_grid_kwh, energy_unattributed_kwh, solar_share_pct, site_data_coverage_pct, target_kwh, cost_amount";
const SAMPLE_COLUMNS = "ts, energy_kwh, power_kw, current_a_l1, voltage_v_l1, temperature_c, current_offered_a, soc_pct, ev_from_solar_w, ev_from_battery_w, ev_from_grid_w";

type SessionDbRow = EvSessionRow & { equipment_id: string; is_test: boolean; ocpp_transaction_id: number | null; target_kwh: number | null; cost_amount: number | null };
type SampleDbRow = EvSampleRow & { temperature_c: number | null; current_offered_a: number | null };

const KIND_LABEL: Record<string, string> = {
  connected: "Charger connected to WayTara",
  disconnected: "Charger connection lost",
  boot: "Charger started up",
  authorize: "Charge authorised",
  transaction_start: "Charge started",
  transaction_stop: "Charge ended",
  target_reached: "Stop-after amount reached",
  target_stop_sent: "Stop sent to the charger",
  session_closed_without_stop: "Closed without a stop from the charger",
};

/** One charger event as a line of the log. Unknown kinds are shown by their name, never dropped. */
export function eventLine(e: { ts: string; kind: string; detail: unknown }): EvEventLine {
  const d = (e.detail && typeof e.detail === "object" ? e.detail : {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v) : null);
  switch (e.kind) {
    case "status": {
      const status = str(d.status) ?? "unknown";
      const tone = /fault/i.test(status) ? "warn" : /^charging$/i.test(status) ? "good" : "neutral";
      return { ts: e.ts, label: `Connector: ${status}`, note: str(d.error) && d.error !== "NoError" ? `error ${str(d.error)}` : null, tone };
    }
    case "command": {
      const c = str(d.command);
      return { ts: e.ts, label: c === "remote-start" ? "Start sent from the dashboard" : c === "remote-stop" ? "Stop sent from the dashboard" : `Command: ${c ?? "unknown"}`, note: null, tone: "neutral" };
    }
    case "transaction_stop": {
      const kwh = typeof d.energy_kwh === "number" ? `${d.energy_kwh} kWh delivered` : null;
      const why = stopReasonLabel(str(d.reason));
      return { ts: e.ts, label: KIND_LABEL.transaction_stop, note: [why, kwh].filter(Boolean).join(" · ") || null, tone: "good" };
    }
    case "target_reached":
      return { ts: e.ts, label: KIND_LABEL.target_reached, note: typeof d.target_kwh === "number" ? `${d.target_kwh} kWh asked, ${d.delivered_kwh ?? "?"} kWh delivered` : null, tone: "neutral" };
    case "session_closed_without_stop":
      return { ts: e.ts, label: KIND_LABEL.session_closed_without_stop, note: str(d.why), tone: "warn" };
    case "disconnected":
      return { ts: e.ts, label: KIND_LABEL.disconnected, note: null, tone: "warn" };
    default:
      return { ts: e.ts, label: KIND_LABEL[e.kind] ?? e.kind.replace(/_/g, " "), note: null, tone: "neutral" };
  }
}

/** The silences between samples longer than GAP_S. */
export function sampleGaps(times: readonly number[]): EvGap[] {
  const gaps: EvGap[] = [];
  for (let i = 1; i < times.length; i++) {
    const s = (times[i] - times[i - 1]) / 1000;
    if (s > GAP_S) gaps.push({ from: new Date(times[i - 1]).toISOString(), to: new Date(times[i]).toISOString(), seconds: Math.round(s) });
  }
  return gaps;
}

const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;

/** Builds the detail from the session row, its samples and the events around it. Pure: the fetch below only gathers the rows. */
export function buildSessionDetail(session: SessionDbRow, samples: readonly SampleDbRow[], events: readonly { ts: string; kind: string; detail: unknown }[], tariffRate: number, nowMs: number): EvSessionDetail {
  const notes: string[] = [];
  // a session that has an end time but was never marked finished: the server closed it itself after the charger's stop report was lost
  const closedWithoutReport = session.status === "active" && session.ended_at !== null;
  if (closedWithoutReport) notes.push("The charger's stop report never reached WayTara, so this charge was closed automatically; its end time is when WayTara gave up waiting.");
  const sorted = [...samples].sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
  const times = sorted.map((s) => Date.parse(s.ts));
  const startMs = Date.parse(session.started_at);
  const lastSampleMs = times.length ? times[times.length - 1] : null;
  const endMs = closedWithoutReport && lastSampleMs !== null ? lastSampleMs : session.ended_at ? Date.parse(session.ended_at) : nowMs;
  const spanS = Math.max(0, Math.round((endMs - startMs) / 1000));

  // energy: the charger's own meters, else the newest sample's register
  let kwh: number | null = null;
  const meters = session.meter_start_wh !== null && session.meter_stop_wh !== null ? (session.meter_stop_wh - session.meter_start_wh) / 1000 : null;
  if (session.start_energy_kwh !== null && session.end_energy_kwh !== null) kwh = session.end_energy_kwh - session.start_energy_kwh;
  else if (meters !== null) kwh = meters;
  else {
    const last = [...sorted].reverse().find((s) => s.energy_kwh !== null);
    const from = session.start_energy_kwh ?? (session.meter_start_wh !== null ? session.meter_start_wh / 1000 : null);
    if (last && from !== null && last.energy_kwh !== null) {
      kwh = Math.max(0, last.energy_kwh - from);
      notes.push(session.ended_at ? "The charger's final reading never reached WayTara, so the energy is taken from the last reading before it." : "Energy so far, from the newest reading.");
    }
  }

  // time spent drawing power: every step between two readings where it was drawing; across a silence, the time the energy that arrived
  // in it takes at the power the next reading shows (the register kept counting while the readings did not get through)
  let chargingS = session.charging_seconds;
  if (chargingS === null && sorted.length > 1) {
    let s = 0;
    for (let i = 1; i < sorted.length; i++) {
      const dt = (times[i] - times[i - 1]) / 1000;
      const kwNow = sorted[i].power_kw ?? 0;
      if (dt <= GAP_S) {
        if (kwNow > CHARGING_KW) s += dt;
      } else {
        const e0 = sorted[i - 1].energy_kwh;
        const e1 = sorted[i].energy_kwh;
        if (e0 !== null && e1 !== null && e1 > e0 && kwNow > CHARGING_KW) s += Math.min(dt, ((e1 - e0) / kwNow) * 3600);
      }
    }
    chargingS = Math.round(s);
    if (chargingS > 0 && session.ended_at) notes.push("Charging time worked out from the readings.");
  }

  // power figures
  const powers = sorted.map((s) => s.power_kw).filter((v): v is number => v !== null);
  const peakKw = session.peak_power_kw ?? (powers.length ? Math.max(...powers) : null);
  const drawing = powers.filter((p) => p > CHARGING_KW);
  const avgKw = session.avg_power_kw ?? (drawing.length ? round(drawing.reduce((a, b) => a + b, 0) / drawing.length, 2) : null);
  const currents = sorted.map((s) => s.current_a_l1).filter((v): v is number => v !== null);
  const maxA = session.max_current_a ?? (currents.length ? Math.max(...currents) : null);

  // where the energy came from: the session's own split, else the samples' split added up over time
  let split: Pick<EvSessionRow, "energy_from_solar_kwh" | "energy_from_battery_kwh" | "energy_from_grid_kwh" | "energy_unattributed_kwh"> = session;
  if (sourceShares(session) === null) {
    let solar = 0;
    let battery = 0;
    let grid = 0;
    let any = false;
    for (let i = 1; i < sorted.length; i++) {
      const s = sorted[i];
      if (s.ev_from_solar_w === null && s.ev_from_battery_w === null && s.ev_from_grid_w === null) continue;
      any = true;
      const h = Math.min(MAX_STEP_S, (times[i] - times[i - 1]) / 1000) / 3600;
      solar += ((s.ev_from_solar_w ?? 0) / 1000) * h;
      battery += ((s.ev_from_battery_w ?? 0) / 1000) * h;
      grid += ((s.ev_from_grid_w ?? 0) / 1000) * h;
    }
    if (any) {
      const known = solar + battery + grid;
      split = {
        energy_from_solar_kwh: round(solar, 3),
        energy_from_battery_kwh: round(battery, 3),
        energy_from_grid_kwh: round(grid, 3),
        energy_unattributed_kwh: kwh !== null ? Math.max(0, round(kwh - known, 3)) : 0,
      };
      notes.push("Sources added up from the readings (the summary was not written).");
    }
  }
  const shares = sourceShares(split);
  const solarKwh = split.energy_from_solar_kwh;

  const volts = sorted.map((s) => s.voltage_v_l1).filter((v): v is number => v !== null && v > 50);
  const temps = sorted.map((s) => s.temperature_c).filter((v): v is number => v !== null);
  const offered = [...sorted].reverse().find((s) => s.current_offered_a !== null)?.current_offered_a ?? null;
  const gaps = sampleGaps(times);
  if (gaps.length > 0) notes.push(`No readings for ${gaps.map((g) => formatSeconds(g.seconds)).join(", ")}: the charger or the connection to WayTara was interrupted, so figures for that time are missing.`);

  // the log: events from just before the start to just after the end
  const log = events
    .filter((e) => Date.parse(e.ts) >= startMs - 90_000 && Date.parse(e.ts) <= endMs + 120_000)
    .map(eventLine)
    .sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));

  const cost = session.cost_amount ?? (kwh !== null ? kwh * tariffRate : null);
  return {
    id: session.id,
    startedAt: session.started_at,
    endedAt: closedWithoutReport && lastSampleMs !== null ? new Date(lastSampleMs).toISOString() : session.ended_at,
    status: closedWithoutReport ? { label: "Closed automatically", tone: "warn" as const } : sessionStatusLabel(session.status),
    isTest: session.is_test || session.source === "simulated",
    transactionId: session.ocpp_transaction_id,
    stopReason: closedWithoutReport ? null : stopReasonLabel(session.stop_reason),
    bookedKwh: session.target_kwh,
    kwh,
    spanS,
    chargingS,
    cost,
    tariffRate,
    savedBySolar: solarKwh !== null && solarKwh > 0 ? solarKwh * tariffRate : null,
    peakKw,
    avgKw,
    maxA,
    shares,
    coveragePct: session.site_data_coverage_pct,
    voltage: volts.length ? { min: Math.min(...volts), max: Math.max(...volts) } : null,
    temperature: temps.length ? { min: Math.min(...temps), max: Math.max(...temps) } : null,
    offeredA: offered,
    points: curvePoints(sorted),
    events: log,
    gaps,
    notes,
  };
}

/** One charge with its samples and the charger's events around it. RLS limits every read to the signed-in person's own charger. */
export async function fetchEvSessionDetail(supabase: SupabaseServerClient, sessionId: string, tariffRate: number): Promise<EvSessionDetail | null> {
  const { data: row } = await supabase.from("ev_sessions").select(SESSION_COLUMNS).eq("id", sessionId).maybeSingle();
  if (!row) return null;
  const session = row as unknown as SessionDbRow;
  const from = new Date(Date.parse(session.started_at) - 90_000).toISOString();
  const to = new Date((session.ended_at ? Date.parse(session.ended_at) : Date.now()) + 120_000).toISOString();
  const [{ data: sampleRows }, { data: eventRows }] = await Promise.all([
    supabase.from("ev_session_samples").select(SAMPLE_COLUMNS).eq("session_id", sessionId).order("ts", { ascending: true }).limit(6000),
    supabase.from("ev_events").select("ts, kind, detail").eq("equipment_id", session.equipment_id).gte("ts", from).lte("ts", to).order("ts", { ascending: true }).limit(200),
  ]);
  return buildSessionDetail(session, (sampleRows ?? []) as unknown as SampleDbRow[], (eventRows ?? []) as { ts: string; kind: string; detail: unknown }[], tariffRate, Date.now());
}
