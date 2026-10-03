/**
 * The read-side presentation catalog for the ev_charger category — status/
 * error label lookups shared by every EV-facing page. The old hardcoded
 * field-list constants this file used to also export (EV_LIVE_FIELDS/
 * EV_TOTAL_FIELDS/EV_TODAY_DETAIL_FIELDS) are gone — every dashboard page
 * now sources its field list from template-fields.ts's fetchDashboardFields
 * instead (see that file's own doc comment).
 */

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
  if (value === null) return { label: "No data", tone: "neutral" };
  const match = options.find((o) => o.code === String(value));
  return { label: match?.label ?? `Status ${value}`, tone: CONNECTOR_STATUS_TONE[value] ?? "neutral" };
}

// No OCPP-specified ceiling exists for connector temperature, so this
// reuses the same safety-margin warn threshold already established for the
// inverter's own battery temperature gauge — shared here so Overview's live
// card and Monitoring's gauge cite the same number instead of two
// independent constants.
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
