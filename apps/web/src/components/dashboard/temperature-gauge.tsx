import { cn } from "@/lib/utils";

/** A simple horizontal gauge against the manual's own stated safe-operating
 *  ceiling for each temperature field (telemetry-catalog.ts's
 *  `warnAboveC`) — not a hard cutoff, just a visual heads-up before it
 *  actually trips a fault. Reused by Maintenance for the same three
 *  fields, trend-flagged there instead of just current-value. */
export function TemperatureGauge({
  label,
  valueC,
  warnAboveC,
}: {
  label: string;
  valueC: number | null;
  warnAboveC: number;
}) {
  const pct = valueC === null ? 0 : Math.max(0, Math.min(100, (valueC / warnAboveC) * 100));
  const tone = pct >= 100 ? "bad" : pct >= 75 ? "warn" : "good";

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-foreground">{valueC === null ? "—" : `${valueC.toFixed(1)} °C`}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            tone === "good" && "bg-emerald-500",
            tone === "warn" && "bg-amber-500",
            tone === "bad" && "bg-destructive"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
