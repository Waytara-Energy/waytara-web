"use client";

import * as React from "react";
import { Area, Bar, CartesianGrid, ComposedChart, XAxis, YAxis } from "recharts";
import { useSeriesRange } from "@/lib/telemetry/react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartConfig, ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchKeysOf, type BarTrendSeries } from "./bar-trend-chart";
import { ChartEmptyState } from "./chart-empty-state";
import { ChartReadout, type ReadoutItem } from "./chart-kit";
import { ChartErrorCard, ChartLoadingCard, StaleDot } from "./chart-states";
import { useRange } from "./range-context";
import { useSharedInterval } from "./interval-context";
import { useBarHover } from "./bar-hover";
import { useChartStyle } from "./chart-style";
import { useDelayedLoading } from "./use-delayed-loading";
import { CHART_CURSOR } from "./chart-cursor";

const INTERVAL_LABEL: Record<number, string> = { 15: "15 min", 30: "30 min", 60: "1 hour", 120: "2 hours", 1440: "1 day" };

function slotLabel(t: number, minutes: number): string {
  const d = new Date(t + 19_800_000); // IST wall clock, read as UTC fields
  const day = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  if (minutes >= 1440) return day;
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${day} ${hh}:${mm}`;
}

/** BarTrendChart for a longer range (7 / 30 / 90 days or a custom window): the same series, units and totals,
 *  over the chosen window at 15 min - 1 day per point. One request for the metrics of the page; every interval
 *  switch is combined locally. */
export function RangeTrendChart({
  deviceId,
  title,
  series,
  valueScale = 0.001,
  unit = "kW",
  footerMode = "sum",
  footerUnit = "kWh",
}: {
  deviceId: string;
  title: string;
  series: BarTrendSeries[];
  valueScale?: number;
  unit?: string;
  footerMode?: "sum" | "average";
  footerUnit?: string;
}) {
  const range = useRange();
  // The interval is shared by every chart on the page (15 min unless the period is too long for it).
  const [requested, setRequested] = useSharedInterval();
  const hover = useBarHover();
  const chartStyle = useChartStyle();
  const gradientId = React.useId().replace(/[^a-zA-Z0-9]/g, "");
  const fetchKeys = React.useMemo(() => fetchKeysOf(series), [series]);
  const scaleByKey = React.useMemo(
    () => Object.fromEntries(series.flatMap((s) => (s.sumOf ?? [s.key]).map((k) => [k, s.scale ?? valueScale]).concat([[s.key, s.scale ?? valueScale]]))),
    [series, valueScale]
  );
  const unitByKey = React.useMemo(() => Object.fromEntries(series.map((s) => [s.key, s.unit ?? unit])), [series, unit]);
  const axisIds = React.useMemo(() => Array.from(new Set(series.map((s) => s.unit ?? unit))), [series, unit]);

  // `range` is non-null here (BarTrendChart only renders this inside a RangeProvider).
  const state = useSeriesRange(deviceId, fetchKeys, range!.window, requested);

  const { points, totals } = React.useMemo(() => {
    const pts: Record<string, number | string | null>[] = state.axis.map((t) => ({ label: slotLabel(t, state.minutes) }));
    const tot: Record<string, { sum: number; wsum: number; covered: number }> = {};
    for (const key of fetchKeys) {
      const scale = scaleByKey[key] ?? 1;
      const t = { sum: 0, wsum: 0, covered: 0 };
      state.byKey[key]?.forEach((p, i) => {
        if (p && p.avg !== null) {
          const v = p.avg * scale;
          pts[i][key] = v;
          t.sum += (v * p.covered) / 3600;
          t.wsum += v * p.covered;
          t.covered += p.covered;
        } else {
          pts[i][key] = null;
        }
      });
      tot[key] = t;
    }
    // Summed series: the total of their parts at each slot.
    for (const s of series) {
      if (!s.sumOf) continue;
      const t = { sum: 0, wsum: 0, covered: 0 };
      state.axis.forEach((_, i) => {
        let v = 0;
        let covered = 0;
        let any = false;
        for (const part of s.sumOf!) {
          const p = state.byKey[part]?.[i];
          if (p && p.avg !== null) {
            v += p.avg * (scaleByKey[part] ?? 1);
            covered = Math.max(covered, p.covered);
            any = true;
          }
        }
        pts[i][s.key] = any ? v : null;
        if (any) {
          t.sum += (v * covered) / 3600;
          t.wsum += v * covered;
          t.covered += covered;
        }
      });
      tot[s.key] = t;
    }
    return { points: pts, totals: tot };
  }, [state.axis, state.byKey, state.minutes, fetchKeys, scaleByKey, series]);

  const chartConfig = React.useMemo(
    () => Object.fromEntries(series.map((s) => [s.key, { label: s.label, color: s.color }])) satisfies ChartConfig,
    [series]
  );

  // The value being pointed at (or the newest reading), written big under the title instead of in a floating tooltip.
  const visibleSeries = series.filter((s) => !s.cumulativeOf);
  let newest = -1;
  points.forEach((p, i) => {
    if (visibleSeries.some((s) => typeof p[s.key] === "number")) newest = i;
  });
  const readIdx = hover.index !== null && hover.index < points.length ? hover.index : newest;
  const readRow = readIdx >= 0 ? points[readIdx] : null;
  const readoutItems: ReadoutItem[] = visibleSeries.map((s) => {
    const v = readRow ? readRow[s.key] : null;
    return { key: s.key, label: s.label, color: s.color, value: typeof v === "number" ? { num: v.toFixed(2), unit: unitByKey[s.key] ?? unit } : null };
  });

  const loading = state.status === "loading";
  const { showSkeleton } = useDelayedLoading(loading);
  if (loading || showSkeleton) return <ChartLoadingCard title={title} />;
  if (state.status === "error") return <ChartErrorCard title={title} message={state.error} onRetry={state.retry} />;

  if (points.every((p) => series.every((s) => p[s.key] === null || p[s.key] === undefined))) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartEmptyState label="No readings in this period" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-sm">
            {title}
            <StaleDot show={state.stale} label="Showing saved data, refreshing" />
          </CardTitle>
          <ChartReadout when={readRow ? String(readRow.label) : null} items={readoutItems} />
        </div>
        {state.plan.options.length > 1 && (
          <Select value={String(state.minutes)} onValueChange={(v) => setRequested(Number(v))}>
            <SelectTrigger className="h-8 w-[110px] shrink-0 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {state.plan.options.map((m) => (
                <SelectItem key={m} value={String(m)}>
                  {INTERVAL_LABEL[m] ?? `${m} min`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="aspect-auto h-[240px] w-full">
          <ComposedChart accessibilityLayer data={points} {...hover.chartProps} margin={{ left: 4, right: 4, top: 8 }}>
            <defs>
              {visibleSeries.map((s) => (
                <linearGradient key={s.key} id={`${gradientId}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={`var(--color-${s.key})`} stopOpacity={0.32} />
                  <stop offset="100%" stopColor={`var(--color-${s.key})`} stopOpacity={0.02} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={32} interval="preserveStartEnd" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
            {/* The pointer position only; the value is written under the title. */}
            <ChartTooltip cursor={chartStyle === "bar" ? false : CHART_CURSOR} content={() => null} isAnimationActive={false} />
            {axisIds.map((id) => (
              <YAxis key={id} yAxisId={id} hide domain={["auto", "auto"]} />
            ))}
            {series
              .filter((s) => !s.cumulativeOf)
              .map((s) =>
                (chartStyle === "auto" ? s.chartType === "line" : chartStyle === "line") || state.axis.length > 200 ? (
                  <Area key={s.key} type="monotone" dataKey={s.key} name={s.label} yAxisId={s.unit ?? unit} stroke={`var(--color-${s.key})`} strokeWidth={2} fill={`url(#${gradientId}-${s.key})`} baseValue="dataMin" dot={false} connectNulls={false} isAnimationActive={false} />
                ) : (
                  <Bar key={s.key} dataKey={s.key} name={s.label} yAxisId={s.unit ?? unit} fill={`var(--color-${s.key})`} radius={state.axis.length > 60 ? 1 : 3} isAnimationActive={false}>
                    {hover.cells(points.length, `var(--color-${s.key})`, (i) => typeof points[i]?.[s.key] === "number")}
                  </Bar>
                )
              )}
          </ComposedChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="leading-none text-muted-foreground">
          {series
            .filter((s) => !s.cumulativeOf)
            .map((s) => {
              const mode = s.footerMode ?? footerMode;
              const t = totals[s.key] ?? { sum: 0, wsum: 0, covered: 0 };
              return mode === "average"
                ? `${(t.covered > 0 ? t.wsum / t.covered : 0).toFixed(1)} ${s.unit ?? unit} avg ${s.label.toLowerCase()}`
                : `${t.sum.toFixed(1)} ${s.footerUnit ?? footerUnit} ${s.label.toLowerCase()}`;
            })
            .join(" · ")}{" "}
          in this period
        </div>
      </CardFooter>
    </Card>
  );
}
