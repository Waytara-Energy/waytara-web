"use client";

import * as React from "react";
import { Bar, ComposedChart, Line, ReferenceArea, ReferenceLine, XAxis, YAxis } from "recharts";
import { createClient } from "@waytara/supabase/client";
import { useRealtimeTable, type RealtimeRowEvent } from "@waytara/ui/realtime-provider";
import { INTERVAL_OPTIONS, DEFAULT_INTERVAL_MINUTES, todayMidnight, bucketKeyFor, localBucketDateString, fullDayBucketKeys, formatBucketLabel } from "@/lib/day-buckets";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartEmptyState } from "./chart-empty-state";

interface RealtimeDeviceReadingRow {
  equipment_id: string;
  key_name: string;
  value: number | null;
  ts: string;
  is_test: boolean;
}

// Module-level (not per-component) so switching tabs — which remounts this
// component, since Radix unmounts inactive TabsContent — can paint the
// last-fetched points immediately instead of a fresh skeleton, then quietly
// refetch to catch up. Capped so a long session hopping between many
// devices/tabs can't grow this without bound; oldest entry evicted first,
// which is close enough to LRU for a handful of concurrently-visited
// charts.
const CHART_CACHE_MAX = 24;
const chartDataCache = new Map<string, ChartPoint[]>();
function cacheChartPoints(key: string, points: ChartPoint[]) {
  chartDataCache.delete(key);
  chartDataCache.set(key, points);
  if (chartDataCache.size > CHART_CACHE_MAX) {
    const oldest = chartDataCache.keys().next().value;
    if (oldest !== undefined) chartDataCache.delete(oldest);
  }
}

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
  /** Marks this series as *derived*, not fetched: instead of querying its
   *  own `key` as an instrument, its value at each bucket is the running
   *  total of another series already in this chart (`cumulativeOf`,
   *  scaled by that bucket's width) — the same integration the footer's
   *  "sum" mode already does, just exposed per-bucket as a line instead
   *  of one final number. Stops (renders nothing further) once elapsed
   *  time runs out, since energy that hasn't happened yet obviously
   *  isn't "delivered". `key` still needs to be a
   *  value nothing else in `series` uses, since it becomes this series'
   *  own point field and dataKey. */
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
  [seriesKey: string]: number | string | boolean | null | undefined;
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

/** The shadcn-style grouped bar chart Overview's Power Generation &
 *  Consumption chart introduced — generalized to any 1+ instrument keys so
 *  every Monitoring tab can use the exact same pattern for its own node: an
 *  interval picker (15m/30m/1h/2h) driving both bucket width and refetch,
 *  today-only data (future buckets stay empty) and a footer with today's
 *  totals so far. `PowerGenerationChart` (Overview) is now a thin wrapper around this. */
