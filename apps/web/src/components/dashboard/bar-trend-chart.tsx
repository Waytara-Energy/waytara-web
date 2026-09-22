"use client";

import * as React from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Bar, BarChart, Cell, XAxis } from "recharts";
import { createClient } from "@waytara/supabase/client";
import { useRealtimeTable, type RealtimeRowEvent } from "@waytara/ui/realtime-provider";
import { fetchAllDeviceReadings, type DeviceReadingRow } from "@/lib/device-readings-fetch";
import { INTERVAL_OPTIONS, DEFAULT_INTERVAL_MINUTES, todayMidnight, bucketKeyFor, localBucketDateString, fullDayBucketKeys, formatBucketLabel } from "@/lib/day-buckets";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface RealtimeDeviceReadingRow {
  device_id: string;
  instrument_key: string;
  value: number | null;
  ts: string;
  is_test: boolean;
}

export interface BarTrendSeries {
  key: string;
  label: string;
  color: string;
}

interface ChartPoint {
  time: string;
  isYesterday?: boolean;
  [seriesKey: string]: number | string | boolean | null | undefined;
}

/** Custom XAxis tick: every hour boundary gets a full-height tick + its
 *  "12 AM"-style label; every other bucket (only exists once the selected
 *  interval is finer than an hour) gets a short, unlabeled tick mark. */
