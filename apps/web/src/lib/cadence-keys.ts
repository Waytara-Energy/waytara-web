// Which cadence group (and so which sheet tab) each register is stored in. Generated from the firmware's register table
// (esp32 scripts/m-supabase_register_push/registers.h): the group is the metric's cadence_seconds. Pure data, no server imports.

export type CadenceGroup = "fast_5s" | "mid_10s" | "slow_30s";

export const CADENCE_GROUP_KEYS: Record<CadenceGroup, string[]> = {"fast_5s":["inverter_output_power_w","battery_power_w","grid_total_power_w","load_total_power_w","pv1_power_w","pv2_power_w","pv1_voltage_v","pv1_current_a","pv2_voltage_v","pv2_current_a","battery_soc_pct","battery_voltage_v","battery_current_a","inverter_l1_voltage_v","inverter_l1_current_a","inverter_l1_power_w","inverter_output_frequency_hz","inverter_run_state","load_l1_power_w","load_l1_voltage_v","load_l1_current_a","load_frequency_hz","grid_l1_voltage_v","grid_l1_current_a","grid_frequency_hz","grid_ct_total_power_w","grid_ct_l1_power_w","grid_ct_l1_current_a"],"mid_10s":["fault_message_1","fault_message_2","fault_message_3","fault_message_4","alarm_status_1","alarm_status_2"],"slow_30s":["battery_temperature_c","bms_charge_current_limit_a","bms_discharge_current_limit_a","bms_charge_voltage_v","bms_temperature_c","inverter_ac_temperature_c","inverter_dc_temperature_c","day_pv_energy_kwh","day_grid_import_energy_kwh","day_grid_export_energy_kwh","day_load_energy_kwh","day_battery_charge_energy_kwh","day_battery_discharge_energy_kwh","day_active_energy_kwh","total_pv_energy_kwh","total_active_energy_kwh","total_battery_charge_energy_kwh","total_battery_discharge_energy_kwh","total_load_energy_kwh","total_grid_import_energy_kwh","total_grid_export_energy_kwh"]};

export const CADENCE_GROUP_STEP_S: Record<CadenceGroup, number> = { fast_5s: 5, mid_10s: 10, slow_30s: 30 };

const GROUP_OF = new Map<string, CadenceGroup>(
  (Object.entries(CADENCE_GROUP_KEYS) as [CadenceGroup, string[]][]).flatMap(([group, keys]) => keys.map((k) => [k, group] as const))
);

export function cadenceGroupOf(key: string): CadenceGroup | null {
  return GROUP_OF.get(key) ?? null;
}

/** Split a list of metric keys by the group they are stored in. Keys with no cadence data are returned in `unknown`. */
export function splitByGroup(keys: string[]): { groups: Partial<Record<CadenceGroup, string[]>>; unknown: string[] } {
  const groups: Partial<Record<CadenceGroup, string[]>> = {};
  const unknown: string[] = [];
  for (const k of new Set(keys)) {
    const g = cadenceGroupOf(k);
    if (!g) unknown.push(k);
    else (groups[g] ??= []).push(k);
  }
  return { groups, unknown };
}
