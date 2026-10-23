"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// The pieces the Overview widgets are built from, in the style of the home-screen widgets of a phone: a rounded card with a small coloured icon and
// a title, a row of figures (a big number with its label under it), a chart, and a line of legend. Sizes follow the widget (the widget is a size
// container, so `cqw` is a share of its width): a bigger widget gets bigger numbers, and a short one drops its chart and legend (see .ov-chart in
// globals.css).

export type WidgetTone = "amber" | "blue" | "sky" | "green" | "emerald" | "cyan" | "indigo" | "violet" | "rose" | "slate";

const BUBBLE: Record<WidgetTone, string> = {
  amber: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  blue: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  sky: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  green: "bg-green-500/15 text-green-600 dark:text-green-400",
  emerald: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  cyan: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400",
  indigo: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
  violet: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  rose: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
  slate: "bg-muted text-muted-foreground",
};

/** The rounded card of a widget: a small coloured icon and the title on top (with an arrow at the right when the whole card is a link), then the
 *  body. It fills the widget. */
export function WidgetCard({ icon: Icon, tone = "slate", title, href, aside, children, className }: { icon: LucideIcon; tone?: WidgetTone; title: string; href?: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  const body = (
    <>
      <div className="flex min-w-0 items-center gap-2">
        <span className={cn("ov-bubble grid size-7 shrink-0 place-items-center rounded-lg", BUBBLE[tone])}>
          <Icon className="size-4" />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{title}</span>
        {aside}
        {href && <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />}
      </div>
      {children}
    </>
  );
  const cls = cn("group flex h-full min-h-0 min-w-0 flex-col gap-2.5 overflow-hidden rounded-3xl border border-border bg-card p-4 text-foreground shadow-sm", className);
  return href ? (
    <Link href={href} className={cn(cls, "outline-none transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export interface FigureData {
  label: string;
  value: string;
  unit?: string;
  /** an arrow and a colour in front of the value (a change against yesterday, say) */
  trend?: { direction: "up" | "down"; good: boolean } | null;
}

/** A row of figures: each a number (as big as the widget allows) with its label under it, like "104 mg/dL, Average today". */
export function Figures({ items, size = "md" }: { items: FigureData[]; size?: "md" | "lg" }) {
  return (
    <div className="grid gap-x-3" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((f) => {
        const Arrow = f.trend?.direction === "down" ? ArrowDown : ArrowUp;
        return (
          <div key={f.label} className="min-w-0">
            <div className={cn("flex items-baseline gap-1 font-semibold tabular-nums leading-none text-foreground", size === "lg" ? "text-[clamp(1.5rem,8cqw,2.6rem)]" : "text-[clamp(1rem,4.6cqw,1.75rem)]")}>
              {f.trend && <Arrow className={cn("size-[0.7em] shrink-0 self-center", f.trend.good ? "text-emerald-500" : "text-amber-500")} strokeWidth={3} />}
              <span className="truncate">{f.value}</span>
              {f.unit && <span className="text-[0.45em] font-medium text-muted-foreground">{f.unit}</span>}
            </div>
            <p className="mt-1 truncate text-[11px] text-muted-foreground">{f.label}</p>
          </div>
        );
      })}
    </div>
  );
}

/** A line under a chart: coloured dots with what they mean ("Importing", "Exporting"). Dropped when the widget is short. */
export function Legend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <div className="ov-chart flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

/** The chart region of a widget: takes the room that is left, and is dropped when the widget is short. */
export function ChartArea({ children }: { children: ReactNode }) {
  return <div className="ov-chart min-h-0 flex-1">{children}</div>;
}