function ChartTick({ x, y, payload }: { x?: string | number; y?: string | number; payload?: { value: string } }) {
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

/** Wraps ChartTooltipContent to render nothing at all while hovering a
 *  yesterday-reference bucket — those grey bars are there to show the
 *  day's shape, not to be inspected value-by-value, so a hover card for
 *  them would just be noise (and its "(yesterday)" labeling made it read
 *  like a real, actionable reading rather than a muted backdrop). Real
 *  buckets still get the normal tooltip. */
function TrendTooltipContent(props: React.ComponentProps<typeof ChartTooltipContent>) {
  const point = (props.payload?.[0] as { payload?: ChartPoint } | undefined)?.payload;
  if (point?.isYesterday) return null;
  return <ChartTooltipContent {...props} />;
}

/** Sums + counts a set of readings into per-bucket, per-series-key values —
 *  shared shape for both today's real data and yesterday's reference data
 *  (yesterday keyed by time-of-day only, via `keyFor` stripping the date). */
function bucketReadings(rows: DeviceReadingRow[], bucketMinutes: number, keyFor: (ts: string) => string, seriesKeys: string[], valueScale: number) {
  const sums = new Map<string, Record<string, number>>();
  const counts = new Map<string, Record<string, number>>();
  for (const row of rows) {
    if (row.value === null || !seriesKeys.includes(row.instrument_key)) continue;
    const bucket = keyFor(row.ts);
    if (!sums.has(bucket)) {
      sums.set(bucket, Object.fromEntries(seriesKeys.map((k) => [k, 0])));
      counts.set(bucket, Object.fromEntries(seriesKeys.map((k) => [k, 0])));
    }
    sums.get(bucket)![row.instrument_key] += row.value * valueScale;
    counts.get(bucket)![row.instrument_key] += 1;
  }
  return { sums, counts };
}

/** The shadcn-style grouped bar chart Overview's Power Generation &
 *  Consumption chart introduced — generalized to any 1+ instrument keys so
 *  every Monitoring tab can use the exact same pattern for its own node: an
 *  interval picker (15m/30m/1h/2h) driving both bucket width and refetch,
 *  empty future buckets filled with yesterday's own value at the same
 *  time-of-day in muted grey so the day's shape reads as continuous, and a
 *  footer comparing today so far against yesterday. `PowerGenerationChart`
 *  (Overview) is now a thin wrapper around this. */
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
}: {
  deviceId: string;
  title: string;
  series: BarTrendSeries[];
  /** Raw reading -> chart value scale — default 0.001 converts W to kW.
   *  Pass 1 for a series that's already in its display unit (e.g. SOC%). */
  valueScale?: number;
  /** Per-reading unit shown in the tooltip. */
  unit?: string;
  /** "sum" (default): footer integrates each series into an energy total
   *  over elapsed hours ("X kWh generated today") — only meaningful when
   *  `series` are power readings. "average": footer shows each series'
   *  today-so-far average instead, for a non-power series like battery
   *  SOC% where a summed total wouldn't mean anything. */
  footerMode?: "sum" | "average";
  /** Footer's own unit in "sum" mode (independent of the tooltip's
   *  per-reading `unit`, e.g. "kW" readings integrate into "kWh"). */
  footerUnit?: string;
  /** Controlled interval, for a caller (MainHubTrendGroup) that needs to
   *  drive a sibling chart's own bucketing off this one's Select — omit
   *  both to keep the interval as this component's own internal state,
   *  same as every other BarTrendChart usage. */
  bucketMinutes?: number;
  onBucketMinutesChange?: (minutes: number) => void;
}) {
  const seriesKeys = React.useMemo(() => series.map((s) => s.key), [series]);
  const seriesKeysJoined = seriesKeys.join(",");
  const [internalBucketMinutes, setInternalBucketMinutes] = React.useState<number>(DEFAULT_INTERVAL_MINUTES);
  const bucketMinutes = controlledBucketMinutes ?? internalBucketMinutes;
  const setBucketMinutes = onBucketMinutesChange ?? setInternalBucketMinutes;
  const [points, setPoints] = React.useState<ChartPoint[]>([]);
  const [loaded, setLoaded] = React.useState(false);
  const fetchRef = React.useRef<() => void>(() => {});

  const chartConfig = React.useMemo(
    () => Object.fromEntries(series.map((s) => [s.key, { label: s.label, color: s.color }])) satisfies ChartConfig,
    [series]
  );

  React.useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    async function fetchData() {
      const since = todayMidnight().toISOString();
      const yesterdayStart = new Date(todayMidnight());
      yesterdayStart.setDate(yesterdayStart.getDate() - 1);

      const [today, yesterday] = await Promise.all([
        fetchAllDeviceReadings(supabase, deviceId, seriesKeys, since),
        fetchAllDeviceReadings(supabase, deviceId, seriesKeys, yesterdayStart.toISOString(), since),
      ]);
      if (cancelled) return;
      setLoaded(true);

      const { sums, counts } = bucketReadings(today, bucketMinutes, (ts) => bucketKeyFor(ts, bucketMinutes), seriesKeys, valueScale);
      const { sums: ySums, counts: yCounts } = bucketReadings(
        yesterday,
        bucketMinutes,
        (ts) => bucketKeyFor(ts, bucketMinutes).slice(11),
        seriesKeys,
        valueScale
      );

      const nowBucketKey = bucketKeyFor(localBucketDateString(new Date()), bucketMinutes);
      const carry: Record<string, number | null> = Object.fromEntries(seriesKeys.map((k) => [k, null]));

      const filled = fullDayBucketKeys(bucketMinutes).map((bk): ChartPoint => {
        const s = sums.get(bk);
        const c = counts.get(bk);
        const isFuture = bk > nowBucketKey;
        const timeOfDay = bk.slice(11);
        const yc = yCounts.get(timeOfDay);
        const ys = ySums.get(timeOfDay);
        const point: ChartPoint = { time: bk };
        let usedYesterday = false;

        for (const key of seriesKeys) {
          // Yesterday's own value at this same time-of-day, kept on every
          // bucket (not just future ones borrowing it for display) purely
          // so the footer's trend line can compare today-so-far against
          // yesterday over the exact same elapsed portion of the day.
          point[`${key}__yesterday`] = yc && yc[key] && ys ? ys[key] / yc[key] : null;

          if (c && c[key]) {
            point[key] = s![key] / c[key];
            carry[key] = point[key] as number;
          } else if (isFuture) {
            if (yc && yc[key] && ys) {
              point[key] = ys[key] / yc[key];
              usedYesterday = true;
            } else {
              point[key] = null;
            }
          } else {
            point[key] = carry[key];
          }
        }
        if (usedYesterday) point.isYesterday = true;
        return point;
      });
      setPoints(filled);
    }

    fetchRef.current = () => {
      fetchData();
    };
    fetchData();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId, bucketMinutes, seriesKeysJoined, valueScale]);

  // Any new reading changes the day's shape enough (a fresh real point
  // replacing a carried-forward or yesterday-borrowed one) that a full
  // refetch is simpler and cheap here.
  useRealtimeTable<RealtimeDeviceReadingRow>(
    "device_readings",
    "INSERT",
    `device_id=eq.${deviceId}`,
    React.useCallback(
      (payload: RealtimeRowEvent<RealtimeDeviceReadingRow>) => {
        const row = payload.new;
        if (row.is_test) return;
        if (!seriesKeys.includes(row.instrument_key)) return;
        fetchRef.current();
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [seriesKeysJoined]
    )
  );

  const intervalLabel = INTERVAL_OPTIONS.find((o) => o.minutes === bucketMinutes)?.label ?? `${bucketMinutes} min`;

  // "Trending" line compares today's average of the first series so far
  // against yesterday's average over that same elapsed portion of the day
  // — a fair same-point-in-day comparison, not a full-day total (today
  // isn't over yet, so a full-day total would always read low).
  const primaryKey = series[0]?.key;
  const trend = React.useMemo(() => {
    if (!primaryKey) return null;
    const yKey = `${primaryKey}__yesterday`;
    const real = points.filter((p) => !p.isYesterday && p[primaryKey] !== null && p[primaryKey] !== undefined);
    if (real.length === 0) return null;
    const todayAvg = real.reduce((sum, p) => sum + ((p[primaryKey] as number) ?? 0), 0) / real.length;
    const withYesterday = real.filter((p) => p[yKey] !== null && p[yKey] !== undefined);
    if (withYesterday.length === 0) return null;
    const yesterdayAvg = withYesterday.reduce((sum, p) => sum + ((p[yKey] as number) ?? 0), 0) / withYesterday.length;
    if (yesterdayAvg <= 0) return null;
    return { pct: ((todayAvg - yesterdayAvg) / yesterdayAvg) * 100 };
  }, [points, primaryKey]);

  const totals = React.useMemo(() => {
    if (footerMode === "average") {
      const out: Record<string, number> = {};
      for (const key of seriesKeys) {
        const real = points.filter((p) => !p.isYesterday && p[key] !== null && p[key] !== undefined);
        out[key] = real.length > 0 ? real.reduce((sum, p) => sum + ((p[key] as number) ?? 0), 0) / real.length : 0;
      }
      return out;
    }
    const bucketHours = bucketMinutes / 60;
    const out: Record<string, number> = Object.fromEntries(seriesKeys.map((k) => [k, 0]));
    for (const p of points) {
      if (p.isYesterday) continue;
      for (const key of seriesKeys) {
        out[key] += ((p[key] as number) ?? 0) * bucketHours;
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, bucketMinutes, seriesKeysJoined, footerMode]);

  if (loaded && points.every((p) => seriesKeys.every((k) => p[k] === null || p[k] === undefined))) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-8 text-center text-sm text-muted-foreground">No live data yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="text-sm">{title}</CardTitle>
          <CardDescription>Today, {intervalLabel} average &middot; grey bars are yesterday&apos;s reference</CardDescription>
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
          <BarChart accessibilityLayer data={points} margin={{ left: 4, right: 4, top: 8 }}>
            <XAxis
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
                <TrendTooltipContent
                  indicator="dashed"
                  labelFormatter={(l) => formatBucketLabel(String(l), bucketMinutes)}
                  formatter={(value, name, item) => (
                    <span className="flex w-full items-center justify-between gap-3">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <span className="size-2 shrink-0 rounded-[2px]" style={{ backgroundColor: item.color }} />
                        {String(name)}
                      </span>
                      <span className="font-medium text-foreground tabular-nums">
                        {typeof value === "number" ? value.toFixed(2) : String(value)} {unit}
                      </span>
                    </span>
                  )}
                />
              }
            />
            {series.map((s) => (
              <Bar key={s.key} dataKey={s.key} name={s.label} fill={`var(--color-${s.key})`} radius={4}>
                {points.map((p, i) => (
                  <Cell key={i} fillOpacity={p.isYesterday ? 0.3 : 1} fill={p.isYesterday ? "var(--muted-foreground)" : `var(--color-${s.key})`} />
                ))}
              </Bar>
            ))}
          </BarChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        {trend && (
          <div className="flex gap-2 leading-none font-medium">
            {trend.pct >= 0 ? "Up" : "Down"} {Math.abs(trend.pct).toFixed(1)}% vs. yesterday at this time
            {trend.pct >= 0 ? <TrendingUp className="h-4 w-4 text-emerald-500" /> : <TrendingDown className="h-4 w-4 text-rose-500" />}
          </div>
        )}
        <div className="leading-none text-muted-foreground">
          {series
            .map((s) =>
              footerMode === "average"
                ? `${totals[s.key].toFixed(1)} ${unit} avg ${s.label.toLowerCase()}`
                : `${totals[s.key].toFixed(1)} ${footerUnit} ${s.label.toLowerCase()}`
            )
            .join(" · ")}{" "}
          so far today
        </div>
      </CardFooter>
    </Card>
  );
}
