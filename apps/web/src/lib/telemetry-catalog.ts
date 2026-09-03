/**
 * The read-side counterpart to instrument-settings-catalog.ts: which
 * telemetry instrument keys exist per device type, how to label/format
 * them, and which "flow node" or module they belong to. Not DB-backed —
 * device_type_instruments is the source of truth for *what exists*, this
 * file is the source of truth for *how to present it*, same split already
 * established between the two catalogs.
 *
 * Sign conventions (also documented in the migration that seeds these
 * instrument keys):
 *   battery_power_w: positive = charging, negative = discharging
 *   grid_power_w:    positive = importing, negative = exporting
 */

export type FlowNode = "solar" | "battery" | "grid" | "load";

export interface TelemetryField {
  key: string;
  label: string;
  unit?: string;
  /** Rounds to this many decimal places for display; omitted = integer. */
  decimals?: number;
}

export const INVERTER_STATE_LABELS: Record<number, { label: string; tone: "good" | "neutral" | "bad" }> = {
  0: { label: "Normal", tone: "good" },
  1: { label: "Standby", tone: "neutral" },
  2: { label: "Fault", tone: "bad" },
};

export function getInverterStateLabel(value: number | null | undefined): { label: string; tone: "good" | "neutral" | "bad" } {
  if (value === null || value === undefined) return { label: "Unknown", tone: "neutral" };
  return INVERTER_STATE_LABELS[value] ?? { label: `State ${value}`, tone: "neutral" };
}

/** [92] in the manual — whether the inverter's onboard SD-card logging is
 *  working. A separate signal from the customer-facing "last sync"
 *  indicator: SD status is the device's own self-report, last-sync is
 *  this app inferring freshness from when a reading last arrived — the
 *  two can disagree (e.g. SD healthy but the RS485 bridge is down). */
export const SD_STATUS_LABELS: Record<number, { label: string; tone: "good" | "neutral" | "bad" }> = {
  0: { label: "Healthy", tone: "good" },
  1: { label: "Fault", tone: "bad" },
  2: { label: "Not Present", tone: "neutral" },
};

export function getSdStatusLabel(value: number | null | undefined): { label: string; tone: "good" | "neutral" | "bad" } {
  if (value === null || value === undefined) return { label: "Unknown", tone: "neutral" };
  return SD_STATUS_LABELS[value] ?? { label: `Status ${value}`, tone: "neutral" };
}

/** Flow-diagram fields, one per node — Overview reads these for the live
 *  wattage labels and arrow directions. */
export const FLOW_POWER_KEYS: Record<FlowNode, string> = {
  solar: "inverter_power_w", // combined PV output (pv1_power_w + pv2_power_w also available individually)
  battery: "battery_power_w",
  grid: "grid_power_w",
  load: "load_power_w",
};

export const TODAY_ENERGY_FIELDS: TelemetryField[] = [
  { key: "solar_energy_today_kwh", label: "Solar generated", unit: "kWh", decimals: 1 },
  { key: "grid_buy_energy_today_kwh", label: "Grid imported", unit: "kWh", decimals: 1 },
  { key: "grid_sell_energy_today_kwh", label: "Grid exported", unit: "kWh", decimals: 1 },
  { key: "load_energy_today_kwh", label: "Load consumed", unit: "kWh", decimals: 1 },
  { key: "day_active_energy_kwh", label: "Active energy", unit: "kWh", decimals: 1 },
  { key: "day_reactive_energy_kvarh", label: "Reactive energy", unit: "kVarh", decimals: 1 },
];

/** Read-side coverage pass (Phase 3): the 34 confirmed-register fields
 *  that had no home in the UI yet, minus the 3 Generator/AUX fields
 *  (no hardware connected — would sit permanently blank). Grouped to
 *  match `MetricListCard`'s 4 mounts on Monitoring — one detail card per
 *  flow node, labels dropping the redundant category prefix the card
 *  title already carries (DB's "Battery Voltage" -> card "Battery
 *  Detail" / row "Voltage"). */
export const BATTERY_DETAIL_FIELDS: TelemetryField[] = [
  { key: "battery_voltage_v", label: "Voltage", unit: "V", decimals: 2 },
  { key: "battery_current_a", label: "Current", unit: "A", decimals: 2 },
  { key: "battery_charge_limit_current_a", label: "Charge current limit", unit: "A" },
  { key: "battery_discharge_limit_current_a", label: "Discharge current limit", unit: "A" },
  { key: "battery_charging_voltage_v", label: "Charging voltage target", unit: "V", decimals: 2 },
  { key: "bat1_soc_pct", label: "BMS reported SOC", unit: "%" },
];

export const INVERTER_DETAIL_FIELDS: TelemetryField[] = [
  { key: "inverter_voltage_v", label: "Voltage", unit: "V", decimals: 1 },
  { key: "inverter_current_a", label: "Current", unit: "A", decimals: 2 },
  { key: "inverter_frequency_hz", label: "Frequency", unit: "Hz", decimals: 2 },
  { key: "environment_temp_c", label: "Ambient temperature", unit: "°C", decimals: 1 },
];

