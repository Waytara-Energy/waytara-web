/**
 * Which instrument settings are configurable per device type, and how to
 * render/validate each one. No catalog table backs this yet (Task 11.3's
 * device/instrument catalog editor is where it'd move if it needs to be
 * admin-editable) — a reasonable first pass in code, same spirit as the
 * device_type_instruments seed data ("settings mirroring the deye_settings
 * sheet", Deye being the reference inverter brand for solar_inverter).
 */

export type SettingFieldType = "number" | "select";

export interface SettingFieldOption {
  value: string;
  label: string;
}

export interface SettingField {
  key: string;
  label: string;
  category: string;
  type: SettingFieldType;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: SettingFieldOption[];
  helpText?: string;
}

export const INSTRUMENT_SETTINGS_CATALOG: Record<string, SettingField[]> = {
  solar_inverter: [
    {
      key: "operating_mode",
      label: "Operating mode",
      category: "operation",
      type: "select",
      options: [
        { value: "self_consumption", label: "Self-consumption" },
        { value: "backup", label: "Backup priority" },
        { value: "time_of_use", label: "Time-of-use" },
      ],
      helpText: "How the inverter prioritizes solar, battery, and grid power.",
    },
    {
      key: "grid_export_limit_pct",
      label: "Grid export limit",
      category: "grid",
      type: "number",
      unit: "%",
      min: 0,
      max: 100,
      step: 5,
      helpText: "Caps how much surplus solar power is exported to the grid.",
    },
  ],
  battery_storage: [
    {
      key: "charge_cutoff_soc_pct",
      label: "Charge cutoff",
      category: "battery",
      type: "number",
      unit: "%",
      min: 50,
      max: 100,
      step: 1,
      helpText: "Stops charging once the battery reaches this level.",
    },
    {
      key: "discharge_cutoff_soc_pct",
      label: "Discharge cutoff",
      category: "battery",
      type: "number",
      unit: "%",
      min: 0,
      max: 50,
      step: 1,
      helpText: "Stops discharging once the battery drops to this level.",
    },
    {
      key: "backup_reserve_soc_pct",
      label: "Backup reserve",
      category: "battery",
      type: "number",
      unit: "%",
      min: 0,
      max: 100,
      step: 5,
      helpText: "Charge kept in reserve for a grid outage.",
    },
  ],
  ev_charger: [
    {
      key: "max_charging_current_a",
      label: "Max charging current",
      category: "ev",
      type: "number",
      unit: "A",
      min: 6,
      max: 32,
      step: 1,
    },
  ],
};

export function getSettingFields(deviceTypeCode: string): SettingField[] {
  return INSTRUMENT_SETTINGS_CATALOG[deviceTypeCode] ?? [];
}
