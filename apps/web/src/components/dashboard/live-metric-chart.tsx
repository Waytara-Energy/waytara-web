"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, XAxis, YAxis } from "recharts";
import { createClient } from "@waytara/supabase/client";
import { useRealtimeTable, type RealtimeRowEvent } from "@waytara/ui/realtime-provider";
import { fetchAllDeviceReadings } from "@/lib/device-readings-fetch";
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

export interface LiveChartSeries {
  key: string;
  label: string;
  color: string;
  /** Multiplies every raw device_readings value for this series before
   *  it's plotted — e.g. 0.001 to show a watts-denominated instrument_key
   *  in kW instead. Defaults to 1 (no conversion), so existing callers
   *  showing a reading in its native unit are unaffected. */
  scale?: number;
}

/** One rendered x-axis slot's worth of data — `time` plus each series'
 *  own value, and `__isYesterday` marking a point substituted from
 *  yesterday's data rather than today's own (see compareYesterday);
 *  absent or false both mean "this is today's real data" — it's only
 *  explicitly set back to false when a live reading arrives for a slot
 *  that had been borrowing yesterday's value. */
type ChartPoint = Record<string, string | number | null> & { __isYesterday?: boolean };

interface DeviceReadingRow {
  device_id: string;
  instrument_key: string;
  value: number | null;
  unit: string | null;
  ts: string;
  is_test: boolean;
}

/** The chart's own left edge — either a fixed rolling window (Monitoring's
 *  usage) or local midnight (Overview's "today so far" usage), computed
 *  fresh each call so it's always correct relative to *now*, not frozen at
 *  whatever time the component first mounted. Local midnight is deliberate
 *  — this runs client-side, so `new Date()` is already the viewer's own
 *  timezone, not the server's or a UTC-day boundary. */
function windowStart(sinceMidnight: boolean, windowMinutes: number): Date {
  if (sinceMidnight) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }
  return new Date(Date.now() - windowMinutes * 60000);
}

/** Floors a reading's timestamp to an N-minute bucket, as pure string
 *  arithmetic on the ISO string itself rather than round-tripping through
 *  a `Date` — `Date#toISOString()` always renders in UTC, which would
 *  silently shift the displayed hour whenever the viewer isn't in UTC.
 *  Slicing/padding instead preserves whatever offset the timestamp
 *  already carries, same as the plain `ts.slice(0, 16)` this replaces for
 *  the bucketMinutes=1 case. */
function bucketKeyFor(ts: string, bucketMinutes: number): string {
  if (bucketMinutes <= 1) return ts.slice(0, 16);
  const datePart = ts.slice(0, 10);
  const totalMinutes = Number(ts.slice(11, 13)) * 60 + Number(ts.slice(14, 16));
  const floored = totalMinutes - (totalMinutes % bucketMinutes);
  const hh = String(Math.floor(floored / 60)).padStart(2, "0");
  const mm = String(floored % 60).padStart(2, "0");
  return `${datePart}T${hh}:${mm}`;
}

/** A Date rendered as a local "YYYY-MM-DDTHH:MM" string — the local-time
 *  counterpart to `ts.slice(0, 16)` on a real reading's own ISO string,
 *  for the one place this file needs "now" in that same bucket-key shape
 *  (deciding which buckets are still in the future) rather than a reading
 *  that already carries its own offset. Never `Date#toISOString()` (UTC),
 *  same reasoning as bucketKeyFor. */
function localBucketDateString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Every bucket key for a full day starting at `dayStart` (local midnight),
 *  00:00 through the last bucket before the next midnight — used so a
 *  sinceMidnight chart always shows all 24 hours' worth of x-axis space
 *  instead of trailing off at "now" (that's what a per-bucket-if-it-has-
 *  data approach would otherwise produce). */
