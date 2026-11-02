import "server-only";
import { createServiceRoleClient } from "@waytara/supabase/service-role";

// The live figures the landing page's laptop shows: the Waytara Office inverter, read-only and public by design.
// A visitor has no session, so this is one of the legitimate service_role cases (no signed-in user to scope RLS against);
// it can only ever read this one device, and only the whitelisted keys below (power, energy, voltage, current, temperature,
// state of charge - nothing that identifies a person or the site's address).

export const LANDING_SITE_NAME = "Waytara Office";
// The office inverter. Override with LANDING_DEMO_EQUIPMENT_ID in the environment if the device is ever replaced.
const EQUIPMENT_ID = process.env.LANDING_DEMO_EQUIPMENT_ID ?? "b4c30eb8-fba4-4487-aa7a-3c1b089e36e2";

const IST_MS = 19_800_000;
const DAY_MS = 86_400_000;
const SLOT_MINUTES = 15;
const CACHE_MS = 4_000;

/** Newest reading of each of these. */
const LIVE_KEYS = [
  "inverter_output_power_w",
  "inverter_l1_voltage_v",
  "inverter_l1_current_a",
  "inverter_output_frequency_hz",
  "inverter_ac_temperature_c",
  "inverter_dc_temperature_c",
  "day_active_energy_kwh",
  "pv1_power_w",
  "pv1_voltage_v",
  "pv1_current_a",
  "pv2_power_w",
  "pv2_voltage_v",
  "pv2_current_a",
  "day_pv_energy_kwh",
  "battery_soc_pct",
  "battery_temperature_c",
  "battery_power_w",
  "battery_voltage_v",
  "battery_current_a",
  "day_battery_charge_energy_kwh",
  "day_battery_discharge_energy_kwh",
  "load_total_power_w",
  "load_l1_power_w",
  "load_l1_voltage_v",
  "load_l1_current_a",
  "load_frequency_hz",
  "day_load_energy_kwh",
  "grid_total_power_w",
  "grid_l1_voltage_v",
  "grid_l1_current_a",
  "grid_frequency_hz",
  "grid_ct_total_power_w",
  "grid_ct_l1_current_a",
  "day_grid_import_energy_kwh",
  "day_grid_export_energy_kwh",
] as const;

/** Today's curve of each of these (15-minute averages). */
const POWER_SERIES = ["inverter_output_power_w", "pv1_power_w", "pv2_power_w", "load_total_power_w", "grid_total_power_w", "battery_power_w", "battery_soc_pct", "load_l1_current_a"] as const;
/** Today's curve of these running "so far today" energy counters (the last reading of each slot). */
const COUNTER_SERIES = ["day_battery_charge_energy_kwh", "day_battery_discharge_energy_kwh", "day_load_energy_kwh", "day_grid_import_energy_kwh", "day_grid_export_energy_kwh"] as const;

export interface LandingSnapshot {
  site: string;
  /** When the newest reading was stored (epoch ms), or null when nothing has been stored yet. */
  at: number | null;
  /** When this snapshot was made. */
  now: number;
  /** The start of today in India (epoch ms): the left end of every curve. */
  dayStart: number;
  live: Record<string, number | null>;
  /** key -> [slot start (epoch ms), value] */
  series: Record<string, [number, number | null][]>;
}

interface SeriesRow {
  key_name: string;
  bucket: string;
  avg_value: number | null;
  last_value: number | null;
}

let cache: { at: number; value: LandingSnapshot } | null = null;

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

export async function getLandingSnapshot(): Promise<LandingSnapshot> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;

  const sb = createServiceRoleClient();
  const now = Date.now();
  const dayStart = Math.floor((now + IST_MS) / DAY_MS) * DAY_MS - IST_MS;
  const from = new Date(dayStart).toISOString();
  const to = new Date(now + SLOT_MINUTES * 60_000).toISOString();

  const slice = async (keys: readonly string[]) => {
    const { data, error } = await sb.rpc("telemetry_series", { p_equipment_id: EQUIPMENT_ID, p_keys: [...keys], p_from: from, p_to: to, p_interval_minutes: SLOT_MINUTES });
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as SeriesRow[];
  };

  const [latest, powerRows, counterRows] = await Promise.all([
    sb.from("equipment_latest").select("key_name, value, ts").eq("equipment_id", EQUIPMENT_ID).in("key_name", [...LIVE_KEYS]),
    slice(POWER_SERIES),
    slice(COUNTER_SERIES),
  ]);
  if (latest.error) throw new Error(latest.error.message);

  const live: Record<string, number | null> = Object.fromEntries(LIVE_KEYS.map((k) => [k, null]));
  let at: number | null = null;
  for (const r of latest.data ?? []) {
    live[r.key_name] = num(r.value);
    const t = Date.parse(r.ts);
    if (Number.isFinite(t) && (at === null || t > at)) at = t;
  }

  const series: LandingSnapshot["series"] = Object.fromEntries([...POWER_SERIES, ...COUNTER_SERIES].map((k) => [k, []]));
  for (const r of powerRows) series[r.key_name]?.push([Date.parse(r.bucket), num(r.avg_value)]);
  for (const r of counterRows) series[r.key_name]?.push([Date.parse(r.bucket), num(r.last_value)]);
  for (const k of Object.keys(series)) series[k].sort((a, b) => a[0] - b[0]);

  const value: LandingSnapshot = { site: LANDING_SITE_NAME, at, now, dayStart, live, series };
  cache = { at: Date.now(), value };
  return value;
}
