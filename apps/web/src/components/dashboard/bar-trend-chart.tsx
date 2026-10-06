"use client";

import * as React from "react";
import { Bar, ComposedChart, Line, ReferenceArea, ReferenceLine, XAxis, YAxis } from "recharts";
import { INTERVAL_OPTIONS, DEFAULT_INTERVAL_MINUTES, formatBucketLabel } from "@/lib/day-buckets";
import { istSlotKey } from "@/lib/telemetry/combine";
import { useTodaySeries } from "@/lib/telemetry/react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChartEmptyState } from "./chart-empty-state";
import { ChartErrorCard, ChartLoadingCard, StaleDot } from "./chart-states";
import { useDelayedLoading } from "./use-delayed-loading";
import { useRange } from "./range-context";
import { RangeTrendChart } from "./range-trend-chart";
import { LiveRawChart, useGoLive } from "./go-live";

export interface BarTrendSeries {
  key: string;
  label: string;
  color: string;
  /** Per-series reading -> display scale, overriding the chart's own
   *  `valueScale` — lets one chart combine series that aren't the same
   *  unit (e.g. a charger's power in kW alongside its current in A),
   *  each scaled correctly instead of sharing one factor. */
  scale?: number;
  /** Per-series tooltip/footer unit, overriding the chart's own `unit`
   *  for the same mixed-unit case. Series sharing a unit (the common
   *  case) also share one y-axis; a series with its own unit gets its
   *  own hidden axis so its bars scale independently instead of being
   *  dwarfed by/dwarfing a series on a very different scale. */
  unit?: string;
  /** Per-series footer mode/unit, overriding the chart's own
   *  `footerMode`/`footerUnit` — e.g. a charger's Power series wants
   *  "kWh delivered so far today" (sum) alongside a Current series that
   *  only makes sense as an "A avg" (average), in the same chart. */
  footerMode?: "sum" | "average";
  footerUnit?: string;
  /** "bar" (default) or "line" — a cumulative quantity (see
   *  `cumulativeOf`) reads better as a rising line laid over the other
   *  series' bars than as one more bar competing for the same space. */
  chartType?: "bar" | "line";
  /** Marks this series as *derived*, not fetched: its value at each slot is the running
   *  total of another series in this chart (`cumulativeOf`), integrated over the seconds
   *  each slot actually covered. Stops once the day has not reached a slot yet. `key` still
   *  needs to be unique in `series`, since it becomes this series' own field and dataKey. */
  cumulativeOf?: string;
}

export interface BarTrendReferenceLine {
  /** Already in the target axis's display unit (e.g. kW), not raw. */
  value: number;
  label: string;
  /** Which series' unit (hence y-axis) this line is plotted against. */
  unit: string;
  color?: string;
}

/** One session's span, marked directly on the time axis — a dotted line
 *  where it started, a shaded band with the energy delivered labeled in
 *  the middle, and (once it has one) a second dotted line where it
 *  ended. `endedAt: null` — a session still in progress — skips the band
 *  and the end line entirely rather than guessing where it'll finish;
 *  the start line's own label carries "so far" instead. */
export interface BarTrendSessionMarker {
  startedAt: string;
  endedAt: string | null;
  energyKwh: number | null;
}

interface ChartPoint {
  time: string;
  [seriesKey: string]: number | string | null | undefined;
}

/** Custom XAxis tick: every hour boundary gets a full-height tick + its
 *  "12 AM"-style label; every other bucket (only exists once the selected
 *  interval is finer than an hour) gets a short, unlabeled tick mark. */
export function ChartTick({ x, y, payload }: { x?: string | number; y?: string | number; payload?: { value: string } }) {
  if (x === undefined || y === undefined || !payload) return null;
  const nx = Number(x);
  const ny = Number(y);
  const bucketKey = payload.value;
  const isHourMark = bucketKey.slice(14, 16) === "00";
  if (!isHourMark) {
    return <line x1={nx} y1={ny} x2={nx} y2={ny + 5} stroke="var(--muted-foreground)" strokeWidth={1} opacity={0.5} />;
  }
  return (
    <g>
      <line x1={nx} y1={ny} x2={nx} y2={ny + 9} stroke="var(--foreground)" strokeWidth={1.5} />
      <text x={nx} y={ny + 21} textAnchor="middle" fontSize={10} fill="var(--muted-foreground)">
        {formatBucketLabel(bucketKey, 60)}
      </text>
    </g>
  );
}

