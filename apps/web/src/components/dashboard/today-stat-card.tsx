"use client";

import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AreaPoint } from "@/lib/energy-today";
import { TodayAreaChart } from "./today-area-chart";

export type Trend = { direction: "up" | "down"; good: boolean };

/** One of Overview's four "today" cards: a title with a round arrow button, the big total (with a small up / down
 *  arrow), a line of detail under it and the last two hours' graph filling the rest. The whole card opens `href`. */
export function TodayStatCard({
  title,
  href,
  value,
  unit,
  trend,
  detail,
  points,
  now,
  posColor,
  negColor,
  posLabel,
  negLabel,
}: {
  title: string;
  href: string;
  value: string;
  unit: string;
  trend?: Trend | null;
  detail: string;
  /** The last two hours' readings in kW (15-minute slots), oldest first. */
  points: AreaPoint[];
  /** The moment the graph ends at (epoch ms). */
  now: number;
  posColor: string;
  /** Present for a signed series (battery, grid): the colour below zero. */
  negColor?: string;
  posLabel: string;
  negLabel?: string;
}) {
  const Arrow = trend?.direction === "down" ? ArrowDown : ArrowUp;
  return (
    <Link
      href={href}
      className="group flex h-full min-w-0 flex-col gap-4 rounded-2xl border border-border p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-medium text-foreground">{title}</span>
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-foreground transition-colors group-hover:bg-emerald-500 group-hover:text-white">
          <ArrowUpRight className="size-4" />
        </span>
      </div>
      <div className="min-w-0">
        <div className="flex items-baseline gap-1.5">
          <span className="truncate text-4xl font-semibold tabular-nums leading-none text-foreground">{value}</span>
          <span className="text-sm text-muted-foreground">{unit}</span>
          {trend && <Arrow className={cn("size-5 self-center", trend.good ? "text-emerald-500" : "text-amber-500")} strokeWidth={2.4} />}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
      </div>
      <div className="min-h-28 flex-1">
        <TodayAreaChart points={points} now={now} posColor={posColor} negColor={negColor} posLabel={posLabel} negLabel={negLabel} />
      </div>
    </Link>
  );
}