export function BarTrendChart({
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
   *  over elapsed hours ("X kWh generated today") — only meaningful when
   *  `series` are power readings. "average": footer shows each series'
   *  today-so-far average instead, for a non-power series like battery
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
  const seriesKeys = React.useMemo(() => series.map((s) => s.key), [series]);
  const seriesKeysJoined = seriesKeys.join(",");
  // Only real instrument keys get fetched/bucketed — a `cumulativeOf`
  // series is derived from another series already in `points`, not
  // queried on its own (see the post-processing pass below).
  const fetchSeriesKeys = React.useMemo(() => series.filter((s) => !s.cumulativeOf).map((s) => s.key), [series]);
  const fetchSeriesKeysJoined = fetchSeriesKeys.join(",");
  const scaleByKey = React.useMemo(
    () => Object.fromEntries(series.map((s) => [s.key, s.scale ?? valueScale])),
    [series, valueScale]
  );
  const scalesJoined = series.map((s) => s.scale ?? valueScale).join(",");
  const unitByKey = React.useMemo(() => Object.fromEntries(series.map((s) => [s.key, s.unit ?? unit])), [series, unit]);
  // Series sharing a unit share one (hidden) y-axis, scaled to fit them
  // together; a series with its own `unit` gets its own axis so its bars
  // aren't dwarfed by/dwarfing a series on a very different scale (e.g.
  // power in kW alongside current in A on the same chart).
  const axisIds = React.useMemo(() => Array.from(new Set(series.map((s) => s.unit ?? unit))), [series, unit]);
  const [internalBucketMinutes, setInternalBucketMinutes] = React.useState<number>(DEFAULT_INTERVAL_MINUTES);
  const bucketMinutes = controlledBucketMinutes ?? internalBucketMinutes;
  const setBucketMinutes = onBucketMinutesChange ?? setInternalBucketMinutes;
  const [points, setPoints] = React.useState<ChartPoint[]>([]);
  const [loaded, setLoaded] = React.useState(false);
  const fetchRef = React.useRef<() => void>(() => {});
  const realtimeDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const chartConfig = React.useMemo(
    () => Object.fromEntries(series.map((s) => [s.key, { label: s.label, color: s.color }])) satisfies ChartConfig,
    [series]
  );

  // Snap each session's start/end to the exact bucket-key strings `points`
  // itself uses (the x-axis is categorical, keyed by that same string) —
  // recomputed straight from `bucketMinutes` on every render rather than
  // its own effect, since it's pure and cheap (no fetching involved).
  const sessionRanges = React.useMemo(
    () =>
      (sessionMarkers ?? []).map((m) => ({
        startKey: bucketKeyFor(m.startedAt, bucketMinutes),
        endKey: m.endedAt ? bucketKeyFor(m.endedAt, bucketMinutes) : null,
        energyKwh: m.energyKwh,
      })),
    [sessionMarkers, bucketMinutes]
  );

  React.useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    const cacheKey = `${deviceId}|${fetchSeriesKeysJoined}|${bucketMinutes}`;

    // Paint whatever this exact chart last fetched immediately — instant on
    // a tab revisit — then still run fetchData below to pick up anything
    // that changed since. Deliberately synchronous (not deferred to
    // fetchData's own setState calls): the whole point is to skip the
    // loading flash on a tab revisit, which a genuinely async path can't do.
    const cached = chartDataCache.get(cacheKey);
    if (cached) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPoints(cached);
      setLoaded(true);
    }

    async function fetchData() {
      // The database does the bucketing (telemetry_buckets): a few hundred
      // pre-averaged rows come back instead of paging through every raw
      // reading of the day. Its bucket timestamps render in the same
      // timezone as raw readings did, so bucketKeyFor() keys them identically.
      const from = todayMidnight();
      const to = new Date(from.getTime() + 24 * 60 * 60 * 1000);
      const { data: bucketRows } = await supabase.rpc("telemetry_buckets", {
        p_equipment_id: deviceId,
        p_keys: fetchSeriesKeys,
        p_from: from.toISOString(),
        p_to: to.toISOString(),
        p_bucket_minutes: bucketMinutes,
      });
      if (cancelled) return;
      setLoaded(true);

      // Same shape the rest of this function already consumes: per-bucket,
      // per-key sum and count — here one pre-averaged sample per bucket.
      const sums = new Map<string, Record<string, number>>();
      const counts = new Map<string, Record<string, number>>();
      for (const row of bucketRows ?? []) {
        // avg() is null when every reading in the bucket was null.
        if ((row.avg_value as number | null) === null) continue;
        const bk = bucketKeyFor(row.bucket, bucketMinutes);
        if (!sums.has(bk)) {
          sums.set(bk, Object.fromEntries(fetchSeriesKeys.map((k) => [k, 0])));
          counts.set(bk, Object.fromEntries(fetchSeriesKeys.map((k) => [k, 0])));
        }
        sums.get(bk)![row.key_name] = row.avg_value * (scaleByKey[row.key_name] ?? 1);
        counts.get(bk)![row.key_name] = 1;
      }

      const nowBucketKey = bucketKeyFor(localBucketDateString(new Date()), bucketMinutes);
      const carry: Record<string, number | null> = Object.fromEntries(fetchSeriesKeys.map((k) => [k, null]));

      const filled = fullDayBucketKeys(bucketMinutes).map((bk): ChartPoint => {
        const s = sums.get(bk);
        const c = counts.get(bk);
        const isFuture = bk > nowBucketKey;
        const point: ChartPoint = { time: bk };

        for (const key of fetchSeriesKeys) {
          if (c && c[key]) {
            point[key] = s![key] / c[key];
            carry[key] = point[key] as number;
          } else if (isFuture) {
            point[key] = null;
          } else {
            point[key] = carry[key];
          }
        }
        return point;
      });

      // Derived (`cumulativeOf`) series: the running integral of their
      // base series, elapsed-hours at a time — the exact same math the
      // footer's own "sum" mode uses, just kept per-bucket instead of
      // collapsed into one final number. Stops accumulating (and stops
      // rendering, via `null`) past "now" — energy that hasn't happened
      // yet can't count toward a running total.
      const bucketHours = bucketMinutes / 60;
      for (const s of series) {
        if (!s.cumulativeOf) continue;
        let running = 0;
        for (const point of filled) {
          if (point.time > nowBucketKey) {
            point[s.key] = null;
            continue;
          }
          running += ((point[s.cumulativeOf] as number | null | undefined) ?? 0) * bucketHours;
          point[s.key] = running;
        }
      }

      setPoints(filled);
      cacheChartPoints(cacheKey, filled);
    }

    fetchRef.current = () => {
      fetchData();
    };
    fetchData();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId, bucketMinutes, fetchSeriesKeysJoined, scalesJoined]);

  // Any new reading changes the day's shape enough (a fresh real point
  // replacing a carried-forward one) that a full
  // refetch is simpler and cheap here. The shared realtime channel already
  // batches rows within a ~300ms window, but still calls this handler once
  // per row in that batch (see realtime-provider.tsx) — one device "tick"
  // is commonly 20-30 rows across every instrument, of which several can
  // match this one chart's own series, so without its own debounce this
  // was firing several full refetches (2 queries each) back-to-back for a
  // single logical update.
  useRealtimeTable<RealtimeDeviceReadingRow>(
    "equipment_telemetry",
    "INSERT",
    `equipment_id=eq.${deviceId}`,
    React.useCallback(
      (payload: RealtimeRowEvent<RealtimeDeviceReadingRow>) => {
        const row = payload.new;
        if (row.is_test) return;
        if (!fetchSeriesKeys.includes(row.key_name)) return;
        if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current);
        realtimeDebounceRef.current = setTimeout(() => fetchRef.current(), 500);
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [fetchSeriesKeysJoined]
    )
  );

  const intervalLabel = INTERVAL_OPTIONS.find((o) => o.minutes === bucketMinutes)?.label ?? `${bucketMinutes} min`;

  // Both the "average so far today" and the "integrated over elapsed
  // hours" total, for every series — cheap to compute both regardless of
  // mode, since each series picks its own footer mode/unit below (a
  // charger's Power wants the integrated kWh, its Current only makes
  // sense as an average).
  const totals = React.useMemo(() => {
    const bucketHours = bucketMinutes / 60;
    const out: Record<string, { avg: number; sum: number }> = {};
    for (const key of seriesKeys) {
      const real = points.filter((p) => p[key] !== null && p[key] !== undefined);
      const avg = real.length > 0 ? real.reduce((s, p) => s + ((p[key] as number) ?? 0), 0) / real.length : 0;
      const sum = real.reduce((s, p) => s + ((p[key] as number) ?? 0) * bucketHours, 0);
      out[key] = { avg, sum };
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, bucketMinutes, seriesKeysJoined]);

  // Card shell stays put and only its contents swap to skeletons — keeps
  // the mount -> first-fetch-resolves gap (which the dynamic-import
  // ChartSkeleton in lazy-charts.tsx doesn't cover, since that one
  // unmounts as soon as this component's own JS has loaded) from ever
  // rendering an empty axes-with-no-bars chart.
  if (!loaded) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div className="space-y-2">
            <CardTitle className="text-sm">{title}</CardTitle>
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-8 w-[110px] shrink-0 rounded-md" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[240px] w-full rounded-lg" />
        </CardContent>
        <CardFooter className="flex-col items-start gap-2">
          <Skeleton className="h-4 w-56 max-w-full" />
        </CardFooter>
      </Card>
    );
  }

  if (loaded && points.every((p) => seriesKeys.every((k) => p[k] === null || p[k] === undefined))) {
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
          <CardTitle className="text-sm">{title}</CardTitle>
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
                <Bar key={s.key} dataKey={s.key} name={s.label} yAxisId={s.unit ?? unit} fill={`var(--color-${s.key})`} radius={4} />
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
            // A `cumulativeOf` series is just its base series' own "sum"
            // total, replotted per-bucket — showing it again here would
            // just repeat that same number a second time.
            .filter((s) => !s.cumulativeOf)
            .map((s) => {
              const mode = s.footerMode ?? footerMode;
              return mode === "average"
                ? `${totals[s.key].avg.toFixed(1)} ${s.unit ?? unit} avg ${s.label.toLowerCase()}`
                : `${totals[s.key].sum.toFixed(1)} ${s.footerUnit ?? footerUnit} ${s.label.toLowerCase()}`;
            })
            .join(" · ")}{" "}
          so far today
        </div>
      </CardFooter>
    </Card>
  );
}