function fullDayBucketKeys(dayStart: Date, bucketMinutes: number): string[] {
  const datePart = localBucketDateString(dayStart).slice(0, 10);
  const totalBuckets = Math.ceil((24 * 60) / bucketMinutes);
  const keys: string[] = [];
  for (let i = 0; i < totalBuckets; i++) {
    const totalMinutes = i * bucketMinutes;
    const hh = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
    const mm = String(totalMinutes % 60).padStart(2, "0");
    keys.push(`${datePart}T${hh}:${mm}`);
  }
  return keys;
}

/** "06:30" (24h, the default) or "6 AM" (12h, minutes dropped) — the
 *  latter only reads cleanly on the sparse ticks a minimal bar-style
 *  chart shows (see showGrid/showYAxis/chartType="bar"), not a dense
 *  line chart where every tick needs its own minute. */
function formatTimeLabel(bucketKey: string, timeFormat: "24h" | "12h"): string {
  if (timeFormat === "24h") return bucketKey.slice(11);
  const hour = Number(bucketKey.slice(11, 13));
  const period = hour < 12 ? "AM" : "PM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour} ${period}`;
}

/** Custom XAxis tick for "every hour labeled, with unlabeled minor ticks
 *  at :15/:30/:45 in between" (axisTickMinutes < bucketMinutes) — an hour
 *  boundary gets a full tick + text label, everything else gets just a
 *  short line, purely as a ruler mark (recharts' own tick/label pairing
 *  can't split "show a tick here" from "show text here" any other way).
 *  Colors read off the chart's own CSS custom properties (not Tailwind
 *  classes) since this renders inside an SVG `<text>`/`<line>`, not a DOM
 *  element `className` can style directly. */
function DenseHourTick({
  x,
  y,
  payload,
  timeFormat,
}: {
  x?: string | number;
  y?: string | number;
  payload?: { value: string };
  timeFormat: "24h" | "12h";
}) {
  if (x === undefined || y === undefined || !payload) return null;
  const nx = Number(x);
  const ny = Number(y);
  const bucketKey = payload.value;
  const isHourMark = bucketKey.slice(14, 16) === "00";
  // Three-step hierarchy: minor (quarter-hour) ticks are shorter and in
  // the muted-foreground color so they're genuinely visible (not the
  // near-invisible border color) without competing with the hour ticks,
  // which are both taller AND drawn in the stronger foreground color —
  // that gap in height + color is what keeps "hour" reading as the real
  // tick at a glance and "quarter-hour" as a lighter in-between mark.
  if (!isHourMark) {
    return <line x1={nx} y1={ny} x2={nx} y2={ny + 5} stroke="var(--muted-foreground)" strokeWidth={1} opacity={0.5} />;
  }
  return (
    <g>
      <line x1={nx} y1={ny} x2={nx} y2={ny + 9} stroke="var(--foreground)" strokeWidth={1.5} />
      <text x={nx} y={ny + 21} textAnchor="middle" fontSize={10} fill="var(--muted-foreground)">
        {formatTimeLabel(bucketKey, timeFormat)}
      </text>
    </g>
  );
}

/** Wraps ChartTooltipContent to render nothing at all while hovering a
 *  yesterday-reference point (compareYesterday) — those grey marks are
 *  there to show the day's shape, not to be inspected value-by-value, so a
 *  hover card for them would just be noise. Real points still get the
 *  normal tooltip. */
function LiveTooltipContent(props: React.ComponentProps<typeof ChartTooltipContent>) {
  const point = (props.payload?.[0] as { payload?: ChartPoint } | undefined)?.payload;
  if (point?.__isYesterday) return null;
  return <ChartTooltipContent {...props} />;
}

/** Time-series chart for Monitoring (and Overview's "today" charts).
 *  Realtime rollout: the initial window is still one fetch on mount
 *  (realtime only tells us about *new* rows, not history), but new points
 *  now arrive via a device_readings INSERT subscription instead of a 30s
 *  poll — the DB only sends a change when one actually happens. Multiple
 *  series share one time axis: readings from different instruments rarely
 *  land on the exact same timestamp, so points are bucketed to the minute
 *  and forward-filled per series — otherwise a series that reports less
 *  often than another would show constant gaps rather than a continuous
 *  line. */
