import "server-only";
import { createClient } from "@waytara/supabase/server";
import type { CustomerDevice } from "./selected-site";
import { getDisabledCategories } from "./device-feature-flags";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export interface DeviceParameterReading {
  key: string;
  name: string;
  unit: string | null;
  category: string | null;
  isRequired: boolean;
  value: number | null;
  ts: string | null;
}

/** Generic, catalog-driven telemetry for one device — unlike
 *  fetchDeviceOverview (which reads a fixed list of solar-inverter register
 *  keys: inverter_power_w, battery_soc_pct, …), this reads whatever
 *  device_parameter_map + instrument_catalog actually list for this
 *  device's own stock/model (device_parameters' old role, before it was
 *  retired in favor of the multi-vendor catalog), so a device of any
 *  category shows its own real readings instead of the inverter's shape
 *  applied to it (which is what an EV charger — or any future non-inverter
 *  device — got before: queried for keys it never reports, so every card
 *  came back blank).
 *
 *  Also the one place this device's `device_feature_flags` get applied for
 *  this fallback path: a category disabled for this specific installation
 *  (e.g. no generator connected) is filtered out here, before any
 *  device_readings query runs — not just hidden after fetching. */
export async function fetchDeviceParameterReadings(supabase: SupabaseServerClient, device: CustomerDevice): Promise<DeviceParameterReading[]> {
  const stockId = device.deviceType?.id;
  if (!stockId) return [];

  const [{ data: catalog }, disabledCategories] = await Promise.all([
    supabase
      .from("device_parameter_map")
      .select("instrument_key, is_required, instrument_catalog!inner(name, category, unit, direction)")
      .eq("stock_id", stockId)
      .eq("is_enabled", true)
      .eq("instrument_catalog.direction", "read"),
    getDisabledCategories(supabase, device.id),
  ]);

  const parameters = (catalog ?? [])
    .filter((p) => !disabledCategories.has(p.instrument_catalog.category))
    .map((p) => ({
      parameter_key: p.instrument_key,
      parameter_name: p.instrument_catalog.name,
      unit: p.instrument_catalog.unit,
      category: p.instrument_catalog.category,
      is_required: p.is_required,
    }));
  if (parameters.length === 0) return [];

  const keys = parameters.map((p) => p.parameter_key);
  const { data: readings } = await supabase
    .from("device_readings")
    .select("instrument_key, value, ts")
    .eq("device_id", device.id)
    .in("instrument_key", keys)
    .order("ts", { ascending: false })
    .limit(keys.length * 5);

  const latest = new Map<string, { value: number | null; ts: string }>();
  for (const r of readings ?? []) {
    if (!latest.has(r.instrument_key)) latest.set(r.instrument_key, { value: r.value, ts: r.ts });
  }

  return parameters.map((p) => ({
    key: p.parameter_key,
    name: p.parameter_name,
    unit: p.unit,
    category: p.category,
    isRequired: p.is_required,
    value: latest.get(p.parameter_key)?.value ?? null,
    ts: latest.get(p.parameter_key)?.ts ?? null,
  }));
}
