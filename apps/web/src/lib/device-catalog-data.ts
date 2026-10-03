import "server-only";
import { createClient } from "@waytara/supabase/server";
import type { CustomerDevice } from "./selected-site";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export interface DeviceParameterReading {
  key: string;
  name: string;
  unit: string | null;
  category: string | null;
  value: number | null;
  ts: string | null;
}

/** Generic, catalog-driven telemetry for one device — unlike
 *  fetchDeviceOverview (which reads a fixed list of solar-inverter register
 *  keys: inverter_power_w, battery_soc_pct, …), this reads whatever
 *  equipment_metrics actually lists for this specific device, so a device
 *  of any category shows its own real readings instead of the inverter's
 *  shape applied to it. Per-device now, not per-model — a category
 *  missing from this specific installation's own rows (e.g. no generator
 *  connected) is simply absent, no separate feature-flag layer to check. */
export async function fetchDeviceParameterReadings(supabase: SupabaseServerClient, device: CustomerDevice): Promise<DeviceParameterReading[]> {
  const { data: metrics } = await supabase
    .from("equipment_metrics")
    .select("key_name, category, equipment_templates!inner(display_name, unit)")
    .eq("equipment_id", device.id)
    .eq("direction", "read")
    .eq("show_for_user", true);

  const parameters = (metrics ?? []).map((m) => ({
    parameter_key: m.key_name,
    parameter_name: m.equipment_templates.display_name,
    unit: m.equipment_templates.unit,
    category: m.category,
  }));
  if (parameters.length === 0) return [];

  const keys = parameters.map((p) => p.parameter_key);
  const { data: readings } = await supabase
    .from("equipment_latest")
    .select("key_name, value, ts")
    .eq("equipment_id", device.id)
    .in("key_name", keys);

  const latest = new Map<string, { value: number | null; ts: string }>();
  for (const r of readings ?? []) {
    if (!latest.has(r.key_name)) latest.set(r.key_name, { value: r.value, ts: r.ts });
  }

  return parameters.map((p) => ({
    key: p.parameter_key,
    name: p.parameter_name,
    unit: p.unit,
    category: p.category,
    value: latest.get(p.parameter_key)?.value ?? null,
    ts: latest.get(p.parameter_key)?.ts ?? null,
  }));
}