/** The slot (IST bucket key) a timestamp falls in at the chart's current interval. */
function slotKeyFor(iso: string, minutes: number): string {
  const size = minutes * 60_000;
  const t = new Date(iso).getTime();
  return istSlotKey(Math.floor((t + 19_800_000) / size) * size - 19_800_000);
}

/** Today's grouped bar chart: an interval picker (15m default, 30m, 1h, 2h) over the day so far, with
 *  a footer of totals. Data comes from the shared telemetry store - one request per page for every
 *  chart's metrics, coarser intervals combined locally (no call), live updates applied in place, never
 *  a refetch. `PowerGenerationChart` (Overview) is a thin wrapper around this. */
function TodayBarTrendChart({
  deviceId,
  title,
  series,
  valueScale = 0.001,
  unit = "kW",
  footerMode = "sum",
  footerUnit = "kWh",
  bucketMinutes: controlledBucketMinutes,
  onBucketMinutesChange,
  referenceLines,
  sessionMarkers,
}: {
  deviceId: string;
  title: string;
  series: BarTrendSeries[];
  /** Raw reading -> chart value scale — default 0.001 converts W to kW.
   *  Pass 1 for a series that's already in its display unit (e.g. SOC%).
   *  Falls back for any series without its own `scale`. */
  valueScale?: number;
  /** Per-reading unit shown in the tooltip and (in "average" footer mode)
   *  the footer — falls back for any series without its own `unit`. */
  unit?: string;
  /** "sum" (default): footer integrates each series into an energy total
   *  over the time it covered ("X kWh generated today") — only meaningful when
   *  `series` are power readings. "average": footer shows each series'
   *  today-so-far time-weighted average instead, for a non-power series like battery
   *  SOC% where a summed total wouldn't mean anything. Falls back for any
   *  series without its own `footerMode`. */
  footerMode?: "sum" | "average";
  /** Footer's own unit in "sum" mode (independent of the tooltip's
   *  per-reading `unit`, e.g. "kW" readings integrate into "kWh"). Falls
   *  back for any series without its own `footerUnit`. */
  footerUnit?: string;
  /** Controlled interval, for a caller (MainHubTrendGroup) that needs to
   *  drive a sibling chart's own bucketing off this one's Select — omit
   *  both to keep the interval as this component's own internal state,
   *  same as every other BarTrendChart usage. */
  bucketMinutes?: number;
  onBucketMinutesChange?: (minutes: number) => void;
  /** Constant dashed lines drawn over the chart (e.g. a charger's own
   *  "Power Offered" ceiling) — plotted against whichever axis matches
   *  their `unit`, not a new series of their own. */
  referenceLines?: BarTrendReferenceLine[];
  /** One or more charging-session spans to mark on the time axis — see
   *  BarTrendSessionMarker. Independent of `series`/fetching entirely;
   *  just drawn over whatever's already there. */
  sessionMarkers?: BarTrendSessionMarker[];
}) {
  const [internalBucketMinutes, setInternalBucketMinutes] = React.useState<number>(DEFAULT_INTERVAL_MINUTES);
  const bucketMinutes = controlledBucketMinutes ?? internalBucketMinutes;
  const setBucketMinutes = onBucketMinutesChange ?? setInternalBucketMinutes;

  const seriesKeys = React.useMemo(() => series.map((s) => s.key), [series]);
  const fetchKeys = React.useMemo(() => series.filter((s) => !s.cumulativeOf).map((s) => s.key), [series]);
  const scaleByKey = React.useMemo(() => Object.fromEntries(series.map((s) => [s.key, s.scale ?? valueScale])), [series, valueScale]);
  const unitByKey = React.useMemo(() => Object.fromEntries(series.map((s) => [s.key, s.unit ?? unit])), [series, unit]);
  // Series sharing a unit share one (hidden) y-axis, scaled to fit them together; a series with its own
  // `unit` gets its own axis so its bars aren't dwarfed by/dwarfing a series on a very different scale.
  const axisIds = React.useMemo(() => Array.from(new Set(series.map((s) => s.unit ?? unit))), [series, unit]);

  const state = useTodaySeries(deviceId, fetchKeys, bucketMinutes);

  const { points, totals } = React.useMemo(() => {
    const nowMs = state.nowMs;
    const pts: ChartPoint[] = state.axis.map((t) => ({ time: istSlotKey(t) }));
    const tot: Record<string, { sum: number; wsum: number; covered: number }> = {};
    for (const key of fetchKeys) {
      const scale = scaleByKey[key] ?? 1;
      const t = { sum: 0, wsum: 0, covered: 0 };
      state.byKey[key]?.forEach((p, i) => {
        if (p && p.avg !== null) {
          const v = p.avg * scale;
          pts[i][key] = v;
          t.sum += (v * p.covered) / 3600; // kW x hours actually covered = kWh
          t.wsum += v * p.covered;
          t.covered += p.covered;
        } else {
          pts[i][key] = null;
        }
      });
      tot[key] = t;
    }
    // Derived (cumulative) series: the running integral of their base series, over the time each slot covered.
    for (const s of series) {
      if (!s.cumulativeOf) continue;
      let running = 0;
      state.axis.forEach((t, i) => {
        if (t > nowMs) {
          pts[i][s.key] = null;
          return;
        }
        const base = state.byKey[s.cumulativeOf!]?.[i];
        if (base && base.avg !== null) running += (base.avg * (scaleByKey[s.cumulativeOf!] ?? 1) * base.covered) / 3600;
        pts[i][s.key] = running;
      });
    }
    return { points: pts, totals: tot };
  }, [state.axis, state.byKey, state.nowMs, fetchKeys, series, scaleByKey]);

  const chartConfig = React.useMemo(
    () => Object.fromEntries(series.map((s) => [s.key, { label: s.label, color: s.color }])) satisfies ChartConfig,
    [series]
  );

  const sessionRanges = React.useMemo(
    () =>
      (sessionMarkers ?? []).map((m) => ({
        startKey: slotKeyFor(m.startedAt, bucketMinutes),
        endKey: m.endedAt ? slotKeyFor(m.endedAt, bucketMinutes) : null,
        energyKwh: m.energyKwh,
      })),
    [sessionMarkers, bucketMinutes]
  );

  const intervalLabel = INTERVAL_OPTIONS.find((o) => o.minutes === bucketMinutes)?.label ?? `${bucketMinutes} min`;

  const loading = state.status === "loading";
  const { showSkeleton } = useDelayedLoading(loading);
  if (loading || showSkeleton) return <ChartLoadingCard title={title} />;
  if (state.status === "error") return <ChartErrorCard title={title} message={state.error} onRetry={state.retry} />;

  if (points.every((p) => seriesKeys.every((k) => p[k] === null || p[k] === undefined))) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartEmptyState />
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
          <CardDescription>Today, {intervalLabel} average</CardDescription>
        </div>
        <Select value={String(bucketMinutes)} onValueChange={(v) => setBucketMinutes(Number(v))}>
          <SelectTrigger className="h-8 w-[110px] shrink-0 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {INTERVAL_OPTIONS.map((o) => (
              <SelectItem key={o.minutes} value={String(o.minutes)}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="aspect-auto h-[240px] w-full">
          <ComposedChart accessibilityLayer data={points} margin={{ left: 4, right: 4, top: 8 }}>
            <XAxis
              xAxisId={0}
              dataKey="time"
              tickLine={false}
              axisLine={false}
              tickMargin={0}
              interval={0}
              tick={(props: { x?: string | number; y?: string | number; payload?: { value: string } }) => (
                <ChartTick x={props.x} y={props.y} payload={props.payload} />
              )}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  indicator="dashed"
                  labelFormatter={(l) => formatBucketLabel(String(l), bucketMinutes)}
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
            {sessionRanges.map(
              (r, i) =>
                r.endKey && (
                  <ReferenceArea
                    key={`session-area-${i}`}
                    yAxisId={axisIds[0]}
                    x1={r.startKey}
                    x2={r.endKey}
                    fill="var(--foreground)"
                    fillOpacity={0.05}
                    label={
                      r.energyKwh !== null
                        ? { value: `${r.energyKwh.toFixed(1)} kWh`, position: "insideTop", fontSize: 10, fill: "var(--foreground)" }
                        : undefined
                    }
                  />
                )
            )}
            {series.map((s) =>
              s.chartType === "line" ? (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  yAxisId={s.unit ?? unit}
                  stroke={`var(--color-${s.key})`}
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              ) : (
                <Bar key={s.key} dataKey={s.key} name={s.label} yAxisId={s.unit ?? unit} fill={`var(--color-${s.key})`} radius={4} isAnimationActive={false} />
              )
            )}
            {referenceLines?.map((rl, i) => (
              <ReferenceLine
                key={i}
                yAxisId={rl.unit}
                y={rl.value}
                ifOverflow="extendDomain"
                stroke={rl.color ?? "var(--muted-foreground)"}
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{ value: rl.label, position: "insideTopRight", fontSize: 10, fill: rl.color ?? "var(--muted-foreground)" }}
              />
            ))}
            {sessionRanges.map((r, i) => (
              <React.Fragment key={`session-lines-${i}`}>
                <ReferenceLine
                  yAxisId={axisIds[0]}
                  x={r.startKey}
                  stroke="var(--muted-foreground)"
                  strokeDasharray="2 3"
                  strokeWidth={1}
                  label={
                    !r.endKey
                      ? {
                          value: r.energyKwh !== null ? `${r.energyKwh.toFixed(1)} kWh so far` : "Session started",
                          position: "insideTopLeft",
                          fontSize: 10,
                          fill: "var(--foreground)",
                        }
                      : undefined
                  }
                />
                {r.endKey && (
                  <ReferenceLine yAxisId={axisIds[0]} x={r.endKey} stroke="var(--muted-foreground)" strokeDasharray="2 3" strokeWidth={1} />
                )}
              </React.Fragment>
            ))}
          </ComposedChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="leading-none text-muted-foreground">
          {series
            // A `cumulativeOf` series is just its base series' own "sum" total, replotted per slot —
            // showing it again here would just repeat that same number a second time.
            .filter((s) => !s.cumulativeOf)
            .map((s) => {
              const mode = s.footerMode ?? footerMode;
              const t = totals[s.key] ?? { sum: 0, wsum: 0, covered: 0 };
              return mode === "average"
                ? `${(t.covered > 0 ? t.wsum / t.covered : 0).toFixed(1)} ${s.unit ?? unit} avg ${s.label.toLowerCase()}`
                : `${t.sum.toFixed(1)} ${s.footerUnit ?? footerUnit} ${s.label.toLowerCase()}`;
            })
            .join(" · ")}{" "}
          so far today
        </div>
      </CardFooter>
    </Card>
  );
}

export type BarTrendChartProps = React.ComponentProps<typeof TodayBarTrendChart>;

/** The trend chart every Monitoring / Overview tab uses. Inside a page with a range picker (RangeProvider) it follows
 *  the chosen range - today's 15-minute bars, or a 7 / 30 / 90-day or custom window; elsewhere it shows today. */
export function BarTrendChart(props: BarTrendChartProps) {
  const range = useRange();
  const goLive = useGoLive();
  // Go Live (every reading of today as the device reports it) replaces the chart while it is on.
  if (goLive?.active) {
    return <LiveRawChart title={props.title} series={props.series} valueScale={props.valueScale} unit={props.unit} />;
  }
  if (range && range.preset !== "today") {
    return (
      <RangeTrendChart
        deviceId={props.deviceId}
        title={props.title}
        series={props.series}
        valueScale={props.valueScale}
        unit={props.unit}
        footerMode={props.footerMode}
        footerUnit={props.footerUnit}
      />
    );
  }
  return <TodayBarTrendChart {...props} />;
}