export function LiveMetricChart({
  deviceId,
  series,
  windowMinutes = 120,
  sinceMidnight = false,
  bucketMinutes = 1,
  axisTickMinutes,
  valueUnit,
  chartType = "line",
  showGrid = true,
  showYAxis = true,
  showLegend = true,
  compareYesterday = false,
  timeFormat = "24h",
}: {
  deviceId: string;
  series: LiveChartSeries[];
  windowMinutes?: number;
  /** Show the whole of today (local midnight -> now) instead of a fixed
   *  rolling window — for a chart meant to show the day's whole shape, not
   *  just the last couple hours. Takes precedence over `windowMinutes`. */
  sinceMidnight?: boolean;
  /** Bucket width in minutes — 1 (the default) matches Monitoring's
   *  per-reading granularity; a wider value (e.g. 30 for Overview's
   *  whole-day charts) averages every reading that landed in each bucket,
   *  rather than plotting one point per 5-minute reading across a whole
   *  day. */
  bucketMinutes?: number;
  /** Finer than `bucketMinutes` (e.g. 15 with an hourly bucketMinutes=60)
   *  to add unlabeled minor ruler ticks between each real bucket — every
   *  bucketMinutes-aligned tick gets a text label, the extra ones in
   *  between get just a short line (see DenseHourTick). Only meaningful
   *  with sinceMidnight (the full-day render-key generation is what makes
   *  the extra empty slots exist at all); defaults to `bucketMinutes`
   *  (no minor ticks, today's existing behavior) when omitted. */
  axisTickMinutes?: number;
  /** Suffix shown next to each value in the tooltip (e.g. "kW") — purely
   *  cosmetic, doesn't affect the numbers themselves (see each series' own
   *  `scale` for that). Omit for a chart whose series don't share one unit. */
  valueUnit?: string;
  /** "line" (default, Monitoring's own look) or "bar" — grouped bars, one
   *  per series per bucket, rounded on top only (the "Last 24 Hours"
   *  activity-ring style some reference dashboards use). Same fetched/
   *  bucketed/realtime data either way, just a different mark. */
  chartType?: "line" | "bar";
  /** Hide the horizontal gridlines for a more minimal look — Monitoring's
   *  charts keep them (default true); Overview's bar-style chart turns
   *  them off to match the plain, axis-light reference look. */
  showGrid?: boolean;
  /** Hide the Y-axis entirely, same minimal-look reasoning as `showGrid`. */
  showYAxis?: boolean;
  /** Hide the series-name legend below the chart (only ever shown when
   *  there's more than one series to begin with) — for a chart whose
   *  colors are explained elsewhere (a card title, surrounding context)
   *  and doesn't need its own legend row. */
  showLegend?: boolean;
  /** Fill the "hasn't happened yet" hours (see the isFuture handling
   *  below) with yesterday's own value at that same time-of-day instead
   *  of leaving them blank — rendered in a muted grey (see
   *  YESTERDAY_CELL_CLASS), not each series' real color, so it reads as a
   *  reference shape ("here's roughly what today might look like, going
   *  by yesterday") rather than actual data for hours that haven't
   *  happened. Only meaningful with sinceMidnight; a second query against
   *  yesterday's own [00:00, today's 00:00) window, bucketed by
   *  time-of-day (the date itself is discarded) so it lines up against
   *  today's same-shaped bucket array. */
  compareYesterday?: boolean;
  /** "24h" (default, e.g. "06:30") or "12h" (e.g. "6 AM", no minutes) —
   *  purely a label format for the X-axis ticks. */
  timeFormat?: "24h" | "12h";
}) {
  const [points, setPoints] = React.useState<ChartPoint[]>([]);
  const [loaded, setLoaded] = React.useState(false);
  const seriesKeys = series.map((s) => s.key).join(",");
  const scaleByKey = Object.fromEntries(series.map((s) => [s.key, s.scale ?? 1]));

  React.useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    const keys = seriesKeys.split(",");

    async function fetchData() {
      const since = windowStart(sinceMidnight, windowMinutes).toISOString();

      // Yesterday's own [00:00, today's 00:00) window — only queried when
      // asked for, and only makes sense alongside sinceMidnight (a rolling
      // window has no fixed "yesterday" to compare against).
      const yesterdayStart = new Date(windowStart(true, windowMinutes));
      yesterdayStart.setDate(yesterdayStart.getDate() - 1);

      const [data, yesterdayData] = await Promise.all([
        fetchAllDeviceReadings(supabase, deviceId, keys, since),
        compareYesterday && sinceMidnight
          ? fetchAllDeviceReadings(supabase, deviceId, keys, yesterdayStart.toISOString(), windowStart(true, windowMinutes).toISOString())
          : Promise.resolve(null),
      ]);

      if (cancelled) return;
      setLoaded(true);

      // Yesterday's readings, bucketed by time-of-day only (the date
      // itself discarded) so "yesterday 14:00" lines up against today's
      // own 14:00 slot regardless of which calendar date either falls on.
      const yesterdaySums = new Map<string, Record<string, number>>();
      const yesterdayCounts = new Map<string, Record<string, number>>();
      for (const row of yesterdayData ?? []) {
        if (row.value === null) continue;
        const timeOfDay = bucketKeyFor(row.ts, bucketMinutes).slice(11);
        if (!yesterdaySums.has(timeOfDay)) {
          yesterdaySums.set(timeOfDay, {});
          yesterdayCounts.set(timeOfDay, {});
        }
        const s = yesterdaySums.get(timeOfDay)!;
        const c = yesterdayCounts.get(timeOfDay)!;
        const scale = scaleByKey[row.instrument_key] ?? 1;
        s[row.instrument_key] = (s[row.instrument_key] ?? 0) + row.value * scale;
        c[row.instrument_key] = (c[row.instrument_key] ?? 0) + 1;
      }

      // Sum + count per bucket per series, not "last reading wins" — with
      // a 1-minute bucket those are practically the same thing (at most
      // one reading lands in a bucket), but a wider bucket (30 min) can
      // easily contain several readings, and averaging them is what
      // actually represents that whole window instead of just whichever
      // reading happened to land last in it.
      const sums = new Map<string, Record<string, number>>();
      const counts = new Map<string, Record<string, number>>();
      for (const row of data ?? []) {
        if (row.value === null) continue;
        const bucketKey = bucketKeyFor(row.ts, bucketMinutes);
        if (!sums.has(bucketKey)) {
          sums.set(bucketKey, {});
          counts.set(bucketKey, {});
        }
        const s = sums.get(bucketKey)!;
        const c = counts.get(bucketKey)!;
        const scale = scaleByKey[row.instrument_key] ?? 1;
        s[row.instrument_key] = (s[row.instrument_key] ?? 0) + row.value * scale;
        c[row.instrument_key] = (c[row.instrument_key] ?? 0) + 1;
      }

      // sinceMidnight always renders all 24 hours' worth of buckets, not
      // just the ones a reading happened to land in — otherwise the chart
      // trails off at "now" instead of showing the day's full shape (and
      // where it's headed, once the missing hours do land). A rolling
      // window (Monitoring's own usage) keeps the old behavior: only the
      // buckets that actually have data. Render slots are generated at
      // `axisTickMinutes` (finer than the real `bucketMinutes` data
      // width, when the caller wants minor ruler ticks in between) — the
      // extra in-between slots never match a real sums/counts key (those
      // are always aligned to `bucketMinutes`), so they naturally render
      // as empty/no-bar rather than needing separate handling.
      const renderMinutes = axisTickMinutes ?? bucketMinutes;
      const bucketKeysToRender = sinceMidnight
        ? fullDayBucketKeys(windowStart(true, windowMinutes), renderMinutes)
        : Array.from(sums.keys()).sort();
      const nowBucketKey = sinceMidnight ? bucketKeyFor(localBucketDateString(new Date()), renderMinutes) : null;

      const carry: Record<string, number | null> = {};
      const filled = bucketKeysToRender.map((bk) => {
        const point: ChartPoint = { time: bk };
        const s = sums.get(bk) ?? {};
        const c = counts.get(bk) ?? {};
        const isFuture = nowBucketKey !== null && bk > nowBucketKey;
        for (const key of keys) {
          if (c[key]) {
            point[key] = s[key] / c[key];
            carry[key] = point[key] as number;
          } else if (isFuture) {
            // Hasn't happened yet — no real value to carry forward. If
            // asked to, fill it with yesterday's own value at this same
            // time-of-day instead of leaving it genuinely blank (see
            // compareYesterday's own doc comment) and flag the point so
            // rendering can color it as a reference shape, not real data.
            const yesterdayValue = yesterdaySums.get(bk.slice(11))?.[key];
            const yesterdayCount = yesterdayCounts.get(bk.slice(11))?.[key];
            if (compareYesterday && yesterdayValue !== undefined && yesterdayCount) {
              point[key] = yesterdayValue / yesterdayCount;
              point.__isYesterday = true;
            } else {
              point[key] = null;
            }
          } else {
            point[key] = carry[key] ?? null;
          }
        }
        return point;
      });
      setPoints(filled);
    }

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [deviceId, windowMinutes, sinceMidnight, bucketMinutes, axisTickMinutes, compareYesterday, seriesKeys]);

  // postgres_changes filters support exactly one column (device_id here) —
  // instrument_key isn't filterable server-side, so every INSERT for this
  // device arrives and this component decides for itself whether the row
  // is one of its own series (and skips test-only readings, matching the
  // initial fetch's `is_test=false`). Two LiveMetricChart instances on the
  // same page scoped to the same device (Monitoring's Power Flows + SOC
  // charts) share one underlying channel — see RealtimeProvider.
  useRealtimeTable<DeviceReadingRow>(
    "device_readings",
    "INSERT",
    `device_id=eq.${deviceId}`,
    React.useCallback(
      (payload: RealtimeRowEvent<DeviceReadingRow>) => {
        const row = payload.new;
        if (row.is_test) return;
        const keys = seriesKeys.split(",");
        if (!keys.includes(row.instrument_key)) return;

        // A live update just plots this one new reading into its bucket —
        // it doesn't re-average against whatever else already landed in
        // that bucket (this component doesn't keep per-bucket sums/counts
        // around between renders). With bucketMinutes=1 that's exactly
        // right; with a wider bucket it's a reasonable "latest data wins
        // until the next full refetch" approximation for the one bucket
        // still in progress, not a correctness issue for the rest of the
        // chart, which was already averaged from the initial fetch.
        const bucketKey = bucketKeyFor(row.ts, bucketMinutes);
        const windowStartKey = windowStart(sinceMidnight, windowMinutes).toISOString().slice(0, 16);
        const scaledValue = row.value === null ? null : row.value * (scaleByKey[row.instrument_key] ?? 1);

        setPoints((prev) => {
          // sinceMidnight's array is always the full day's fixed 48 (or
          // however many) buckets — the new reading's bucket already
          // exists in it, so update that entry in place rather than
          // assuming it's always the last one (a rolling window's array,
          // the other caller of this handler, only ever grows at the end,
          // which is what the old last-entry check assumed).
          const idx = prev.findIndex((p) => p.time === bucketKey);
          if (idx !== -1) {
            const next = [...prev];
            // A real reading just landed for this bucket — it's no longer
            // "hasn't happened yet, borrowing yesterday's shape", it's
            // today's own actual data now, so clear the flag along with
            // setting the value (otherwise it'd keep rendering grey).
            const updated: ChartPoint = { ...next[idx] };
            updated[row.instrument_key] = scaledValue;
            updated.__isYesterday = false;
            next[idx] = updated;
            return next;
          }
          const last = prev[prev.length - 1];
          const carried: ChartPoint = { time: bucketKey };
          for (const key of keys) carried[key] = last ? (last[key] ?? null) : null;
          carried[row.instrument_key] = scaledValue;
          return [...prev, carried].filter((p) => (p.time as string) >= windowStartKey);
        });
        setLoaded(true);
      },
      [seriesKeys, windowMinutes, sinceMidnight, bucketMinutes]
    )
  );

  const chartConfig = Object.fromEntries(
    series.map((s) => [s.key, { label: s.label, color: s.color }])
  ) satisfies ChartConfig;

  if (loaded && points.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No live data yet.</p>;
  }

  const tooltipFormatter = valueUnit
    ? (value: unknown, name: unknown) => (
        <span className="flex w-full justify-between gap-2">
          <span className="text-muted-foreground">{String(name)}</span>
          <span className="font-medium text-foreground tabular-nums">
            {typeof value === "number" ? value.toLocaleString("en-IN", { maximumFractionDigits: 2 }) : String(value)} {valueUnit}
          </span>
        </span>
      )
    : undefined;

  const Chart = chartType === "bar" ? BarChart : LineChart;
  const denseTicks = sinceMidnight && axisTickMinutes !== undefined && axisTickMinutes < bucketMinutes;
  // A full sinceMidnight day (48 buckets at the default 30-min width) is
  // far too dense to label every tick — space them every 6 hours instead
  // (12am/6am/12pm/6pm), matching the reference's sparse style. A rolling
  // window keeps the old auto-spacing (minTickGap below) since it doesn't
  // have a fixed, known bucket count to divide evenly. Not used at all in
  // denseTicks mode — DenseHourTick decides its own label/minor-tick split
  // per tick instead of this component skipping ticks wholesale.
  const xAxisInterval = denseTicks ? 0 : sinceMidnight ? Math.max(0, Math.round((6 * 60) / bucketMinutes) - 1) : undefined;

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-[220px] w-full">
      <Chart data={points} margin={{ left: 4, right: 4, top: 8 }} barGap={2} barCategoryGap="20%">
        {showGrid && <CartesianGrid vertical={false} />}
        <XAxis
          dataKey="time"
          tickFormatter={denseTicks ? undefined : (t: string) => formatTimeLabel(t, timeFormat)}
          tick={
            denseTicks
              ? (props: { x?: string | number; y?: string | number; payload?: { value: string } }) => (
                  <DenseHourTick x={props.x} y={props.y} payload={props.payload} timeFormat={timeFormat} />
                )
              : undefined
          }
          tickLine={false}
          axisLine={false}
          interval={xAxisInterval}
          tickMargin={denseTicks ? 0 : 8}
          minTickGap={40}
        />
        {showYAxis && (
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            width={44}
            tickFormatter={(v: number) => v.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
          />
        )}
        <ChartTooltip
          content={<LiveTooltipContent labelFormatter={(l) => formatTimeLabel(String(l), timeFormat)} formatter={tooltipFormatter} />}
        />
        {showLegend && series.length > 1 && <ChartLegend content={<ChartLegendContent />} />}
        {chartType === "bar"
          ? series.map((s) => (
              <Bar key={s.key} dataKey={s.key} fill={`var(--color-${s.key})`} radius={[6, 6, 0, 0]} maxBarSize={18}>
                {compareYesterday &&
                  points.map((p, i) => (
                    <Cell key={i} fill={p.__isYesterday ? "var(--muted-foreground)" : `var(--color-${s.key})`} fillOpacity={p.__isYesterday ? 0.3 : 1} />
                  ))}
              </Bar>
            ))
          : series.map((s) => (
              <Line
                key={s.key}
                dataKey={s.key}
                type="monotone"
                stroke={`var(--color-${s.key})`}
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            ))}
      </Chart>
    </ChartContainer>
  );
}
