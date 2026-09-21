import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const TONE_VARIANT = {
  good: "default",
  neutral: "secondary",
  bad: "alert",
} as const;

// Same brand tokens each Badge tone above already uses (border/bg dropped,
// just the text color), so a "text" reading matches its "badge" one
// wherever the two appear side by side.
const TONE_TEXT_CLASS: Record<StatusTone, string> = {
  good: "text-theme-highlight",
  neutral: "text-theme-secondary",
  bad: "text-theme-alert",
};

export type StatusTone = keyof typeof TONE_VARIANT;

/** Bare Badge+tone rendering shared by every device category's own status
 *  pill (DeviceStatusPill for solar inverters, EvChargerOverview's own
 *  pill for chargers, and whatever a future category needs) — the
 *  domain-specific "what label/tone does this device's raw state mean"
 *  decision lives in each category's own catalog (telemetry-catalog.ts's
 *  getInverterStateLabel, ev-charger-catalog.ts's getConnectorStatusLabel,
 *  …), this component just renders whatever it's given.
 *
 *  `variant="text"` drops the pill background/border for a spot that wants
 *  just the tone-colored word (Monitoring's header) — defaults to the
 *  existing badge look everywhere else so no other caller changes. */
export function StatusPill({ label, tone, variant = "badge" }: { label: string; tone: StatusTone; variant?: "badge" | "text" }) {
  if (variant === "text") {
    return <span className={cn("text-sm font-semibold capitalize", TONE_TEXT_CLASS[tone])}>{label}</span>;
  }
  return (
    <Badge variant={TONE_VARIANT[tone]} className="capitalize">
      {label}
    </Badge>
  );
}
