"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ReferenceLine, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import type { Insight, Split } from "@/lib/performance-metrics";
import { ChartEmptyState } from "./chart-empty-state";

const HOUR_MS = 3_600_000;

export const fmtNum = (v: number | null | undefined, digits = 1) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : v.toFixed(digits));
export const fmtKwhText = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : `${v.toFixed(v >= 100 ? 0 : 1)} kWh`);
export const fmtPct = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${v.toFixed(0)}%`);

/** "12 AM", "4 AM" ... for an hour offset from midnight. */
const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12} ${h % 24 < 12 ? "AM" : "PM"}`;

/** A figure with its name and one line of context. */
export function StatTile({ label, value, hint, tone = "neutral" }: { label: string; value: string; hint?: string; tone?: "neutral" | "good" | "warn" }) {
  return (
    <div className="min-w-0 rounded-xl border border-border p-3.5">
      <p className="truncate text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-1 truncate text-xl font-semibold tabular-nums", tone === "good" && "text-emerald-600 dark:text-emerald-400", tone === "warn" && "text-amber-600 dark:text-amber-400")}>{value}</p>
      {hint && <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Panel({ title, description, children, className }: { title: string; description?: string; children: React.ReactNode; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader className="space-y-1">
        <CardTitle className="text-sm">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
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

export interface LineSeries {
  key: string;
  label: string;
  color: string;
  /** One value per slot of the axis (null = no reading). */
  values: (number | null)[];
  dashed?: boolean;
}

/** A line chart over one day (15-minute slots): one or more series, hour labels every 4 hours, a value axis on the
 *  right. Series with different days (today / yesterday) share the axis by slot position. */
export function LineSeriesChart({
  axis,
  series,
  unit,
  digits = 1,
  height = 220,
  zeroLine = false,
}: {
  axis: number[];
  series: LineSeries[];
  unit: string;
  digits?: number;
  height?: number;
  zeroLine?: boolean;
}) {
  const config = React.useMemo(() => Object.fromEntries(series.map((s) => [s.key, { label: s.label, color: s.color }])) satisfies ChartConfig, [series]);
  // The time field has a name no series key can take.
  const rows = axis.map((time, i) => ({ __time: time, ...Object.fromEntries(series.map((s) => [s.key, s.values[i] ?? null])) }));
  const any = series.some((s) => s.values.some((v) => v !== null && v !== undefined));
  if (axis.length === 0 || !any) return <ChartEmptyState />;
  const start = axis[0];
  const ticks = Array.from({ length: 7 }, (_, k) => start + k * 4 * HOUR_MS);
  return (
    <div className="space-y-2">
      {series.length > 1 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {series.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded" style={{ backgroundColor: s.color, opacity: s.dashed ? 0.5 : 1 }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
      <ChartContainer config={config} className="aspect-auto w-full" style={{ height }}>
        <LineChart data={rows} margin={{ left: 14, right: 2, top: 6, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis
            type="number"
            dataKey="__time"
            domain={[start, start + 24 * HOUR_MS]}
            ticks={ticks}
            interval={0}
            tickFormatter={(t: number) => hourLabel(Math.round((t - start) / HOUR_MS))}
            tickLine={false}
            axisLine={false}
            tickMargin={6}
            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
          />
          <YAxis
            orientation="right"
            width={38}
            tickCount={4}
            tickLine={false}
            axisLine={false}
            domain={["auto", "auto"]}
            tickFormatter={(v: number) => v.toFixed(Math.abs(v) < 10 ? digits : 0)}
            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
          />
          {zeroLine && <ReferenceLine y={0} stroke="var(--border)" />}
          <ChartTooltip
            cursor={{ stroke: "var(--border)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const t = (payload[0].payload as { __time: number }).__time;
              const time = new Date(t + 19_800_000).toISOString().slice(11, 16);
              return (
                <div className="rounded-md border bg-background px-2.5 py-1.5 text-[11px] shadow-sm">
                  <p className="mb-1 font-medium">{time}</p>
                  {payload
                    .filter((p) => typeof p.value === "number")
                    .map((p) => (
                      <p key={String(p.dataKey)} className="flex items-center justify-between gap-4">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <span className="size-2 rounded-[2px]" style={{ backgroundColor: p.color }} />
                          {config[String(p.dataKey)]?.label}
                        </span>
                        <span className="font-medium tabular-nums">
                          {(p.value as number).toFixed(digits === 0 ? 0 : 2)} {unit}
                        </span>
                      </p>
                    ))}
                </div>
              );
            }}
          />
          {series.map((s) => (
            <Line key={s.key} type="monotone" dataKey={s.key} stroke={s.color} strokeWidth={s.dashed ? 1.5 : 2.25} strokeDasharray={s.dashed ? "4 3" : undefined} strokeOpacity={s.dashed ? 0.55 : 1} dot={false} connectNulls={false} isAnimationActive={false} />
          ))}
        </LineChart>
      </ChartContainer>
    </div>
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

/** Day-by-day bars of several series stacked (for example the energy of PV1 and PV2). */
export function StackedDailyBars({ rows, series, unit = "kWh" }: { rows: ({ label: string } & Record<string, number | string>)[]; series: { key: string; label: string; color: string }[]; unit?: string }) {
  const config = Object.fromEntries(series.map((s) => [s.key, { label: s.label, color: s.color }])) satisfies ChartConfig;
  if (rows.length === 0) return <ChartEmptyState />;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {series.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className="size-2 rounded-[2px]" style={{ backgroundColor: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <ChartContainer config={config} className="aspect-auto h-[220px] w-full">
        <BarChart data={rows} margin={{ left: 4, right: 2, top: 6 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={6} minTickGap={22} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
          <YAxis orientation="right" width={34} tickLine={false} axisLine={false} tickCount={4} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickFormatter={(v: number) => v.toFixed(0)} />
          <ChartTooltip
            cursor={{ fill: "var(--muted)", opacity: 0.4 }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              return (
                <div className="rounded-md border bg-background px-2.5 py-1.5 text-[11px] shadow-sm">
                  <p className="mb-1 font-medium">{label}</p>
                  {payload.map((p) => (
                    <p key={String(p.dataKey)} className="flex items-center justify-between gap-4">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <span className="size-2 rounded-[2px]" style={{ backgroundColor: p.color }} />
                        {config[String(p.dataKey)]?.label}
                      </span>
                      <span className="font-medium tabular-nums">
                        {Number(p.value).toFixed(1)} {unit}
                      </span>
                    </p>
                  ))}
                </div>
              );
            }}
          />
          {series.map((s, i) => (
            <Bar key={s.key} dataKey={s.key} stackId="a" fill={s.color} radius={i === series.length - 1 ? [3, 3, 0, 0] : 0} isAnimationActive={false} />
          ))}
        </BarChart>
      </ChartContainer>
    </div>
  );
}
