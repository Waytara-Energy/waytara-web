// Metric keys and combination rules for Overview, in a module with no server-only imports so both the server
// (which renders the first numbers) and the client (which keeps them live) use the same lists.

export const TODAY_ENERGY_KEYS = ["day_pv_energy_kwh", "day_grid_import_energy_kwh", "day_grid_export_energy_kwh", "day_load_energy_kwh"];

// The new workbook has no single fault-code register, only per-source bitmasks.
export const FAULT_BITMASK_KEYS = ["fault_message_1", "fault_message_2", "fault_message_3", "fault_message_4", "alarm_status_1", "alarm_status_2"];
export const FAULT_BITMASK_KEYS_LIVE = FAULT_BITMASK_KEYS;

export const SITE_FLOW_KEYS = ["inverter_output_power_w", "battery_power_w", "grid_total_power_w", "load_total_power_w"];

/** Everything Overview shows live. */
export const SITE_OVERVIEW_KEYS = [...SITE_FLOW_KEYS, "battery_soc_pct", "inverter_run_state", ...FAULT_BITMASK_KEYS, ...TODAY_ENERGY_KEYS] as const;

/** How a metric of several inverters at one site combines: flows and day totals add up, state of charge averages,
 *  and for state/fault registers the worst (highest) one wins. */
export function siteAgg(key: string): "sum" | "avg" | "max" {
  if (key === "battery_soc_pct") return "avg";
  if (key === "inverter_run_state" || FAULT_BITMASK_KEYS.includes(key)) return "max";
  return "sum";
}

/** Every metric the Overview shows (the energy flow, the status row, today-so-far): what it asks the device for while Go Live is on. */
export const OVERVIEW_LIVE_KEYS: string[] = [
  ...new Set<string>([...SITE_OVERVIEW_KEYS, "inverter_output_power_w", "load_total_power_w", "battery_soc_pct", "grid_total_power_w", "battery_power_w"]),
];
