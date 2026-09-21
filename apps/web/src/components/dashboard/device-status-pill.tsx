import { StatusPill } from "./status-pill";
import { getInverterStateLabel } from "@/lib/telemetry-catalog";

/** The LCD's own three-state summary ([59] in the manual) — Normal /
 *  Standby / Fault, next to the Overview heading. `activeFaultCode` is a
 *  separate register ([103-106]) from `inverterState` ([59]) — nothing
 *  guarantees the ingestion script always keeps them in lockstep, so a
 *  non-zero fault code always wins here even if the state register
 *  hasn't (yet) reported Fault itself. Solar-inverter-specific — see
 *  StatusPill for the shared rendering and each other category's own
 *  wrapper around it (e.g. EvChargerOverview's connector-status pill). */
export function DeviceStatusPill({
  inverterState,
  activeFaultCode,
  variant,
}: {
  inverterState: number | null;
  activeFaultCode?: number | null;
  variant?: "badge" | "text";
}) {
  const { label, tone } = activeFaultCode ? { label: "Fault", tone: "bad" as const } : getInverterStateLabel(inverterState);
  return <StatusPill label={label} tone={tone} variant={variant} />;
}
