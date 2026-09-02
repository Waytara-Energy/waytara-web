import { Badge } from "@/components/ui/badge";
import { getInverterStateLabel } from "@/lib/telemetry-catalog";

const TONE_VARIANT = {
  good: "default",
  neutral: "secondary",
  bad: "alert",
} as const;

/** The LCD's own three-state summary ([59] in the manual) — Normal /
 *  Standby / Fault, next to the Overview heading. `activeFaultCode` is a
 *  separate register ([103-106]) from `inverterState` ([59]) — nothing
 *  guarantees the ingestion script always keeps them in lockstep, so a
 *  non-zero fault code always wins here even if the state register
 *  hasn't (yet) reported Fault itself. */
export function DeviceStatusPill({
  inverterState,
  activeFaultCode,
}: {
  inverterState: number | null;
  activeFaultCode?: number | null;
}) {
  const { label, tone } = activeFaultCode ? { label: "Fault", tone: "bad" as const } : getInverterStateLabel(inverterState);
  return (
    <Badge variant={TONE_VARIANT[tone]} className="capitalize">
      {label}
    </Badge>
  );
}
