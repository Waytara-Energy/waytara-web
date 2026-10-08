"use client";

import * as React from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ReferenceLine, Tooltip as ChartHoverTooltip, XAxis, YAxis } from "recharts";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { resolveKind } from "@/lib/chart-style";
import { cn } from "@/lib/utils";
import { ChartEmptyState } from "./chart-empty-state";
import { useChartStyle } from "./chart-style";
import { usePanelCaption } from "./panel-context";
import { CHART_CURSOR } from "./chart-cursor";

// The charts of the Performance page, drawn the same way: no value axis (the number you point at is written big under the title, with
// its date and the series' colour node, instead of a floating tooltip), a gradient under every line, the x axis at the bottom with the panel's description under
// it as a caption. Each chart is a line or bars: its own natural style, or the one chosen in Application Settings.

const DAY_MS = 86_400_000;
const IST_MS = 19_800_000;

export interface ChartSeriesDef {
  key: string;
  label: string;
  color: string;
  /** Yesterday's curve and the like: dashed as a line, lighter as bars. */
  dashed?: boolean;
}

export type ChartRow = { __tick: string; __label: string } & Record<string, number | string | null>;

export interface ReadoutItem {
  key: string;
  label: string;
  color: string;
  /** The value as its number and its unit; null = no reading here. */
  value: { num: string; unit: string } | null;
  dashed?: boolean;
}

/** The value being pointed at, written big under a chart's title, with the date (or time) below it. With several series each number
 *  carries its name above it (no colour node); a single series is just the number. Used by every chart so they read the same. */
