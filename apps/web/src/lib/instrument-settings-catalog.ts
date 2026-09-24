/**
 * Which instrument settings are configurable per device type, and how to
 * render/validate each one — for whichever device categories
 * instrument_catalog doesn't (yet) cover. solar_inverter and ev_charger
 * both moved onto the DB-driven catalog entirely (see
 * instrument-catalog-data.ts / instrument-setting-row.tsx).
 * battery_storage has no instrument_catalog rows of its own yet — no real
 * register source for it — so it still lives here as a hardcoded first
 * pass.
 */

export type SettingFieldType = "number" | "select" | "toggle" | "text";

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
  readOnly?: boolean;
}

export const INSTRUMENT_SETTINGS_CATALOG: Record<string, SettingField[]> = {
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
};

export function getSettingFields(deviceTypeCode: string): SettingField[] {
  return INSTRUMENT_SETTINGS_CATALOG[deviceTypeCode] ?? [];
}

export function getSettingFieldsByCategory(deviceTypeCode: string, category: string): SettingField[] {
  return getSettingFields(deviceTypeCode).filter((f) => f.category === category);
}
