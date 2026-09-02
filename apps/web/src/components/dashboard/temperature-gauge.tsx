import { TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

/** A simple horizontal gauge against the manual's own stated safe-operating
 *  ceiling for each temperature field (telemetry-catalog.ts's
 *  `warnAboveC`) — not a hard cutoff, just a visual heads-up before it
 *  actually trips a fault. `previousValueC` is optional — when supplied
 *  (Maintenance passes a ~24h-old reading), a small trend arrow shows
 *  whether the reading is climbing toward that ceiling or easing away
 *  from it, not just where it sits right now. */
export function TemperatureGauge({
  label,
  valueC,
  warnAboveC,
  previousValueC,
}: {
  label: string;
  valueC: number | null;
  warnAboveC: number;
  previousValueC?: number | null;
}) {
  const pct = valueC === null ? 0 : Math.max(0, Math.min(100, (valueC / warnAboveC) * 100));
  const tone = pct >= 100 ? "bad" : pct >= 75 ? "warn" : "good";
  const delta = valueC !== null && previousValueC != null ? valueC - previousValueC : null;

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="flex items-center gap-1.5 font-medium text-foreground">
          {delta !== null && Math.abs(delta) >= 0.5 && (
            <span
              className={cn(
                "flex items-center text-xs font-normal",
                delta > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
              )}
            >
              {delta > 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
              {Math.abs(delta).toFixed(1)}°
            </span>
          )}
          {valueC === null ? "—" : `${valueC.toFixed(1)} °C`}
        </span>
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
