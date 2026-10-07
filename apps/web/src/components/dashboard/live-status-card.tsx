import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type StatusTone = "good" | "warn" | "neutral";

const ICON_TONE_CLASS: Record<StatusTone, string> = {
  good: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  warn: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  neutral: "bg-muted text-muted-foreground",
};

const BADGE_TONE_CLASS: Record<StatusTone, string> = {
  good: "text-emerald-600 dark:text-emerald-400",
  warn: "text-amber-600 dark:text-amber-400",
  neutral: "text-muted-foreground",
};

/** One live-status card — icon badge, title/subtitle, a headline value and a status line (label + coloured
 *  badge). Used for Overview's Solar/Consumption/Battery/Grid row and the Monitoring headline cards — a plain
 *  presentational component, so a future category (or a 5th card) can reuse it. */
export function LiveStatusCard({
  icon: Icon,
  iconTone = "neutral",
  title,
  subtitle,
  value,
  statusLabel,
  badgeLabel,
  badgeTone,
  href,
  compact = false,
}: {
  icon: LucideIcon;
  iconTone?: StatusTone;
  title: string;
  subtitle: string;
  value: string;
  statusLabel: string;
  badgeLabel: string;
  badgeTone: StatusTone;
  /** When set, the whole card links into Monitoring scoped to this card's
   *  device + section (e.g. `/dashboard/monitoring?device=<id>#power`) —
   *  omit for a card with nowhere to drill into. */
  href?: string;
  /** Tighter padding and a smaller value, for screens that must fit without scrolling (Overview). */
  compact?: boolean;
}) {
  const card = (
    <Card className={cn(compact && "h-full", href && "transition-colors hover:border-primary/40")}>
      <CardContent className={compact ? "p-3.5" : "p-5"}>
        <div className="flex items-center gap-2">
          <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full", ICON_TONE_CLASS[iconTone])}>
            <Icon className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{title}</p>
            <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </div>

        <p className={cn("font-semibold text-foreground", compact ? "mt-2 text-xl" : "mt-3 text-2xl")}>{value}</p>
        <div className="mt-1 flex items-center justify-between gap-2 text-xs">
          <span className="text-muted-foreground">{statusLabel}</span>
          <span className={cn("font-medium", BADGE_TONE_CLASS[badgeTone])}>{badgeLabel}</span>
        </div>
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
