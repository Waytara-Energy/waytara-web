/**
 * The read-side presentation catalog for the ev_charger category — the
 * OCPP counterpart to telemetry-catalog.ts's inverter-oriented fields and
 * getInverterStateLabel/getSdStatusLabel. Kept in its own file rather than
 * folded into telemetry-catalog.ts: this app is meant to grow more device
 * categories/vendors over time (see EvChargerOverview's own comment), and
 * each one gets its own catalog module like this rather than one file
 * accumulating every category's domain knowledge.
 */

import type { TelemetryField } from "./telemetry-catalog";

export interface StatusInfo {
  label: string;
  tone: "good" | "neutral" | "bad";
}

// OCPP 1.6 StatusNotification.status — matches the encoding documented in
// the 20260917000000_ev_charger_ocpp_parameters.sql migration.
const CONNECTOR_STATUS_LABELS: Record<number, StatusInfo> = {
  0: { label: "Available", tone: "neutral" },
  1: { label: "Preparing", tone: "neutral" },
  2: { label: "Charging", tone: "good" },
  3: { label: "Suspended", tone: "neutral" },
  4: { label: "Faulted", tone: "bad" },
};

export function getConnectorStatusLabel(value: number | null): StatusInfo {
  if (value === null) return { label: "Unknown", tone: "neutral" };
  return CONNECTOR_STATUS_LABELS[value] ?? { label: `Status ${value}`, tone: "neutral" };
}

// No OCPP-specified ceiling exists for connector temperature, so this
// reuses the same safety-margin warn threshold already established for the
// inverter's own temperature fields (telemetry-catalog's TEMPERATURE_FIELDS
// battery_temp_c) — shared here so Overview's live card and Monitoring's
// gauge cite the same number instead of two independent constants.
export const EV_CONNECTOR_TEMP_WARN_C = 45;

// OCPP 1.6 StatusNotification.errorCode enum, in the order the spec itself
// lists it — index 0 is NoError (matches the seeded sample data), every
// other index maps 1:1 onto the spec's remaining values. Arbitrary but
// documented + stable, same "friendly key instead of a raw protocol
// number" reasoning already used for device_readings.instrument_key
// elsewhere in this app.
const OCPP_ERROR_CODES = [
  "NoError",
  "ConnectorLockFailure",
  "EVCommunicationError",
  "GroundFailure",
  "HighTemperature",
  "InternalError",
  "LocalListConflict",
  "OtherError",
  "OverCurrentFailure",
  "OverVoltage",
  "PowerMeterFailure",
  "PowerSwitchFailure",
  "ReaderFailure",
  "ResetFailure",
  "UnderVoltage",
  "WeakSignal",
];

/** null when there's nothing to report (code 0/null) — same "renders
 *  nothing when there's no fault" contract FaultBanner uses for the
 *  inverter, so a caller can show this unconditionally. */
export function getErrorCodeLabel(code: number | null): string | null {
  if (code === null || code === 0) return null;
  return OCPP_ERROR_CODES[code] ?? `Error ${code}`;
}

// The live charging snapshot — what's actually flowing right now.
export const EV_LIVE_FIELDS: TelemetryField[] = [
  { key: "power_active_import_w", label: "Charging Power", unit: "W" },
  { key: "power_offered_w", label: "Power Offered", unit: "W" },
  { key: "current_import_a", label: "Current", unit: "A", decimals: 1 },
  { key: "voltage_v", label: "Voltage", unit: "V" },
];

// Cumulative/health figures — deliberately labeled "Total", not "Today":
// energy_active_import_register_kwh is OCPP's lifetime meter register, not
// a day-bucketed counter the way the inverter's solar_energy_today_kwh is
// (that one has dedicated day/month/year registers; the charger's OCPP
// telemetry doesn't), so showing it as a "today" figure would be wrong.
export const EV_TOTAL_FIELDS: TelemetryField[] = [
  { key: "energy_active_import_register_kwh", label: "Total Energy Delivered", unit: "kWh", decimals: 1 },
  { key: "temperature_c", label: "Connector Temperature", unit: "°C", decimals: 1 },
];

// Overview is a today/now snapshot (see fetchTodayEvEnergyKwh's own
// comment in device-overview.ts) — the lifetime energy register has no
// place there, only the live/health figures that aren't time-integrated.
// Used by both EvChargerOverview and Overview's own "All" tab so the two
// never drift on which EV_TOTAL_FIELDS entries belong on a today view.
export const EV_TODAY_DETAIL_FIELDS: TelemetryField[] = EV_TOTAL_FIELDS.filter(
  (f) => f.key !== "energy_active_import_register_kwh"
);
