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
import type { EnumOption } from "./instrument-catalog-data";

export interface StatusInfo {
  label: string;
  tone: "good" | "neutral" | "bad";
}

// Tone stays presentation logic (good/neutral/bad color coding) — the
// label TEXT now resolves through instrument_enum_values (see
// instrument-catalog-data.ts's fetchEnumOptions), keyed by the same codes
// this map used to hardcode, so the code -> label mapping lives in one
// place shared with the Settings form's own enum dropdowns.
const CONNECTOR_STATUS_TONE: Record<number, StatusInfo["tone"]> = {
  0: "neutral", // Available
  1: "neutral", // Preparing
  2: "good", // Charging
  3: "neutral", // Suspended
  4: "bad", // Faulted
};

// Takes the plain connector_status option array (not the whole Map
// fetchEnumOptions returns) so client components — ChargingSessionsCarousel
// is interactive, not a server component — can receive it as an ordinary
// serializable prop rather than needing their own DB access.
export function getConnectorStatusLabel(value: number | null, options: EnumOption[]): StatusInfo {
  if (value === null) return { label: "Unknown", tone: "neutral" };
  const match = options.find((o) => o.code === String(value));
  return { label: match?.label ?? `Status ${value}`, tone: CONNECTOR_STATUS_TONE[value] ?? "neutral" };
}

// No OCPP-specified ceiling exists for connector temperature, so this
// reuses the same safety-margin warn threshold already established for the
// inverter's own temperature fields (telemetry-catalog's TEMPERATURE_FIELDS
// battery_temp_c) — shared here so Overview's live card and Monitoring's
// gauge cite the same number instead of two independent constants.
export const EV_CONNECTOR_TEMP_WARN_C = 45;

/** null when there's nothing to report (code 0/NoError, or null) — same
 *  "renders nothing when there's no fault" contract FaultBanner uses for
 *  the inverter, so a caller can show this unconditionally. Label text
 *  resolves through instrument_enum_values (enum_ref 'error_code'), same
 *  as getConnectorStatusLabel. */
export function getErrorCodeLabel(code: number | null, options: EnumOption[]): string | null {
  if (code === null || code === 0) return null;
  const match = options.find((o) => o.code === String(code));
  return match?.label ?? `Error ${code}`;
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
