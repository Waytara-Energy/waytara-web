"use client";

import { useState } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SparkPoint, SparkTone, StatusTone } from "./live-status-card";

const SPARK_TONE_CLASS: Record<SparkTone, string> = {
  gray: "bg-slate-300 dark:bg-slate-600",
  red: "bg-red-500",
  yellow: "bg-yellow-500",
  green: "bg-emerald-500",
};

// Same four tones the bars themselves use (SPARK_TONE_CLASS), as text/icon
// color instead of fill — so the hover rate's up/down arrow reads with the
// same card-specific meaning as the bar it's pointing at (e.g. red for a
// heavy Consumption draw, green for healthy Solar output), not a generic
// up-is-green/down-is-red that wouldn't hold for every card.
const SPARK_TONE_TEXT_CLASS: Record<SparkTone, string> = {
  gray: "text-muted-foreground",
  red: "text-red-500 dark:text-red-400",
  yellow: "text-yellow-500 dark:text-yellow-400",
  green: "text-emerald-600 dark:text-emerald-400",
};

const BADGE_TONE_CLASS: Record<StatusTone, string> = {
  good: "text-emerald-600 dark:text-emerald-400",
  warn: "text-amber-600 dark:text-amber-400",
  neutral: "text-muted-foreground",
};

function formatSparkTime(ts: string): string {
  return new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/** How the hovered bar's own raw value compares to the card's current live
 *  reading, as a direction (for the trend-arrow icon, same TrendingUp /
 *  TrendingDown pairing TemperatureGauge already uses for its own delta)
 *  plus a magnitude. `liveValue` null/0 means there's nothing to compare
 *  against (card itself showing "—"). */
function rateVsLive(hoveredValue: number, liveValue: number | null): { direction: "up" | "down" | "flat" | "none"; pct: number } {
  if (liveValue === null || liveValue === 0) return { direction: "none", pct: 0 };
  const pct = Math.round(((hoveredValue - liveValue) / Math.abs(liveValue)) * 100);
  if (pct === 0) return { direction: "flat", pct: 0 };
  return { direction: pct > 0 ? "up" : "down", pct };
}

/** The interactive half of LiveStatusCard — the headline value, the
 *  status/badge row, and the sparkline bars, all reacting together to
 *  which bar (if any) is hovered: hovering a bar highlights it, dims the
 *  rest, and swaps the headline + status row for that bar's own value and
 *  time, reverting on mouse-leave. Split out as its own client component
 *  because LiveStatusCard's other props (`icon`, a component reference)
 *  can't cross into a Client Component, but this piece only ever needs
 *  plain data. */
export function HoverableSparkBody({
  value,
  liveValue,
  statusLabel,
  badgeLabel,
  badgeTone,
  sparkline,
}: {
  value: string;
  /** The card's current live reading, as a raw number in the same units as
   *  the sparkline's own points — used only to compute the hover rate
   *  (rateVsLive), never displayed directly. Null when there's nothing to
   *  compare against yet. */
  liveValue: number | null;
  statusLabel: string;
  badgeLabel: string;
  badgeTone: StatusTone;
  sparkline: SparkPoint[];
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const max = Math.max(1, ...sparkline.map((p) => Math.abs(p.value)));
  const hovered = hoverIndex !== null ? (sparkline[hoverIndex] ?? null) : null;
  const displayValue = hovered ? (hovered.display ?? String(hovered.value)) : value;
  const rate = hovered ? rateVsLive(hovered.value, liveValue) : null;
  const RateIcon = rate?.direction === "up" ? TrendingUp : TrendingDown;

  return (
    <>
      <p className="mt-3 text-2xl font-semibold text-foreground">{displayValue}</p>

      {hovered && rate ? (
        <div className="mt-1 flex items-center justify-between gap-2 text-xs">
          <span className="text-muted-foreground">{hovered.ts ? formatSparkTime(hovered.ts) : "Selected"}</span>
          <span className="flex items-center gap-1.5">
            {hovered.directionLabel && <span className="font-medium text-muted-foreground">{hovered.directionLabel}</span>}
            {rate.direction === "none" ? (
              <span className="font-medium text-muted-foreground">—</span>
            ) : rate.direction === "flat" ? (
              <span className="font-medium text-muted-foreground">0%</span>
            ) : (
              <span className={cn("flex items-center gap-1 font-medium", SPARK_TONE_TEXT_CLASS[hovered.tone ?? "gray"])}>
                <RateIcon className="size-3" />
                {Math.abs(rate.pct)}%
              </span>
            )}
          </span>
        </div>
      ) : (
        <div className="mt-1 flex items-center justify-between gap-2 text-xs">
          <span className="text-muted-foreground">{statusLabel}</span>
          <span className={cn("font-medium", BADGE_TONE_CLASS[badgeTone])}>{badgeLabel}</span>
        </div>
      )}

      {sparkline.length > 0 && (
        <div className="mt-3 grid h-10 grid-flow-col auto-cols-fr items-end gap-0.5" onMouseLeave={() => setHoverIndex(null)}>
          {sparkline.map((p, i) => (
            <div
              key={i}
              onMouseEnter={() => setHoverIndex(i)}
              className={cn(
                "w-full cursor-pointer rounded-full transition-opacity",
                SPARK_TONE_CLASS[p.tone ?? "gray"],
                hoverIndex !== null && hoverIndex !== i && "opacity-25"
              )}
              style={{ height: `${Math.max(10, (Math.abs(p.value) / max) * 100)}%` }}
            />
          ))}
        </div>
      )}
    </>
  );
}
