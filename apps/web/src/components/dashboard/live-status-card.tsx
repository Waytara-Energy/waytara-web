import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { HoverableSparkBody } from "./hoverable-spark-body";

/** Per-bar sparkline color — each card computes this per point from its
 *  own metric's meaning (fraction of that series' own peak, an absolute
 *  threshold like SOC% or temperature, or a sign like grid import/export),
 *  not from a single shared scale, so the row stays readable at a glance:
 *  gray = idle/no signal, green = healthy/good, yellow = caution, red = an
 *  issue worth noticing. */
export type SparkTone = "gray" | "red" | "yellow" | "green";

export interface SparkPoint {
  value: number;
  tone?: SparkTone;
  /** When set, hovering this bar shows this timestamp in place of the
   *  status row (see formatSparkTime in hoverable-spark-body.tsx) — omit
   *  for a sparkline whose points don't carry a meaningful individual
   *  time. */
  ts?: string;
  /** This point's value, pre-formatted into the same units/precision the
   *  headline `value` prop already uses (e.g. "1.04 kW"). Computed by the
   *  caller rather than passed as a formatter function, since a function
   *  can't cross into HoverableSparkBody's client boundary — falls back to
   *  the plain number if omitted. */
  display?: string;
  /** A short state word for this point (e.g. "Importing"/"Exporting") —
   *  shown next to the hover rate (before the trend arrow/percentage),
   *  not appended to the headline value, so a long label can't wrap the
   *  headline onto a second line. Omit for a card with nothing meaningful
   *  to say there. */
  directionLabel?: string;
}

export type StatusTone = "good" | "warn" | "neutral";

const ICON_TONE_CLASS: Record<StatusTone, string> = {
  good: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  warn: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  neutral: "bg-muted text-muted-foreground",
};

/** One live-status card — icon badge, title/subtitle, a headline value,
 *  a status line (label + colored badge), and a small trend sparkline
 *  underneath. Used for Overview's Solar/Consumption/Battery/Grid row
 *  (see SolarLiveStatusCards) — a plain presentational component so a
 *  future category (or a 5th card) can reuse it without duplicating the
 *  bar-rendering math.
 *
 *  Stays a Server Component itself (so `icon`, a component reference, can
 *  be passed in from its server-rendered callers) — the sparkline's hover
 *  interactivity lives in HoverableSparkBody, a client component that only
 *  receives plain serializable data (strings/numbers), never a function or
 *  icon reference. */
export function LiveStatusCard({
  icon: Icon,
  iconTone = "neutral",
  title,
  subtitle,
  value,
  liveValue,
  statusLabel,
  badgeLabel,
  badgeTone,
  sparkline,
  href,
}: {
  icon: LucideIcon;
  iconTone?: StatusTone;
  title: string;
  subtitle: string;
  value: string;
  /** The raw number `value` is formatted from, in the same units as the
   *  sparkline's own points — passed through to HoverableSparkBody so it
   *  can show a hovered bar's rate vs. this live reading. Null when there's
   *  nothing to compare against (e.g. `value` is "—"). */
  liveValue: number | null;
  statusLabel: string;
  badgeLabel: string;
  badgeTone: StatusTone;
  sparkline: SparkPoint[];
  /** When set, the whole card links into Monitoring scoped to this card's
   *  device + section (e.g. `/dashboard/monitoring?device=<id>#power`) —
   *  omit for a card with nowhere to drill into. */
  href?: string;
}) {
  const card = (
    <Card className={cn(href && "transition-colors hover:border-primary/40")}>
      <CardContent className="p-5">
        <div className="flex items-center gap-2">
          <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full", ICON_TONE_CLASS[iconTone])}>
            <Icon className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{title}</p>
            <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </div>

        <HoverableSparkBody
          value={value}
          liveValue={liveValue}
          statusLabel={statusLabel}
          badgeLabel={badgeLabel}
          badgeTone={badgeTone}
          sparkline={sparkline}
        />
      </CardContent>
    </Card>
  );

  return href ? (
    <Link href={href} className="block">
      {card}
    </Link>
  ) : (
    card
  );
}
