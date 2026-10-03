import { EV_CONNECTOR_TEMP_WARN_C } from "./ev-charger-catalog";

/** Color/warn ceiling per temperature key_name, shared by every chart that
 *  reads it (Monitoring's Temperature Today heatmap, Maintenance's
 *  Temperature Trends gauges) — a reading at/above this is "hot". Not part
 *  of equipment_templates (a chart-display concern, not a device reading),
 *  so this is the one place it's hardcoded, instead of each consumer
 *  keeping its own copy that could drift out of sync with the others.
 *  The *label* for each of these keys must never live here — always pull
 *  it from the device's own equipment_templates.display_name instead (via
 *  fetchDashboardFields), so it can't drift from what the field actually
 *  is. */
export const TEMPERATURE_MAX_C: Record<string, number> = {
  inverter_dc_temperature_c: 75,
  inverter_ac_temperature_c: 85,
  battery_temperature_c: 45,
  connector_temperature_c: EV_CONNECTOR_TEMP_WARN_C,
};
