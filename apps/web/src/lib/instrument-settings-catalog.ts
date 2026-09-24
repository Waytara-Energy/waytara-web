/**
 * Which instrument settings are configurable per device type, and how to
 * render/validate each one — for whichever device categories
 * instrument_catalog doesn't (yet) cover. solar_inverter moved onto the
 * DB-driven catalog entirely (see device-settings-data.ts /
 * instrument-setting-row.tsx); ev_charger's OCPP Configuration Keys and
 * battery_storage have no instrument_catalog rows of their own yet (the
 * seed migration only covers the Deye solar inverter's real register
 * map), so they still live here as a hardcoded first pass.
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

const EV_CHARGER_SETTING_CATEGORIES: SettingCategoryMeta[] = [
  {
    key: "ocpp_configuration",
    label: "Charger Configuration",
    helpText: "OCPP 1.6 Configuration Keys — read via GetConfiguration, changed via ChangeConfiguration.",
  },
];

/** Per-device-category tab list, keyed the same way INSTRUMENT_SETTINGS_CATALOG
 *  is. A device type without an entry here has nothing to show — the
 *  Devices page's settings section just doesn't render a Tabs block for it. */
const SETTING_CATEGORIES_BY_DEVICE_TYPE: Record<string, SettingCategoryMeta[]> = {
  ev_charger: EV_CHARGER_SETTING_CATEGORIES,
};

export function getSettingCategories(deviceTypeCode: string): SettingCategoryMeta[] {
  return SETTING_CATEGORIES_BY_DEVICE_TYPE[deviceTypeCode] ?? [];
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
