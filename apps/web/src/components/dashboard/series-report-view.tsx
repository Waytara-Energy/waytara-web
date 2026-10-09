"use client";

import * as React from "react";
import { Area, Bar, CartesianGrid, ComposedChart, XAxis, YAxis } from "recharts";
import type { ColumnDef } from "@tanstack/react-table";
import { cn } from "@/lib/utils";
import { READING_GROUP, unitDecimals, type ReportPoint, type ReportSeries, type ReportSeriesSummary, type ReportType } from "@/lib/report-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { DataTable } from "@/components/ui/data-table";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartEmptyState } from "./chart-empty-state";
import { ChartReadout, type ReadoutItem } from "./chart-kit";
import { StatTile } from "./perf-kit";
import { useChartStyle } from "./chart-style";
import { ChartTick } from "./bar-trend-chart";
import { useBarHover } from "./bar-hover";
import { CHART_CURSOR } from "./chart-cursor";

export interface SeriesReportResponse {
  date: string;
  days: number;
  bucketMinutes: number;
  coarse: boolean;
  isSolar: boolean;
  hasData: boolean;
  points: ReportPoint[];
  summaries: ReportSeriesSummary[];
  /** The part of each day that was asked for (null = the whole day). */
  window: { from: string; to: string } | null;
}

const INTERVAL_LABELS: Record<number, string> = { 15: "15 min", 30: "30 min", 60: "1 hour", 120: "2 hours", 1440: "1 day" };
const fmtDay = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const formatValue = (v: number | null, unit: string) => (v === null ? "—" : `${v.toFixed(unitDecimals(unit))} ${unit}`);

/** A time-series report (solar power, battery, load, grid, temperatures...) for the chosen period: the chart(s) or a data table,
 *  then the figures for each series. Readings in different units each get their own chart, never a shared scale. The data is
 *  fetched by the report centre, which also owns the downloads. */
export function SeriesReportView({
  data,
  loading,
  error,
  type,
  series,
  view,
  days,
  start,
  endDay,
  interval,
}: {
  data: SeriesReportResponse | null;
  loading: boolean;
  error: string | null;
  type: ReportType;
  series: ReportSeries[];
  view: "graph" | "table";
  days: number;
  start: string;
  endDay: string;
  interval: number;
}) {
  const bucketMinutes = data?.bucketMinutes ?? interval;
  const win = data?.window ?? null;
  const points = (data?.points ?? []) as unknown as Record<string, unknown>[];
  const groups = React.useMemo(() => [...new Set(series.map((s) => s.unit))].map((u) => series.filter((s) => s.unit === u)), [series]);
  const periodText = days > 1 ? `${fmtDay(start)} – ${fmtDay(endDay)} (${days} days)` : new Date(`${start}T12:00:00`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const hoursText = win ? `${win.from} – ${win.to >= "23:59" ? "24:00" : win.to}${days > 1 ? " each day" : ""}` : "00:00 – 23:59";
  const note =
    data?.hasData && data.isSolar ? (
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        {periodText}, {hoursText} · {data.coarse ? "hourly averages, as the data is older than 8 days" : `${INTERVAL_LABELS[bucketMinutes] ?? `${bucketMinutes} min`} average`}
        {series.length === 1 && type.description ? ` · ${type.description}` : ""}
      </p>
    ) : null;

  const columns = React.useMemo<ColumnDef<Record<string, unknown>, unknown>[]>(
    () => [
      {
        id: "time",
        accessorFn: (r) => String(r.time),
        header: "Time",
        cell: ({ row }) => {
          const t = String(row.original.time);
          return bucketMinutes >= 1440 ? fmtDay(t.slice(0, 10)) : `${days > 1 ? `${t.slice(8, 10)}/${t.slice(5, 7)} ` : ""}${t.slice(11, 16)}`;
        },
      },
      ...series.map<ColumnDef<Record<string, unknown>, unknown>>((s) => ({
        id: s.id,
        accessorFn: (r) => (typeof r[s.id] === "number" ? (r[s.id] as number) : null),
        header: `${s.label} · ${s.unit}`,
        meta: { align: "right" },
        sortUndefined: "last",
        cell: ({ row }) => (typeof row.original[s.id] === "number" ? (row.original[s.id] as number).toFixed(unitDecimals(s.unit)) : "—"),
      })),
    ],
    [series, bucketMinutes, days]
  );

  const empty =
    loading && !data ? (
      <Skeleton className="h-[280px] w-full rounded-lg" />
    ) : error ? (
      <p className="py-10 text-center text-sm text-destructive">{error}</p>
    ) : data && !data.isSolar ? (
      <ChartEmptyState label="Reports are available for solar inverters" />
    ) : !data?.hasData ? (
      <ChartEmptyState label={days > 1 ? "No readings in this period" : `No readings on ${fmtDay(start)}`} />
    ) : null;

  return (
    <div className="space-y-4">
      {data?.hasData && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(13rem,1fr))] gap-3">
          {data.summaries.map((sm) => {
            const at = sm.maxAt ? ` at ${days > 1 ? `${sm.maxAt.slice(8, 10)}/${sm.maxAt.slice(5, 7)} ` : ""}${sm.maxAt.slice(11, 16)}` : "";
            const kw = sm.unit === "kW";
            return (
              <StatTile
                key={sm.id}
                label={`${sm.label} · ${READING_GROUP[sm.id] ?? "Reading"}`}
                value={kw ? `${(sm.counterKwh ?? sm.energyKwh ?? 0).toFixed(1)} kWh` : formatValue(sm.avg, sm.unit)}
                hint={`Peak ${formatValue(sm.max, sm.unit)}${at} · ${kw ? "avg" : "low"} ${(kw ? sm.avg : sm.min)?.toFixed(unitDecimals(sm.unit)) ?? "—"}`}
              />
            );
          })}
        </div>
      )}

      {empty || view === "table" || !data ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{type.label}</CardTitle>
          </CardHeader>
          <CardContent>
            {empty ?? <DataTable columns={columns} data={points} pageSize={20} />}
            {!empty && note}
          </CardContent>
        </Card>
      ) : (
        groups.map((g, i) => (
          <SeriesChartCard key={g[0].unit} title={groups.length === 1 ? type.label : g.map((s) => s.label).join(" · ")} series={g} data={data} loading={loading} days={days} bucketMinutes={bucketMinutes} footer={i === groups.length - 1 ? note : null} />
        ))
      )}

    </div>
  );
}