export function ChartReadout({ when, items }: { when: string | null; items: ReadoutItem[] }) {
  const bigClass = items.length > 2 ? "text-2xl" : "text-3xl";
  const named = items.length > 1;
  return (
    <div className="mt-2 space-y-1.5" aria-live="off">
      <div className="flex flex-wrap items-end gap-x-7 gap-y-2">
        {items.map((it) => (
          <div key={it.key} className="min-w-0">
            {named && <p className="text-xs text-muted-foreground">{it.label}</p>}
            <p className={cn("flex items-baseline gap-1 leading-none", named && "mt-0.5")}>
              <span className={cn(bigClass, "font-semibold tabular-nums", it.value ? "text-foreground" : "text-muted-foreground")}>{it.value ? it.value.num : "—"}</span>
              {it.value?.unit && <span className="text-sm text-muted-foreground">{it.value.unit}</span>}
            </p>
          </div>
        ))}
      </div>
      <p className="min-h-4 text-xs text-muted-foreground">{when ?? " "}</p>
    </div>
  );
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** One chart over rows (one per x position): lines or bars, optionally stacked, with the readout under the title and the caption
 *  under the axis. `tickEvery` is how many positions apart the x labels sit. */
export function ChartCore({
  rows,
  series,
  kind,
  stacked = false,
  format,
  zeroLine = false,
  height = 220,
  tickEvery,
}: {
  rows: ChartRow[];
  series: ChartSeriesDef[];
  kind: "line" | "bar";
  stacked?: boolean;
  /** A value as its number and its unit, shown big and small. */
  format: (v: number) => { num: string; unit: string };
  zeroLine?: boolean;
  height?: number;
  tickEvery?: number;
}) {
  const [hover, setHover] = React.useState<number | null>(null);
  const caption = usePanelCaption();
  const config = React.useMemo(() => Object.fromEntries(series.map((s) => [s.key, { label: s.label, color: s.color }])) satisfies ChartConfig, [series]);
  const uid = React.useId().replace(/[^a-zA-Z0-9]/g, "");

  // Pointing at a position shows it; otherwise the newest position that has a reading.
  // (A dashed series - yesterday's curve - runs on past "now", so it must not decide which reading is the newest.)
  const lead = series.some((s) => !s.dashed) ? series.filter((s) => !s.dashed) : series;
  let newest = -1;
  rows.forEach((r, i) => {
    if (lead.some((s) => isNum(r[s.key]))) newest = i;
  });
  const shown = hover !== null && hover < rows.length ? hover : newest;
  const row = shown >= 0 ? rows[shown] : null;
  const interval = Math.max(0, (tickEvery ?? Math.max(1, Math.ceil(rows.length / 7))) - 1);

  // The value pointed at, big (like a card's total), with its date and the series' colour node and name above it.
  const readout = (
    <ChartReadout
      when={row ? String(row.__label) : null}
      items={series.map((s) => ({ key: s.key, label: s.label, color: s.color, dashed: s.dashed, value: row && isNum(row[s.key]) ? format(row[s.key] as number) : null }))}
    />
  );
  const captionLine = caption ? <p className="text-xs leading-relaxed text-muted-foreground">{caption}</p> : null;

  if (newest < 0) {
    return (
      <div className="space-y-2">
        <ChartEmptyState />
        {captionLine}
      </div>
    );
  }

  const pointAt = (state: { activeTooltipIndex?: unknown }) => {
    const i = Number(state.activeTooltipIndex);
    setHover(state.activeTooltipIndex === undefined || state.activeTooltipIndex === null || Number.isNaN(i) ? null : i);
  };
  const handlers = {
    onMouseMove: pointAt,
    // A finger dragged across the chart moves the readout the same way (the page still scrolls up and down).
    onTouchMove: pointAt,
    onMouseLeave: () => setHover(null),
  };
  const margin = { left: 4, right: 4, top: 6, bottom: 0 };
  const xAxis = <XAxis dataKey="__tick" interval={interval} tickLine={false} axisLine={false} tickMargin={8} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />;
  const grid = <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />;
  const zero = zeroLine ? <ReferenceLine y={0} stroke="var(--border)" /> : null;
  // The hover tooltip is replaced by the readout; this only supplies the pointer position (and the line under the pointer).
  const hoverPosition = <ChartHoverTooltip content={() => null} cursor={kind === "line" ? CHART_CURSOR : false} isAnimationActive={false} />;

  return (
    <div className="space-y-2">
      {readout}
      <ChartContainer config={config} className="aspect-auto w-full" style={{ height }}>
        {kind === "bar" ? (
          <BarChart data={rows} margin={margin} {...handlers}>
            {grid}
            {xAxis}
            <YAxis hide domain={[(min: number) => Math.min(0, min), "auto"]} />
            {zero}
            {hoverPosition}
            {series.map((s, si) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                stackId={stacked ? "a" : undefined}
                fill={s.color}
                radius={rows.length > 60 ? 1 : si === series.length - 1 || !stacked ? [3, 3, 0, 0] : 0}
                isAnimationActive={false}
              >
                {rows.length <= 400 &&
                  rows.map((_, i) => <Cell key={i} fill={s.color} fillOpacity={(s.dashed ? 0.45 : 1) * (hover !== null && hover !== i ? 0.35 : 1)} />)}
              </Bar>
            ))}
          </BarChart>
        ) : (
          <AreaChart data={rows} margin={margin} {...handlers}>
            <defs>
              {series.map((s) => (
                <linearGradient key={s.key} id={`${uid}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity={0.32} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
                </linearGradient>
              ))}
            </defs>
            {grid}
            {xAxis}
            <YAxis hide domain={["auto", "auto"]} />
            {zero}
            {hoverPosition}
            {series.map((s) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                stroke={s.color}
                strokeWidth={s.dashed ? 1.5 : 2.25}
                strokeDasharray={s.dashed ? "4 3" : undefined}
                strokeOpacity={s.dashed ? 0.55 : 1}
                // A gradient under every line; the dashed one (yesterday) stays a plain line so it does not muddy today's.
                fill={s.dashed ? "none" : `url(#${uid}-${s.key})`}
                baseValue="dataMin"
                dot={rows.length <= 45}
                connectNulls={false}
                isAnimationActive={false}
              />
            ))}
          </AreaChart>
        )}
      </ChartContainer>
      {captionLine}
    </div>
  );
}

// ---------------------------------------------------------------- wrappers (the charts the pages use)

export interface LineSeries {
  key: string;
  label: string;
  color: string;
  /** One value per slot of the axis (null = no reading). */
  values: (number | null)[];
  dashed?: boolean;
}

const fixed = (digits: number, unit: string) => (v: number) => ({ num: v.toFixed(digits === 0 ? 0 : 2), unit });

const clock = (t: number) => new Date(t + IST_MS).toISOString().slice(11, 16);
const hourTick = (t: number) => {
  const d = new Date(t + IST_MS);
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${m === 0 ? "" : `:${String(m).padStart(2, "0")}`} ${h < 12 ? "AM" : "PM"}`;
};
const dateText = (t: number, withYear: boolean) => new Date(t + IST_MS).toLocaleDateString("en-IN", { day: "numeric", month: "short", ...(withYear ? { year: "2-digit" as const } : {}), timeZone: "UTC" });

/** Readings through one day (15-minute slots): lines, or bars when chosen. The x labels are every four hours. */
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
  const kind = resolveKind(useChartStyle(), "line");
  const rows = React.useMemo<ChartRow[]>(
    () => axis.map((t, i) => ({ __tick: hourTick(t), __label: clock(t), ...Object.fromEntries(series.map((s) => [s.key, s.values[i] ?? null])) })),
    [axis, series]
  );
  const defs = series.map(({ key, label, color, dashed }) => ({ key, label, color, dashed }));
  return <ChartCore rows={rows} series={defs} kind={kind} format={fixed(digits, unit)} zeroLine={zeroLine} height={height} tickEvery={Math.max(1, Math.round(axis.length / 6))} />;
}

/** Readings over several days (a week ... two years): a label every few days, the slot's date and time under the title. */
export function PeriodLineChart({
  axis,
  minutes,
  series,
  unit,
  digits = 1,
  height = 220,
  zeroLine = false,
}: {
  axis: number[];
  /** Length of one slot, in minutes (1440 = a day per point). */
  minutes: number;
  series: LineSeries[];
  unit: string;
  digits?: number;
  height?: number;
  zeroLine?: boolean;
}) {
  const kind = resolveKind(useChartStyle(), "line");
  const spanDays = axis.length === 0 ? 1 : Math.max(1, Math.round((axis[axis.length - 1] + minutes * 60_000 - axis[0]) / DAY_MS));
  const withYear = spanDays > 300;
  const rows = React.useMemo<ChartRow[]>(
    () =>
      axis.map((t, i) => ({
        __tick: dateText(t, withYear),
        __label: minutes >= 1440 ? dateText(t, true) : `${dateText(t, true)} ${clock(t)}`,
        ...Object.fromEntries(series.map((s) => [s.key, s.values[i] ?? null])),
      })),
    [axis, series, minutes, withYear]
  );
  const defs = series.map(({ key, label, color, dashed }) => ({ key, label, color, dashed }));
  const slotsPerDay = 1440 / minutes;
  const stepDays = Math.max(1, Math.ceil(spanDays / 6));
  return <ChartCore rows={rows} series={defs} kind={kind} format={fixed(digits, unit)} zeroLine={zeroLine} height={height} tickEvery={Math.max(1, Math.round(slotsPerDay * stepDays))} />;
}

/** One chart for the chosen period: today's curve (with yesterday dashed) when the period is Today, otherwise the whole window. */
export function RangeLines({
  isToday,
  todayAxis,
  todaySeries,
  period,
  unit,
  digits = 1,
  zeroLine = false,
}: {
  isToday: boolean;
  todayAxis: number[];
  todaySeries: LineSeries[];
  period: { axis: number[]; minutes: number; series: LineSeries[] };
  unit: string;
  digits?: number;
  zeroLine?: boolean;
}) {
  if (isToday) return <LineSeriesChart axis={todayAxis} unit={unit} digits={digits} zeroLine={zeroLine} series={todaySeries} />;
  return <PeriodLineChart axis={period.axis} minutes={period.minutes} series={period.series} unit={unit} digits={digits} zeroLine={zeroLine} />;
}

/** Day-by-day totals of several series (the energy of PV1 and PV2, the savings): stacked bars, or one line per series when chosen. */
export function StackedDailyBars({
  rows,
  series,
  unit = "kWh",
  currency = false,
  digits = 1,
}: {
  rows: ({ label: string } & Record<string, number | string>)[];
  series: { key: string; label: string; color: string }[];
  unit?: string;
  /** Show the values as rupees instead of `unit`. */
  currency?: boolean;
  digits?: number;
}) {
  const kind = resolveKind(useChartStyle(), "bar");
  const data = React.useMemo<ChartRow[]>(() => rows.map((r) => ({ ...r, __tick: String(r.label), __label: String(r.label) }) as ChartRow), [rows]);
  const format = currency ? (v: number) => ({ num: `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`, unit: "" }) : (v: number) => ({ num: v.toFixed(digits), unit });
  return <ChartCore rows={data} series={series} kind={kind} stacked format={format} />;
}

/** One bar per day of the period chosen at the top of the page (or a line, when chosen). */
export function DailyBars({ daily, label, color, unit = "kWh", digits = 1 }: { daily: { date: string; value: number }[]; label: string; color: string; unit?: string; digits?: number }) {
  const withYear = daily.length > 300;
  const rows = React.useMemo(
    () => daily.map((p) => ({ label: new Date(`${p.date}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", ...(withYear ? { year: "2-digit" as const } : {}), timeZone: "UTC" }), value: p.value })),
    [daily, withYear]
  );
  return <StackedDailyBars rows={rows} series={[{ key: "value", label, color }]} unit={unit} digits={digits} />;
}
