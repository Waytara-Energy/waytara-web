/** What the EV sessions page shows for a charging session, worked out from the rows the charger's server stores (see the
 *  ev_sessions / ev_session_samples tables). Pure functions, so they are tested without a database. */

export interface EvSessionRow {
  id: string;
  equipment_id: string;
  started_at: string;
  ended_at: string | null;
  status: string;
  source: string;
  stop_reason: string | null;
  start_energy_kwh: number | null;
  end_energy_kwh: number | null;
  meter_start_wh: number | null;
  meter_stop_wh: number | null;
  peak_power_kw: number | null;
  avg_power_kw: number | null;
  max_current_a: number | null;
  charging_seconds: number | null;
  energy_from_solar_kwh: number | null;
  energy_from_battery_kwh: number | null;
  energy_from_grid_kwh: number | null;
  energy_unattributed_kwh: number | null;
  solar_share_pct: number | null;
  site_data_coverage_pct: number | null;
  target_kwh: number | null;
}

export interface EvSampleRow {
  ts: string;
  energy_kwh: number | null;
  power_kw: number | null;
  current_a_l1: number | null;
  voltage_v_l1: number | null;
  soc_pct: number | null;
  ev_from_solar_w: number | null;
  ev_from_battery_w: number | null;
  ev_from_grid_w: number | null;
}

/** The energy a session delivered, in kWh: the charger's own meter when the session came from it, otherwise the energy
 *  readings the older sessions were built from. Null when neither is known; never negative. */
export function sessionEnergyKwh(s: Pick<EvSessionRow, "meter_start_wh" | "meter_stop_wh" | "start_energy_kwh" | "end_energy_kwh">): number | null {
  if (s.meter_start_wh !== null && s.meter_stop_wh !== null) return Math.max(0, (s.meter_stop_wh - s.meter_start_wh) / 1000);
  if (s.start_energy_kwh !== null && s.end_energy_kwh !== null) return Math.max(0, s.end_energy_kwh - s.start_energy_kwh);
  return null;
}

export type EvStatusTone = "good" | "warn" | "neutral";

/** A session's status in words. "suspect" is a session whose energy looked impossible; it is shown as reported with a warning. */
export function sessionStatusLabel(status: string): { label: string; tone: EvStatusTone } {
  switch (status) {
    case "active":
      return { label: "Charging now", tone: "good" };
    case "completed":
      return { label: "Completed", tone: "neutral" };
    case "suspect":
      return { label: "Check this one", tone: "warn" };
    case "aborted":
      return { label: "Ended early", tone: "warn" };
    default:
      return { label: status, tone: "neutral" };
  }
}

/** The reason the charger gave for stopping, in plain words. Unknown reasons are shown as the charger sent them. */
export function stopReasonLabel(reason: string | null): string | null {
  if (!reason) return null;
  const known: Record<string, string> = {
    Local: "Stopped at the charger",
    Remote: "Stopped from the app",
    EVDisconnected: "Car unplugged",
    EmergencyStop: "Emergency stop",
    PowerLoss: "Power was lost",
    Reboot: "Charger restarted",
    SoftReset: "Charger restarted",
    HardReset: "Charger restarted",
    DeAuthorized: "Not authorised",
    UnlockCommand: "Unlocked from the app",
    MissingStop: "The charger did not report the end, so the session was closed automatically",
    Other: "Other",
  };
  return known[reason] ?? reason;
}

export interface SourceShare {
  key: "solar" | "battery" | "grid" | "unattributed";
  label: string;
  kwh: number;
  pct: number;
}

/** Where the session's energy came from, as shares of the total. Null when the site's figures were not available at all
 *  (nothing is guessed). The shares add up to 100 within rounding. */
export function sourceShares(s: Pick<EvSessionRow, "energy_from_solar_kwh" | "energy_from_battery_kwh" | "energy_from_grid_kwh" | "energy_unattributed_kwh">): SourceShare[] | null {
  const parts: [SourceShare["key"], string, number | null][] = [
    ["solar", "Solar", s.energy_from_solar_kwh],
    ["battery", "Battery", s.energy_from_battery_kwh],
    ["grid", "Grid", s.energy_from_grid_kwh],
    ["unattributed", "Not known", s.energy_unattributed_kwh],
  ];
  // Only the three real sources decide whether there is a split to show.
  if (parts.slice(0, 3).every(([, , v]) => v === null)) return null;
  const total = parts.reduce((sum, [, , v]) => sum + (v ?? 0), 0);
  if (total <= 0) return null;
  return parts
    .filter(([key, , v]) => (v ?? 0) > 0 || key !== "unattributed")
    .map(([key, label, v]) => ({ key, label, kwh: v ?? 0, pct: ((v ?? 0) / total) * 100 }));
}

export interface CurvePoint {
  t: number;
  kw: number;
  solar: number | null;
  battery: number | null;
  grid: number | null;
}

/** The samples as chart points (time in ms, power and the three sources in kW). Rows without a time or power are left out. */
export function curvePoints(samples: EvSampleRow[]): CurvePoint[] {
  const out: CurvePoint[] = [];
  for (const s of samples) {
    const t = Date.parse(s.ts);
    if (!Number.isFinite(t) || s.power_kw === null) continue;
    const hasSplit = s.ev_from_solar_w !== null || s.ev_from_battery_w !== null || s.ev_from_grid_w !== null;
    out.push({
      t,
      kw: s.power_kw,
      solar: hasSplit ? (s.ev_from_solar_w ?? 0) / 1000 : null,
      battery: hasSplit ? (s.ev_from_battery_w ?? 0) / 1000 : null,
      grid: hasSplit ? (s.ev_from_grid_w ?? 0) / 1000 : null,
    });
  }
  return out.sort((a, b) => a.t - b.t);
}

/** Time in seconds as "1h 05m" / "12m" / "40s". */
export function formatSeconds(totalSeconds: number | null): string {
  if (totalSeconds === null || !Number.isFinite(totalSeconds) || totalSeconds < 0) return "—";
  const s = Math.round(totalSeconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}
