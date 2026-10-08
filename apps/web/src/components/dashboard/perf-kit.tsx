"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, Info, type LucideIcon } from "lucide-react";
import { Pie, PieChart, Cell } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import type { Insight, Split } from "@/lib/performance-metrics";
import { ChartEmptyState } from "./chart-empty-state";
import { LiveStatusCard } from "./live-status-card";
import { PanelCaptionProvider } from "./panel-context";

export const fmtNum = (v: number | null | undefined, digits = 1) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : v.toFixed(digits));
export const fmtKwhText = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : `${v.toFixed(v >= 100 ? 0 : 1)} kWh`);
export const fmtPct = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${v.toFixed(0)}%`);

/** "Produced · today" -> title "Produced", subtitle "today"; "Produced, lifetime" the same; no separator -> no subtitle. */
function splitLabel(label: string): [string, string] {
  for (const sep of [" · ", ", "]) {
    const i = label.indexOf(sep);
    if (i > 0) return [label.slice(0, i), label.slice(i + sep.length)];
  }
  return [label, ""];
}

/** A figure with its name and one line of context: title and period, the value, a line of context. */
export function StatTile({ label, value, hint, tone = "neutral" }: { label: string; value: string; hint?: string; tone?: "neutral" | "good" | "warn" }) {
  const [title, subtitle] = splitLabel(label);
  return <LiveStatusCard title={title} subtitle={subtitle || "\u00a0"} value={value} statusLabel={hint ?? ""} valueTone={tone} compact />;
}

export function Panel({
  title,
  description,
  children,
  className,
  icon: Icon,
  iconTone = "neutral",
  chart = false,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  icon?: LucideIcon;
  iconTone?: "neutral" | "good" | "warn";
  /** The panel holds a chart: its description moves under the chart's x axis, and the line under the title shows the value pointed at. */
  chart?: boolean;
}) {
  return (
    <Card className={className}>
      <CardHeader className="space-y-1">
        <div className="flex items-center gap-2">
          {Icon && (
            <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full", iconTone === "good" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : iconTone === "warn" ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" : "bg-muted text-muted-foreground")}>
              <Icon className="size-4" />
            </span>
          )}
          <CardTitle className="text-sm">{title}</CardTitle>
        </div>
        {description && !chart && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <PanelCaptionProvider value={chart ? (description ?? null) : null}>{children}</PanelCaptionProvider>
      </CardContent>
    </Card>
  );
}

const INSIGHT_ICON = { good: CheckCircle2, info: Info, warn: AlertTriangle } as const;
const INSIGHT_TONE = {
  good: "border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400",
  info: "border-border bg-muted/40 text-muted-foreground",
  warn: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
} as const;

/** Plain-language findings, worst first. */
export function InsightList({ insights }: { insights: Insight[] }) {
  const order = { warn: 0, info: 1, good: 2 } as const;
  const sorted = [...insights].sort((a, b) => order[a.tone] - order[b.tone]);
  if (sorted.length === 0) return <p className="text-sm text-muted-foreground">Nothing to report yet.</p>;
  return (
    <ul className="space-y-2.5">
      {sorted.map((i) => {
        const Icon = INSIGHT_ICON[i.tone];
        return (
          <li key={i.id} className={cn("flex gap-3 rounded-xl border p-3.5", INSIGHT_TONE[i.tone])}>
            <Icon className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{i.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{i.body}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Shares of a whole as a ring with the list beside it. */
export function DonutShare({ parts, center, unit = "kWh" }: { parts: { label: string; value: number; color: string }[]; center?: string; unit?: string }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  const config = Object.fromEntries(parts.map((p) => [p.label, { label: p.label, color: p.color }])) satisfies ChartConfig;
  if (total <= 0) return <ChartEmptyState />;
  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="relative size-40 shrink-0">
        <ChartContainer config={config} className="aspect-square size-40">
          <PieChart>
            <Pie data={parts} dataKey="value" nameKey="label" innerRadius={52} outerRadius={74} paddingAngle={2} strokeWidth={0} isAnimationActive={false}>
              {parts.map((p) => (
                <Cell key={p.label} fill={p.color} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        {center && <div className="pointer-events-none absolute inset-0 grid place-items-center text-center text-xs font-medium text-foreground">{center}</div>}
      </div>
      <ul className="min-w-0 flex-1 space-y-2 text-sm">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
              <span className="size-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: p.color }} />
              <span className="truncate">{p.label}</span>
            </span>
            <span className="shrink-0 font-medium tabular-nums">
              {p.value.toFixed(p.value >= 100 ? 0 : 1)} {unit} · {((p.value / total) * 100).toFixed(0)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A single bar split into coloured shares, with the legend under it. */
export function SplitBar({ parts, colors }: { parts: Split[]; colors: string[] }) {
  const total = parts.reduce((s, p) => s + p.kwh, 0);
  if (total <= 0) return <p className="text-sm text-muted-foreground">No energy recorded yet.</p>;
  return (
    <div className="space-y-2">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
        {parts.map((p, i) => (p.kwh > 0 ? <div key={p.label} style={{ width: `${(p.kwh / total) * 100}%`, backgroundColor: colors[i] }} title={`${p.label}: ${p.kwh.toFixed(1)} kWh`} /> : null))}
      </div>
      <ul className="grid gap-1.5 text-xs sm:grid-cols-3">
        {parts.map((p, i) => (
          <li key={p.label} className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
              <span className="size-2 shrink-0 rounded-[2px]" style={{ backgroundColor: colors[i] }} />
              <span className="truncate">{p.label}</span>
            </span>
            <span className="shrink-0 font-medium tabular-nums">
              {p.kwh.toFixed(p.kwh >= 100 ? 0 : 1)} kWh · {((p.kwh / total) * 100).toFixed(0)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// The charts live in chart-kit; the pages keep importing them from here.
export { DailyBars, LineSeriesChart, PeriodLineChart, RangeLines, StackedDailyBars, type LineSeries } from "./chart-kit";
