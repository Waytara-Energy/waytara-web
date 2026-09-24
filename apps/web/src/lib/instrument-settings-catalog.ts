/**
 * Which instrument settings are configurable per device type, and how to
 * render/validate each one. No catalog table backs this yet (Task 11.3's
 * device/instrument catalog editor is where it'd move if it needs to be
 * admin-editable) — a reasonable first pass in code, same spirit as the
 * device_parameters seed data ("settings mirroring the deye_settings
 * sheet", Deye being the reference inverter brand for solar_inverter).
 *
 * solar_inverter's field list is scoped to `deye_sunsynk_write_registers.md`
 * §8's own "Confirmed register + safe to implement" list for the
 * SUN-8K-SG05LP1-EU-SM2-P (single-phase) model — everything the doc marks
 * "Not mapped (1PH)" (Batt Mode selector, Battery Capacity(Ah), most
 * Generator sub-settings, nearly all of Grid Setting and Advanced Function)
 * is deliberately left out of the catalog rather than exposed as a field
 * that would write an unconfirmed register. This app never talks to real
 * Modbus hardware directly — writes land in `device_settings` (an
 * append-only log) for the separate Node ingestion script to read and push
 * to the device, so "validation" here means real range/ordering rules, not
 * literal read-modify-write bitmask logic.
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
  /** Display-only — the field has a real value (from device_settings) but
   *  nothing writes to it here. Used for OCPP keys the spec itself marks
   *  Read-Only (ChargeProfileMaxStackLevel, SupportedFeatureProfiles): the
   *  charger reports them, a customer can't change them. SettingFieldRow
   *  renders these as plain text, and updateDeviceSetting refuses the
   *  write server-side too — not just hidden in the UI. */
  readOnly?: boolean;
}

export interface SettingCategoryMeta {
  key: string;
  label: string;
  helpText?: string;
}

/** Tab order + copy for the 6 Deye-backed categories (Site Setting is its
 *  own tab outside this catalog — it edits `sites`/`devices` columns
 *  directly, not `device_settings`). */
const SOLAR_INVERTER_SETTING_CATEGORIES: SettingCategoryMeta[] = [
  { key: "basic", label: "Basic Setting", helpText: "Display, clock, and master enable." },
  { key: "battery", label: "Battery Setting", helpText: "Charge/discharge limits and voltage thresholds." },
  {
    key: "system_work_mode",
    label: "System Work Mode",
    helpText: "How the inverter balances solar, battery, and grid — plus the Time-of-Use schedule.",
  },
  { key: "grid", label: "Grid Setting" },
  { key: "gen", label: "Gen Port Use / Generator" },
  {
    key: "advanced",
    label: "Advanced Function",
    helpText: "Nothing on this model is confirmed safe to write yet — informational only.",
  },
];

const EV_CHARGER_SETTING_CATEGORIES: SettingCategoryMeta[] = [
  {
    key: "ocpp_configuration",
    label: "Charger Configuration",
    helpText: "OCPP 1.6 Configuration Keys — read via GetConfiguration, changed via ChangeConfiguration.",
  },
];

/** Per-device-category tab list — each category gets its own set of tabs
 *  (a solar inverter's Battery/Grid/Gen tabs mean nothing for an EV
 *  charger, and vice versa), keyed the same way device_parameters.category
 *  and INSTRUMENT_SETTINGS_CATALOG already are. A device type without an
 *  entry here has nothing to show — the Devices page's settings section
 *  just doesn't render a Tabs block for it. */
const SETTING_CATEGORIES_BY_DEVICE_TYPE: Record<string, SettingCategoryMeta[]> = {
  solar_inverter: SOLAR_INVERTER_SETTING_CATEGORIES,
  ev_charger: EV_CHARGER_SETTING_CATEGORIES,
};

export function getSettingCategories(deviceTypeCode: string): SettingCategoryMeta[] {
  return SETTING_CATEGORIES_BY_DEVICE_TYPE[deviceTypeCode] ?? [];
}

const BMS_PROTOCOL_OPTIONS: SettingFieldOption[] = [
  { value: "none", label: "None / lead-acid (no BMS)" },
  { value: "pylontech_can", label: "Pylontech (CAN)" },
  { value: "custom_can", label: "Custom protocol (CAN)" },
  { value: "custom_rs485", label: "Custom protocol (RS485)" },
];

const GEN_PORT_USAGE_OPTIONS: SettingFieldOption[] = [
  { value: "none", label: "Not used" },
  { value: "generator", label: "Generator" },
  { value: "smart_load", label: "Smart Load / AUX" },
];

