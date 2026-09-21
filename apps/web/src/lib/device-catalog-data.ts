import "server-only";
import { createClient } from "@waytara/supabase/server";
import type { CustomerDevice } from "./selected-site";

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
 *  device_parameters actually lists for this device's own stock/model, so
 *  a device of any category shows its own real readings instead of the
 *  inverter's shape applied to it (which is what an EV charger — or any
 *  future non-inverter device — got before: queried for keys it never
 *  reports, so every card came back blank). */
export async function fetchDeviceParameterReadings(supabase: SupabaseServerClient, device: CustomerDevice): Promise<DeviceParameterReading[]> {
  const stockId = device.deviceType?.id;
  if (!stockId) return [];

  const { data: catalog } = await supabase
    .from("device_parameters")
    .select("parameter_key, parameter_name, unit, category, is_required")
    .eq("device_type_id", stockId);

  const parameters = catalog ?? [];
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
