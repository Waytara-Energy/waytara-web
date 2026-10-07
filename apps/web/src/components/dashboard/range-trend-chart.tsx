"use client";

import * as React from "react";
import { Bar, ComposedChart, Line, XAxis, YAxis } from "recharts";
import { useSeriesRange } from "@/lib/telemetry/react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { BarTrendSeries } from "./bar-trend-chart";
import { ChartEmptyState } from "./chart-empty-state";
import { ChartErrorCard, ChartLoadingCard, StaleDot } from "./chart-states";
import { useRange } from "./range-context";
import { useBarHover } from "./bar-hover";
import { useDelayedLoading } from "./use-delayed-loading";

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
  const [requested, setRequested] = React.useState<number | null>(null);
  const hover = useBarHover();
  const fetchKeys = React.useMemo(() => series.filter((s) => !s.cumulativeOf).map((s) => s.key), [series]);
  const scaleByKey = React.useMemo(() => Object.fromEntries(series.map((s) => [s.key, s.scale ?? valueScale])), [series, valueScale]);
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
    return { points: pts, totals: tot };
  }, [state.axis, state.byKey, state.minutes, fetchKeys, scaleByKey]);

  const chartConfig = React.useMemo(
    () => Object.fromEntries(series.map((s) => [s.key, { label: s.label, color: s.color }])) satisfies ChartConfig,
    [series]
  );

  const loading = state.status === "loading";
  const { showSkeleton } = useDelayedLoading(loading);
  if (loading || showSkeleton) return <ChartLoadingCard title={title} />;
  if (state.status === "error") return <ChartErrorCard title={title} message={state.error} onRetry={state.retry} />;

  if (points.every((p) => fetchKeys.every((k) => p[k] === null || p[k] === undefined))) {
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
          <CardDescription>{INTERVAL_LABEL[state.minutes] ?? `${state.minutes} min`} average</CardDescription>
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
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={32} interval="preserveStartEnd" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  indicator="dashed"
                  formatter={(value, name, item) => (
                    <span className="flex w-full items-center justify-between gap-3">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <span className="size-2 shrink-0 rounded-[2px]" style={{ backgroundColor: item.color }} />
                        {String(name)}
                      </span>
                      <span className="font-medium text-foreground tabular-nums">
                        {typeof value === "number" ? value.toFixed(2) : String(value)} {unitByKey[item.dataKey as string] ?? unit}
                      </span>
                    </span>
                  )}
                />
              }
            />
            {axisIds.map((id) => (
              <YAxis key={id} yAxisId={id} hide domain={["auto", "auto"]} />
            ))}
            {series
              .filter((s) => !s.cumulativeOf)
              .map((s) =>
                s.chartType === "line" || state.axis.length > 200 ? (
                  <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} yAxisId={s.unit ?? unit} stroke={`var(--color-${s.key})`} strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
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