export const INSTRUMENT_SETTINGS_CATALOG: Record<string, SettingField[]> = {
  solar_inverter: [
    // basic
    { key: "beep_enabled", label: "Beep", category: "basic", type: "toggle", helpText: "Audible tone on button press / fault." },
    { key: "auto_dim_enabled", label: "Auto Dim", category: "basic", type: "toggle", helpText: "LCD dims automatically when idle." },
    { key: "time_sync_enabled", label: "Time Sync", category: "basic", type: "toggle", helpText: "Keep the inverter's clock synced automatically." },
    { key: "inverter_enabled", label: "Inverter enabled", category: "basic", type: "toggle", helpText: "Master on/off for the inverter's output." },

    // battery
    {
      key: "max_charge_current_a",
      label: "Max charge current",
      category: "battery",
      type: "number",
      unit: "A",
      min: 0,
      max: 190,
      step: 1,
      helpText: "Ceiling for this model is 190A.",
    },
    {
      key: "max_discharge_current_a",
      label: "Max discharge current",
      category: "battery",
      type: "number",
      unit: "A",
      min: 0,
      max: 190,
      step: 1,
      helpText: "Ceiling for this model is 190A.",
    },
    {
      key: "equalization_voltage_v",
      label: "Equalization voltage",
      category: "battery",
      type: "number",
      unit: "V",
      min: 40,
      max: 59,
      step: 0.1,
    },
    {
      key: "absorption_voltage_v",
      label: "Absorption voltage",
      category: "battery",
      type: "number",
      unit: "V",
      min: 40,
      max: 59,
      step: 0.1,
      helpText: "Must be at or below Equalization voltage.",
    },
    {
      key: "float_voltage_v",
      label: "Float voltage",
      category: "battery",
      type: "number",
      unit: "V",
      min: 40,
      max: 59,
      step: 0.1,
      helpText: "Must be below Absorption voltage.",
    },
    {
      key: "shutdown_capacity_pct",
      label: "Shutdown capacity",
      category: "battery",
      type: "number",
      unit: "%",
      min: 0,
      max: 100,
      step: 1,
      helpText: "Lowest of the three capacity thresholds.",
    },
    {
      key: "low_capacity_pct",
      label: "Low capacity",
      category: "battery",
      type: "number",
      unit: "%",
      min: 0,
      max: 100,
      step: 1,
    },
    {
      key: "restart_capacity_pct",
      label: "Restart capacity",
      category: "battery",
      type: "number",
      unit: "%",
      min: 0,
      max: 100,
      step: 1,
      helpText: "Highest of the three capacity thresholds.",
    },
    {
      key: "shutdown_voltage_v",
      label: "Shutdown voltage",
      category: "battery",
      type: "number",
      unit: "V",
      min: 40,
      max: 59,
      step: 0.1,
      helpText: "Lowest of the three voltage thresholds.",
    },
    {
      key: "low_voltage_v",
      label: "Low voltage",
      category: "battery",
      type: "number",
      unit: "V",
      min: 40,
      max: 59,
      step: 0.1,
    },
    {
      key: "restart_voltage_v",
      label: "Restart voltage",
      category: "battery",
      type: "number",
      unit: "V",
      min: 40,
      max: 59,
      step: 0.1,
      helpText: "Highest of the three voltage thresholds.",
    },
    {
      key: "grid_charge_current_a",
      label: "Grid charge current",
      category: "battery",
      type: "number",
      unit: "A",
      min: 0,
      max: 190,
      step: 1,
    },
    { key: "grid_charge_enabled", label: "Grid charge enabled", category: "battery", type: "toggle" },
    { key: "bms_protocol", label: "BMS Protocol", category: "battery", type: "select", options: BMS_PROTOCOL_OPTIONS },

    // system_work_mode (Time-of-Use is its own preset-picker, not a raw
    // catalog field — see tou-preset-picker.tsx)
    {
      key: "max_solar_power_w",
      label: "Max solar power",
      category: "system_work_mode",
      type: "number",
      unit: "W",
      min: 0,
      max: 8000,
      step: 100,
      helpText: "Ceiling for this model is 8000W.",
    },
    {
      key: "max_sell_power_w",
      label: "Max sell power",
      category: "system_work_mode",
      type: "number",
      unit: "W",
      min: 0,
      max: 8000,
      step: 100,
    },
    { key: "solar_export_enabled", label: "Solar export", category: "system_work_mode", type: "toggle" },
    {
      key: "load_limit_w",
      label: "Load limit",
      category: "system_work_mode",
      type: "number",
      unit: "W",
      min: 0,
      max: 8000,
      step: 100,
    },
    { key: "priority_load_enabled", label: "Priority load", category: "system_work_mode", type: "toggle" },
    {
      key: "peak_shaving_power_w",
      label: "Peak shaving power",
      category: "system_work_mode",
      type: "number",
      unit: "W",
      min: 0,
      max: 8000,
      step: 100,
    },
    {
      key: "use_timer_enabled",
      label: "Use Timer",
      category: "system_work_mode",
      type: "toggle",
      helpText: "Master switch for the Time-of-Use schedule below.",
    },

    // gen
    { key: "gen_port_usage", label: "Gen port usage", category: "gen", type: "select", options: GEN_PORT_USAGE_OPTIONS },
    { key: "gen_peak_shaving_enabled", label: "Gen peak-shaving", category: "gen", type: "toggle" },
    {
      key: "gen_peak_shaving_power_w",
      label: "Gen peak-shaving power",
      category: "gen",
      type: "number",
      unit: "W",
      min: 0,
      max: 8000,
      step: 100,
    },

    // grid
    { key: "grid_always_on_enabled", label: "Grid always on", category: "grid", type: "toggle" },
    {
      key: "grid_trickle_feed_power_w",
      label: "Grid trickle feed power",
      category: "grid",
      type: "number",
      unit: "W",
      min: 0,
      max: 500,
      step: 10,
    },

    // advanced: nothing on this model is a confirmed register — deliberately
    // no fields here. The Advanced Function tab renders its informational
    // "not available on this device model" state instead of an empty page.
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
  // OCPP 1.6 Configuration Keys (GetConfiguration/ChangeConfiguration) —
  // `key` is kept in its exact protocol casing (HeartbeatInterval, not
  // heartbeat_interval), unlike every other category's WayTara-invented
  // snake_case keys. Unlike a Modbus register, these are standardized
  // wire-format strings a real ChangeConfiguration call uses verbatim, so
  // renaming them here would break interoperability with the actual
  // charger once real hardware integration exists. `max_charging_current_a`
  // is a different mechanism entirely (SetChargingProfile, not a
  // Configuration Key) but lives in the same tab since it's the only field
  // of its kind — not worth a whole separate tab for one field.
  ev_charger: [
    {
      key: "max_charging_current_a",
      label: "Max charging current",
      category: "ocpp_configuration",
      type: "number",
      unit: "A",
      min: 6,
      max: 32,
      step: 1,
      helpText: "Sent via SetChargingProfile, not a Configuration Key — the ceiling this charger will ever draw.",
    },
    {
      key: "HeartbeatInterval",
      label: "Heartbeat interval",
      category: "ocpp_configuration",
      type: "number",
      unit: "s",
      min: 10,
      helpText: "How often the charger pings the server when idle.",
    },
    {
      key: "MeterValueSampleInterval",
      label: "Meter value sample interval",
      category: "ocpp_configuration",
      type: "number",
      unit: "s",
      min: 0,
      helpText: "Live telemetry update frequency — 0 disables periodic MeterValues.",
    },
    {
      key: "MeterValuesSampledData",
      label: "Sampled measurands",
      category: "ocpp_configuration",
      type: "text",
      helpText: "Comma-separated measurands reported on the interval above, e.g. Energy.Active.Import.Register,Power.Active.Import.",
    },
    {
      key: "MeterValuesAlignedData",
      label: "Clock-aligned measurands",
      category: "ocpp_configuration",
      type: "text",
      helpText: "Comma-separated measurands reported on the clock-aligned interval below.",
    },
    {
      key: "ClockAlignedDataInterval",
      label: "Clock-aligned interval",
      category: "ocpp_configuration",
      type: "number",
      unit: "s",
      min: 0,
      helpText: "Cadence for clock-aligned energy logs, e.g. 900 = every 15 minutes.",
    },
    {
      key: "ConnectionTimeOut",
      label: "Connection timeout",
      category: "ocpp_configuration",
      type: "number",
      unit: "s",
      min: 0,
      helpText: "Time an authorized user has to plug in before the session is canceled.",
    },
    {
      key: "AuthorizeRemoteTxRequests",
      label: "Authorize remote start/stop",
      category: "ocpp_configuration",
      type: "toggle",
      helpText: "Whether the charger must verify the idTag with an Authorize.req when remotely started.",
    },
    {
      key: "LocalAuthorizeOffline",
      label: "Local authorize when offline",
      category: "ocpp_configuration",
      type: "toggle",
      helpText: "Allows whitelist-based offline charging when the connection to WayTara drops.",
    },
    {
      key: "LocalPreAuthorize",
      label: "Local pre-authorize",
      category: "ocpp_configuration",
      type: "toggle",
      helpText: "Starts charging immediately from the local cache while cloud authorization runs in parallel.",
    },
    {
      key: "StopTransactionOnEVSideDisconnect",
      label: "Stop on EV disconnect",
      category: "ocpp_configuration",
      type: "toggle",
      helpText: "Whether unplugging the EV stops the session outright vs. pausing it (Suspended).",
    },
    {
      key: "UnlockConnectorOnEVSideDisconnect",
      label: "Unlock on EV disconnect",
      category: "ocpp_configuration",
      type: "toggle",
      helpText: "Automatically unlocks the charging gun from the socket when the car unplugs.",
    },
    {
      key: "ResetRetries",
      label: "Reset retries",
      category: "ocpp_configuration",
      type: "number",
      min: 0,
      helpText: "Number of times the charger attempts a self-reset on soft faults.",
    },
    {
      key: "TransactionMessageRetryInterval",
      label: "Transaction message retry interval",
      category: "ocpp_configuration",
      type: "number",
      unit: "s",
      min: 0,
      helpText: "Retry interval for dropped transaction packets when reconnecting.",
    },
    {
      key: "ChargeProfileMaxStackLevel",
      label: "Charge profile max stack level",
      category: "ocpp_configuration",
      type: "number",
      readOnly: true,
      helpText: "Supported smart-charging profile hierarchy depth — reported by the charger, not settable.",
    },
    {
      key: "SupportedFeatureProfiles",
      label: "Supported feature profiles",
      category: "ocpp_configuration",
      type: "text",
      readOnly: true,
      helpText: "OCPP feature profiles this charger supports — reported by the charger, not settable.",
    },
  ],
};

export function getSettingFields(deviceTypeCode: string): SettingField[] {
  return INSTRUMENT_SETTINGS_CATALOG[deviceTypeCode] ?? [];
}

export function getSettingFieldsByCategory(deviceTypeCode: string, category: string): SettingField[] {
  return getSettingFields(deviceTypeCode).filter((f) => f.category === category);
}

/**
 * Cross-field rules that can't be expressed as a single field's min/max —
 * they depend on the *other* current values in the same category. Callers
 * pass the full proposed set for the category (current values merged with
 * the one field actually being changed) since `device_settings` is an
 * append-only log of individual key writes, not a row callers can read
 * "the whole form" back from atomically.
 *
 * Returns an error message, or null if the set is valid. Only checks a
 * rule when every value it needs is present and numeric — a customer who
 * hasn't set one of the three thresholds yet isn't blocked from setting
 * another.
 */
export function validateBatteryCrossFields(values: Partial<Record<string, string>>): string | null {
  const num = (key: string): number | null => {
    const v = values[key];
    if (v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const shutdownPct = num("shutdown_capacity_pct");
  const lowPct = num("low_capacity_pct");
  const restartPct = num("restart_capacity_pct");
  if (shutdownPct !== null && lowPct !== null && !(shutdownPct < lowPct)) {
    return "Shutdown capacity must be lower than Low capacity.";
  }
  if (lowPct !== null && restartPct !== null && !(lowPct < restartPct)) {
    return "Low capacity must be lower than Restart capacity.";
  }
  if (shutdownPct !== null && restartPct !== null && !(shutdownPct < restartPct)) {
    return "Shutdown capacity must be lower than Restart capacity.";
  }

  const shutdownV = num("shutdown_voltage_v");
  const lowV = num("low_voltage_v");
  const restartV = num("restart_voltage_v");
  if (shutdownV !== null && lowV !== null && !(shutdownV < lowV)) {
    return "Shutdown voltage must be lower than Low voltage.";
  }
  if (lowV !== null && restartV !== null && !(lowV < restartV)) {
    return "Low voltage must be lower than Restart voltage.";
  }
  if (shutdownV !== null && restartV !== null && !(shutdownV < restartV)) {
    return "Shutdown voltage must be lower than Restart voltage.";
  }

  const floatV = num("float_voltage_v");
  const absorptionV = num("absorption_voltage_v");
  const equalizationV = num("equalization_voltage_v");
  if (floatV !== null && absorptionV !== null && !(floatV < absorptionV)) {
    return "Float voltage must be lower than Absorption voltage.";
  }
  if (absorptionV !== null && equalizationV !== null && !(absorptionV <= equalizationV)) {
    return "Absorption voltage must be at or below Equalization voltage.";
  }

  return null;
}
