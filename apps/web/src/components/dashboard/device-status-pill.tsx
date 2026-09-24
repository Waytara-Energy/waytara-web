import { StatusPill, type StatusTone } from "./status-pill";
import type { EnumOption } from "@/lib/instrument-catalog-data";

// Real Deye inverter_state codes (register 59, from instrument_enum_values
// enum_ref 'inverter_state' — the manual's own enum, not a guess): 0=Standby,
// 1=Self-check, 2=Normal, 3=Alarm, 4=Fault, 5=Activating. Tone is presentation
// logic (StatusTone only has good/neutral/bad, no separate "warn"), so Alarm
// groups with Fault rather than Standby.
const INVERTER_STATE_TONE: Record<number, StatusTone> = {
  0: "neutral", // Standby
  1: "neutral", // Self-check
  2: "good", // Normal
  3: "bad", // Alarm
  4: "bad", // Fault
  5: "neutral", // Activating
};

/** The LCD's own state summary ([59] in the manual). `activeFaultCode` is a
 *  separate register ([103-106]) from `inverterState` ([59]) — nothing
 *  guarantees the ingestion script always keeps them in lockstep, so a
 *  non-zero fault code always wins here even if the state register hasn't
 *  (yet) reported Fault itself. Solar-inverter-specific — see StatusPill
 *  for the shared rendering and each other category's own wrapper around
 *  it (e.g. EvChargerOverview's connector-status pill). */
export function DeviceStatusPill({
  inverterState,
  activeFaultCode,
  inverterStateOptions,
  variant,
}: {
  inverterState: number | null;
  activeFaultCode?: number | null;
  /** inverter_state's instrument_enum_values options — a plain array
   *  (fetchEnumOptions(supabase, ["inverter_state"]).get("inverter_state")),
   *  not the whole enum Map, so this stays a pure presentational component. */
  inverterStateOptions: EnumOption[];
  variant?: "badge" | "text";
}) {
  if (activeFaultCode) {
    return <StatusPill label="Fault" tone="bad" variant={variant} />;
  }
  if (inverterState === null) {
    return <StatusPill label="Unknown" tone="neutral" variant={variant} />;
  }
  const match = inverterStateOptions.find((o) => o.code === String(inverterState));
  return <StatusPill label={match?.label ?? `State ${inverterState}`} tone={INVERTER_STATE_TONE[inverterState] ?? "neutral"} variant={variant} />;
}
