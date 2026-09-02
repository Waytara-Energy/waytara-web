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

/** Flow-diagram fields, one per node — Overview reads these for the live
 *  wattage labels and arrow directions. */
export const FLOW_POWER_KEYS: Record<FlowNode, string> = {
  solar: "ac_output_power_w", // combined PV output (pv1_power_w + pv2_power_w also available individually)
  battery: "battery_power_w",
  grid: "grid_power_w",
  load: "load_power_w",
};

export const TODAY_ENERGY_FIELDS: TelemetryField[] = [
  { key: "daily_yield_kwh", label: "Solar generated", unit: "kWh", decimals: 1 },
  { key: "day_grid_import_kwh", label: "Grid imported", unit: "kWh", decimals: 1 },
  { key: "day_grid_export_kwh", label: "Grid exported", unit: "kWh", decimals: 1 },
  { key: "day_load_kwh", label: "Load consumed", unit: "kWh", decimals: 1 },
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
  { key: "dc_transformer_temp_c", label: "DC Transformer", warnAboveC: 75 },
  { key: "radiator_temp_c", label: "Radiator", warnAboveC: 85 },
];

export const LIVE_CHART_FIELDS: TelemetryField[] = [
  { key: "ac_output_power_w", label: "Solar Power", unit: "W" },
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
