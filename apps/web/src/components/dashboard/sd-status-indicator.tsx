import { Badge } from "@/components/ui/badge";
import { getSdStatusLabel } from "@/lib/telemetry-catalog";

const TONE_VARIANT = {
  good: "default",
  neutral: "secondary",
  bad: "alert",
} as const;

/** [92] in the manual — the inverter's own onboard SD-card logging
 *  status. A separate signal from LastSyncIndicator: this is the
 *  device's self-report, last-sync is this app inferring freshness from
 *  when a reading last arrived — they can disagree. */
export function SdStatusIndicator({ value }: { value: number | null }) {
  const { label, tone } = getSdStatusLabel(value);
  return (
    <div className="flex items-center gap-2 rounded-lg border border-theme-border bg-theme-surface px-3 py-2 text-sm text-theme-muted">
      <span>SD Logging</span>
      <Badge variant={TONE_VARIANT[tone]} className="capitalize">
        {label}
      </Badge>
    </div>
  );
}
