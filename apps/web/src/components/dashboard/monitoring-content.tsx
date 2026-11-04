import { createClient } from "@waytara/supabase/server";
import { type CustomerDevice } from "@/lib/selected-site";
import { fetchDeviceParameterReadings } from "@/lib/device-catalog-data";
import { fetchEnumOptions } from "@/lib/instrument-catalog-data";
import { FAULT_BITMASK_KEYS } from "@/lib/device-overview";
import { getLastSyncInfo } from "@/lib/device-sync";
import { fetchDashboardFields, fetchFieldValues, resolveComputedValues, type FieldValue } from "@/lib/template-fields";
import { SolarMonitoringView } from "./solar-monitoring-view";
import { temperatureRowsFor } from "@/lib/temperature-rows";
import { DeviceParameterCards } from "./device-parameter-cards";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// Cross-page reads — real keys, but their own equipment_templates row is
// tagged dashboard_section: "Overview" (state-of-the-system totals like
// SOC/site power flow), not "Monitoring". Reused here the same way
// EnergyFlowDiagram/TodaySoFar already reuse them on Overview — a field's
// dashboard_section says which screen renders its own full detail, it
// doesn't forbid a different screen's headline tile from reading the same
// real value.
const OVERVIEW_CROSSREF_KEYS = [
  "battery_power_w",
  "battery_soc_pct",
  "grid_total_power_w",
  "load_total_power_w",
  "inverter_run_state",
  "day_pv_energy_kwh",
  "day_grid_import_energy_kwh",
  "day_grid_export_energy_kwh",
  "day_load_energy_kwh",
  ...FAULT_BITMASK_KEYS,
];

/** Picks the right category-specific live Monitoring body — mirrors
 *  DeviceOverviewContent's dispatch pattern (Phase 1), applied to
 *  Monitoring's live-polling charts instead of the static Overview
 *  snapshot. A category without one yet falls back to the same generic
 *  parameter cards every other unhandled category gets elsewhere. */
export async function MonitoringContent({ supabase, device }: { supabase: SupabaseServerClient; device: CustomerDevice }) {
  const category = device.deviceType?.category;

  if (category === "solar_inverter") {
    return <SolarInverterMonitoring supabase={supabase} device={device} />;
  }

  const parameters = await fetchDeviceParameterReadings(supabase, device);
  return <DeviceParameterCards parameters={parameters} />;
}

async function SolarInverterMonitoring({ supabase, device }: { supabase: SupabaseServerClient; device: CustomerDevice }) {
  // sections is this device's own real, DB-driven Monitoring field list - every group here is something this
  // specific installation's own equipment_metrics rows confirm exist.
  const sections = await fetchDashboardFields(supabase, device, "Monitoring");
  const byCategory = new Map(sections.map((s) => [s.category, s.groups]));

  // The "Temperature" group's own fields are shown exclusively via the Temperature Today heatmap (a time-series
  // view suits a sensor reading far better than one more flat current-value row).
  const inverterGroups = (byCategory.get("Inverter") ?? []).filter((g) => g.groupName !== "Temperature");
  const inverterTemperatureRows = temperatureRowsFor((byCategory.get("Inverter") ?? []).find((g) => g.groupName === "Temperature")?.fields ?? []);
  const batteryGroups = byCategory.get("Battery") ?? [];

  const dynamicFields = sections.flatMap((s) => s.groups.flatMap((g) => g.fields));
  const monitoringKeys = dynamicFields.map((f) => f.key);
  const enumRefs = Array.from(new Set(dynamicFields.map((f) => f.enumRef).filter((r): r is string => r !== null)));

  const [rawValues, lastSync, enumOptions] = await Promise.all([
    fetchFieldValues(supabase, device.id, [...monitoringKeys, ...OVERVIEW_CROSSREF_KEYS]),
    getLastSyncInfo(device.id),
    fetchEnumOptions(supabase, [...enumRefs, "inverter_state"]),
  ]);
  const values = resolveComputedValues(dynamicFields, rawValues, device);

  // Everything below is handed to the client view as plain data: the server renders the first numbers, the view
  // keeps them live (see SolarMonitoringView).
  const initialValues: Record<string, FieldValue> = {};
  for (const k of [...monitoringKeys, ...OVERVIEW_CROSSREF_KEYS, ...MONITORING_EXTRA_KEYS]) initialValues[k] = values.get(k) ?? rawValues.get(k) ?? null;
  const computedKeys = new Set(dynamicFields.filter((f) => f.source === "computed").map((f) => f.key));
  const liveKeys = Object.keys(initialValues).filter((k) => !computedKeys.has(k));

  return (
    <SolarMonitoringView
      deviceId={device.id}
      initialValues={initialValues}
      liveKeys={liveKeys}
      categories={Object.fromEntries(byCategory)}
      inverterGroups={inverterGroups}
      batteryGroups={batteryGroups}
      inverterTemperatureRows={inverterTemperatureRows}
      enumOptions={Object.fromEntries(enumOptions)}
      sync={lastSync}
    />
  );
}

// Keys the solar view reads directly (headline cards) that are not necessarily Monitoring-section fields.
const MONITORING_EXTRA_KEYS = [
  "grid_relay_status",
  "day_active_energy_kwh",
  "day_reactive_energy_kvarh",
  "inverter_l1_voltage_v",
  "inverter_l1_current_a",
  "inverter_output_frequency_hz",
  "inverter_output_power_w",
  "total_pv_energy_kwh",
  "day_battery_charge_energy_kwh",
  "day_battery_discharge_energy_kwh",
  "load_l1_power_w",
  "load_l2_power_w",
  "load_frequency_hz",
  "grid_l1_voltage_v",
  "grid_l1_current_a",
  "grid_frequency_hz",
  "generator_power_w",
  "generator_voltage_v",
  "generator_frequency_hz",
];