export const GRID_DETAIL_FIELDS: TelemetryField[] = [
  { key: "grid_voltage_v", label: "Voltage", unit: "V", decimals: 1 },
  { key: "grid_frequency_hz", label: "Frequency", unit: "Hz", decimals: 2 },
  { key: "grid_current_a", label: "Current", unit: "A", decimals: 2 },
  { key: "grid_ct_power_w", label: "CT clamp power", unit: "W" },
  { key: "grid_ld_power_w", label: "L/D power", unit: "W" },
  { key: "grid_l2_power_w", label: "L2 power", unit: "W" },
];

export const LOAD_DETAIL_FIELDS: TelemetryField[] = [
  { key: "load_frequency_hz", label: "Frequency", unit: "Hz", decimals: 2 },
  { key: "load_l1_power_w", label: "L1 power", unit: "W" },
  { key: "load_l2_power_w", label: "L2 power", unit: "W" },
];

/** Month/Year/Lifetime running counters — Performance's "Period &
 *  Lifetime Totals" section. `total_pv_energy_kwh` is deliberately not
 *  repeated here — Performance already shows it as its own "lifetime PV"
 *  stat tile. */
export const MONTH_TOTAL_FIELDS: TelemetryField[] = [
  { key: "month_pv_energy_kwh", label: "Solar", unit: "kWh", decimals: 1 },
  { key: "month_grid_energy_kwh", label: "Grid", unit: "kWh", decimals: 1 },
  { key: "month_load_energy_kwh", label: "Load", unit: "kWh", decimals: 1 },
];

export const YEAR_TOTAL_FIELDS: TelemetryField[] = [
  { key: "year_pv_energy_kwh", label: "Solar", unit: "kWh", decimals: 1 },
  { key: "year_grid_export_kwh", label: "Grid exported", unit: "kWh", decimals: 1 },
  { key: "year_load_energy_kwh", label: "Load", unit: "kWh", decimals: 1 },
];

export const LIFETIME_TOTAL_FIELDS: TelemetryField[] = [
  { key: "total_active_energy_kwh", label: "Active energy", unit: "kWh", decimals: 1 },
  { key: "total_battery_charge_kwh", label: "Battery charged", unit: "kWh", decimals: 1 },
  { key: "total_battery_discharge_kwh", label: "Battery discharged", unit: "kWh", decimals: 1 },
  { key: "total_grid_export_kwh", label: "Grid exported", unit: "kWh", decimals: 1 },
  { key: "total_grid_import_kwh", label: "Grid imported", unit: "kWh", decimals: 1 },
  { key: "total_load_energy_kwh", label: "Load consumed", unit: "kWh", decimals: 1 },
];

export const PV_STRING_FIELDS = {
  pv1: [
    { key: "pv1_voltage_v", label: "Voltage", unit: "V", decimals: 1 },
    { key: "pv1_current_a", label: "Current", unit: "A", decimals: 1 },
    { key: "pv1_power_w", label: "Power", unit: "W" },
  ],
  pv2: [
    { key: "pv2_voltage_v", label: "Voltage", unit: "V", decimals: 1 },
    { key: "pv2_current_a", label: "Current", unit: "A", decimals: 1 },
    { key: "pv2_power_w", label: "Power", unit: "W" },
  ],
} satisfies Record<"pv1" | "pv2", TelemetryField[]>;

export interface TemperatureField {
  key: string;
  label: string;
  /** Manual's stated safe operating ceiling — used to flag a reading as
   *  trending high. Not a hard cutoff, just a visual warning threshold. */
  warnAboveC: number;
}

export const TEMPERATURE_FIELDS: TemperatureField[] = [
  { key: "battery_temp_c", label: "Battery", warnAboveC: 45 },
  { key: "inverter_dc_temp_c", label: "DC Transformer", warnAboveC: 75 },
  { key: "inverter_ac_temp_c", label: "Radiator", warnAboveC: 85 },
];

export const LIVE_CHART_FIELDS: TelemetryField[] = [
  { key: "inverter_power_w", label: "Solar Power", unit: "W" },
  { key: "battery_power_w", label: "Battery Power", unit: "W" },
  { key: "grid_power_w", label: "Grid Power", unit: "W" },
  { key: "load_power_w", label: "Load Power", unit: "W" },
  { key: "battery_soc_pct", label: "Battery SOC", unit: "%" },
];

export function formatValue(value: number | null | undefined, field: TelemetryField): string {
  if (value === null || value === undefined) return "—";
  const rounded = field.decimals !== undefined ? value.toFixed(field.decimals) : Math.round(value).toLocaleString("en-IN");
  return field.unit ? `${rounded} ${field.unit}` : rounded;
}

/** For a signed power reading: which direction it represents right now,
 *  and a human label for that direction. Zero counts as "idle" rather
 *  than either direction. */
export function signedDirection(
  value: number | null | undefined,
  positiveLabel: string,
  negativeLabel: string
): { direction: "positive" | "negative" | "idle"; label: string } {
  if (value === null || value === undefined || value === 0) return { direction: "idle", label: "Idle" };
  return value > 0 ? { direction: "positive", label: positiveLabel } : { direction: "negative", label: negativeLabel };
}
