import { cn } from "@/lib/utils";

export type MeterTone = "accent" | "good" | "warn" | "bad" | "neutral";

const TONE_FILL_CLASS: Record<MeterTone, string> = {
  accent: "bg-primary",
  good: "bg-emerald-500",
  warn: "bg-amber-500",
  bad: "bg-destructive",
  neutral: "bg-muted-foreground/50",
};

/** A single same-ramp meter: label + value above a thin filled track — the
 *  dataviz "meter" contract (a ratio against a limit reads better as a
 *  fill than as one more number in a list). `fraction` is pre-computed by
 *  the caller (value ÷ whatever ceiling makes sense for that field — a
 *  rated max, a BMS limit, or the largest sibling reading when there's no
 *  natural ceiling) and clamped to [0, 1] here so a reading past its own
 *  reference never breaks the bar. */
export function Meter({
  label,
  value,
  fraction,
  tone = "accent",
  size = "md",
}: {
  label: string;
  value: string;
  fraction: number;
  tone?: MeterTone;
  /** "sm" for a dense multi-meter grid (BMS limits, phase rows); "md" is
   *  the default standalone size. */
  size?: "sm" | "md";
}) {
  const clamped = Number.isFinite(fraction) ? Math.max(0, Math.min(1, fraction)) : 0;
  return (
    <div className="space-y-1">
      <div className={cn("flex items-baseline justify-between gap-2", size === "sm" ? "text-[11px]" : "text-xs")}>
        <span className="truncate text-muted-foreground">{label}</span>
        <span className="shrink-0 font-medium tabular-nums text-foreground">{value}</span>
      </div>
      <div className={cn("w-full overflow-hidden rounded-full bg-muted", size === "sm" ? "h-1" : "h-1.5")}>
        <div
          className={cn("h-full rounded-full transition-[width] duration-500", TONE_FILL_CLASS[tone])}
          style={{ width: `${clamped * 100}%` }}
        />
      </div>
    </div>
  );
}