/** One chart for readings that share a unit: the value being pointed at (or the newest) is written under the title. */
function SeriesChartCard({ title, series, data, loading, days, bucketMinutes, footer }: { title: string; series: ReportSeries[]; data: SeriesReportResponse; loading: boolean; days: number; bucketMinutes: number; footer: React.ReactNode }) {
  const hover = useBarHover();
  const chartStyle = useChartStyle();
  const gradientId = React.useId().replace(/[^a-zA-Z0-9]/g, "");
  const unit = series[0].unit;
  const drawAsLines = series.length > 2;
  const isLine = (s: ReportSeries) => (chartStyle === "auto" ? s.kind === "line" || drawAsLines : chartStyle === "line");
  const chartConfig = React.useMemo(() => Object.fromEntries(series.map((s) => [s.id, { label: s.label, color: s.color }])) satisfies ChartConfig, [series]);
  const domain: [number | "auto", number | "auto"] = unit === "%" ? [0, 100] : unit === "kW" ? [0, "auto"] : ["auto", "auto"];

  // A day is drawn from its first reading to its last, like the Monitoring charts (never fewer than a few slots).
  const [box, setBox] = React.useState<HTMLDivElement | null>(null);
  const [boxWidth, setBoxWidth] = React.useState(0);
  React.useEffect(() => {
    if (!box) return;
    const ro = new ResizeObserver(([entry]) => setBoxWidth(Math.round(entry.contentRect.width)));
    ro.observe(box);
    return () => ro.disconnect();
  }, [box]);
  const shown = React.useMemo(() => {
    const all = data.points as unknown as Record<string, unknown>[];
    if (days > 1) return all;
    const has = (p: Record<string, unknown>) => series.some((s) => typeof p[s.id] === "number");
    const f = all.findIndex(has);
    if (f < 0) return all;
    let l = all.length - 1;
    while (l > f && !has(all[l])) l--;
    return all.slice(Math.min(f, Math.max(0, l - 3)), l + 1);
  }, [data.points, series, days]);
  const points = shown;
  // Time labels: as many whole hours apart as the width needs so none touch; the faint in-between marks only while each slot has room.
  const plotWidth = Math.max(0, boxWidth - 8);
  const bucketHours = Math.max(1, bucketMinutes / 60);
  const spanHours = (shown.length * bucketMinutes) / 60;
  const maxLabels = Math.max(2, Math.floor(plotWidth / 58));
  const hourStep = [1, 2, 3, 4, 6, 12, 24].find((h) => h % bucketHours === 0 && spanHours / h <= maxLabels) ?? 24;
  const showMinor = plotWidth > 0 && plotWidth / shown.length >= 7;
  let newestPoint = -1;
  points.forEach((p, i) => {
    if (series.some((s) => typeof p[s.id] === "number")) newestPoint = i;
  });
  const readIdx = hover.index !== null && hover.index < points.length ? hover.index : newestPoint;
  const readRow = readIdx >= 0 ? points[readIdx] : null;
  const readoutItems: ReadoutItem[] = series.map((s) => {
    const v = readRow ? readRow[s.id] : null;
    return { key: s.id, label: s.label, color: s.color, value: typeof v === "number" ? { num: v.toFixed(unitDecimals(s.unit)), unit: s.unit } : null };
  });
  const readWhen = (() => {
    if (!readRow) return null;
    const t = String(readRow.time);
    if (bucketMinutes >= 1440) return fmtDay(t.slice(0, 10));
    const h = Number(t.slice(11, 13)) * 60 + Number(t.slice(14, 16)) + bucketMinutes;
    const end = `${String(Math.floor((h % 1440) / 60)).padStart(2, "0")}:${String(h % 60).padStart(2, "0")}`;
    return `${days > 1 ? `${t.slice(8, 10)}/${t.slice(5, 7)} ` : ""}${t.slice(11, 16)} – ${end}`;
  })();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
        <ChartReadout when={readWhen} items={readoutItems} />
      </CardHeader>
      <CardContent>
        <div ref={setBox}>
        <ChartContainer config={chartConfig} className={cn("aspect-auto h-[280px] w-full transition-opacity", loading && "opacity-60")}>
          <ComposedChart accessibilityLayer data={shown} {...hover.chartProps} margin={{ left: 4, right: 4, top: 8 }}>
            <defs>
              {series.map((s) => (
                <linearGradient key={s.id} id={`${gradientId}-${s.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={`var(--color-${s.id})`} stopOpacity={0.32} />
                  <stop offset="100%" stopColor={`var(--color-${s.id})`} stopOpacity={0.02} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
            {days > 1 ? (
              <XAxis
                dataKey="time"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
                interval="preserveStartEnd"
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                tickFormatter={(t: string) => `${t.slice(8, 10)}/${t.slice(5, 7)}${bucketMinutes < 1440 ? ` ${t.slice(11, 16)}` : ""}`}
              />
            ) : (
              <XAxis
                dataKey="time"
                tickLine={false}
                axisLine={false}
                tickMargin={0}
                interval={0}
                tick={(props: { x?: string | number; y?: string | number; payload?: { value: string } }) => <ChartTick x={props.x} y={props.y} payload={props.payload} labelEveryHours={hourStep} showMinor={showMinor} />}
              />
            )}
            <YAxis hide domain={domain} />
            {/* The pointer position only; the value is written under the title. */}
            <ChartTooltip cursor={chartStyle === "bar" ? false : CHART_CURSOR} content={() => null} isAnimationActive={false} />
            {series.map((s) =>
              isLine(s) ? (
                <Area key={s.id} type="monotone" dataKey={s.id} name={s.label} stroke={`var(--color-${s.id})`} strokeWidth={2} fill={`url(#${gradientId}-${s.id})`} baseValue="dataMin" dot={false} connectNulls={false} isAnimationActive={false} />
              ) : (
                <Bar key={s.id} dataKey={s.id} name={s.label} fill={`var(--color-${s.id})`} radius={bucketMinutes <= 15 ? 2 : 4} isAnimationActive={false}>
                  {hover.cells(shown.length, `var(--color-${s.id})`, (i) => typeof shown[i]?.[s.id] === "number")}
                </Bar>
              )
            )}
          </ComposedChart>
        </ChartContainer>
        </div>
        {footer}
      </CardContent>
    </Card>
  );
}
