"use client";

import * as React from "react";
import { createClient } from "@waytara/supabase/client";
import { useRealtimeTable, type RealtimeRowEvent } from "@waytara/ui/realtime-provider";
import { fetchAllDeviceReadings } from "@/lib/device-readings-fetch";
import { INTERVAL_OPTIONS, todayMidnight, bucketKeyFor, fullDayBucketKeys, formatBucketLabel } from "@/lib/day-buckets";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface HeatmapRow {
  key: string;
  label: string;
  /** Color-scale ceiling — a reading at/above this renders fully "hot"
   *  (red). Reuses the same warn thresholds TemperatureGauge already uses
   *  elsewhere on this page, so a cell that reads red here means the same
   *  thing a red gauge would. */
  maxC: number;
}

interface RealtimeDeviceReadingRow {
  device_id: string;
  instrument_key: string;
  value: number | null;
  ts: string;
  is_test: boolean;
}

// Same reasoning as BarTrendChart's own module-level cache: this component
// remounts (and would otherwise refetch from a blank skeleton) every time
// its tab is reselected, since Radix unmounts inactive TabsContent.
const HEATMAP_CACHE_MAX = 24;
const heatmapCache = new Map<string, Map<string, Record<string, number | null>>>();
function cacheHeatmapBuckets(key: string, buckets: Map<string, Record<string, number | null>>) {
  heatmapCache.delete(key);
  heatmapCache.set(key, buckets);
  if (heatmapCache.size > HEATMAP_CACHE_MAX) {
    const oldest = heatmapCache.keys().next().value;
    if (oldest !== undefined) heatmapCache.delete(oldest);
  }
}

/** Green (cool) through amber to red (at/above `maxC`) — a continuous
 *  version of the same "hotter is worse" framing TemperatureGauge's own
 *  good/warn banding already uses, just smoothly graded instead of a
 *  single on/off threshold, since a whole day's worth of cells reads
 *  better as a gradient than a two-tone map. */
function heatColor(valueC: number, maxC: number): string {
  const frac = Math.max(0, Math.min(1, valueC / maxC));
  const hue = 140 - frac * 140; // 140 = green, 70 = amber, 0 = red
  return `hsl(${hue}, 65%, 42%)`;
}

/** A NYT-style "dot heatmap" — one row per sensor, one cell per bucket of
 *  today, cell color showing how hot that bucket's average reading ran
 *  relative to that sensor's own safe ceiling. Trades the live gauges'
 *  instant-reading precision for the one thing they can't show: today's
 *  shape — whether a sensor has been creeping up all day or just spiked
 *  once. Hovering a cell (Tooltip, not click — same as glancing at any
 *  other cell in a calendar heatmap) shows its exact reading and time.
 *
 *  `bucketMinutes` is the same interval Main Hub's Power Flows chart uses
 *  (see MainHubTrendGroup, which owns the shared state) — changing that
 *  chart's interval picker rebuckets this grid too, rather than the two
 *  showing different time granularities side by side. */
export function TemperatureHeatmap({
  deviceId,
  rows,
  bucketMinutes,
  title = "Temperature Today",
  showRowLabels = true,
}: {
  deviceId: string;
  rows: HeatmapRow[];
  bucketMinutes: number;
  title?: string;
  /** Hide the per-row sensor label column — set false when there's only
   *  one row and its name is already carried by `title`, so the label
   *  isn't shown twice (e.g. EV charger's single "Connector" row under a
   *  "Connector Temperature" title). The row's own label still appears in
   *  its cell tooltips. */
  showRowLabels?: boolean;
}) {
  const rowKeys = React.useMemo(() => rows.map((r) => r.key), [rows]);
  const rowKeysJoined = rowKeys.join(",");
  const [bucketed, setBucketed] = React.useState<Map<string, Record<string, number | null>>>(new Map());
  const [loaded, setLoaded] = React.useState(false);
  const fetchRef = React.useRef<() => void>(() => {});
  const realtimeDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    const cacheKey = `${deviceId}|${rowKeysJoined}|${bucketMinutes}`;

    const cached = heatmapCache.get(cacheKey);
    if (cached) {
      setBucketed(cached);
      setLoaded(true);
    }

    async function fetchData() {
      const since = todayMidnight().toISOString();
      const readings = await fetchAllDeviceReadings(supabase, deviceId, rowKeys, since);
      if (cancelled) return;
      setLoaded(true);

      const sums = new Map<string, Record<string, number>>();
      const counts = new Map<string, Record<string, number>>();
      for (const r of readings) {
        if (r.value === null) continue;
        const bucket = bucketKeyFor(r.ts, bucketMinutes);
        if (!sums.has(bucket)) {
          sums.set(bucket, Object.fromEntries(rowKeys.map((k) => [k, 0])));
          counts.set(bucket, Object.fromEntries(rowKeys.map((k) => [k, 0])));
        }
        sums.get(bucket)![r.instrument_key] += r.value;
        counts.get(bucket)![r.instrument_key] += 1;
      }

      // Always every bucket of the full day, not just up through "now" —
      // the rest of the day still renders as empty cells (no reading yet)
      // rather than the grid itself shrinking, and never borrows
      // yesterday's values to fill them the way BarTrendChart's future
      // buckets do.
      const merged = new Map<string, Record<string, number | null>>();
      for (const bk of fullDayBucketKeys(bucketMinutes)) {
        const s = sums.get(bk);
        const c = counts.get(bk);
        const vals: Record<string, number | null> = {};
        for (const k of rowKeys) vals[k] = c && c[k] ? s![k] / c[k] : null;
        merged.set(bk, vals);
      }
      setBucketed(merged);
      cacheHeatmapBuckets(cacheKey, merged);
    }

    fetchRef.current = () => {
      fetchData();
    };
    fetchData();
    return () => {
      cancelled = true;
    };
  }, [deviceId, rowKeysJoined, rowKeys, bucketMinutes]);

  // See BarTrendChart's identical comment — one device "tick" can insert
  // several rows matching this heatmap's own keys, so this needs its own
  // debounce on top of the shared realtime channel's ~300ms batching or a
  // single tick fires several uncollapsed refetches back-to-back.
  useRealtimeTable<RealtimeDeviceReadingRow>(
    "device_readings",
    "INSERT",
    `device_id=eq.${deviceId}`,
    React.useCallback(
      (payload: RealtimeRowEvent<RealtimeDeviceReadingRow>) => {
        const row = payload.new;
        if (row.is_test) return;
        if (!rowKeys.includes(row.instrument_key)) return;
        if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current);
        realtimeDebounceRef.current = setTimeout(() => fetchRef.current(), 500);
      },
      [rowKeys]
    )
  );

  const buckets = Array.from(bucketed.keys()).sort();
  const intervalLabel = INTERVAL_OPTIONS.find((o) => o.minutes === bucketMinutes)?.label ?? `${bucketMinutes} min`;

  // Same shell-stays-put approach as BarTrendChart's own !loaded branch —
  // this component remounts (and refetches) every time its tab is
  // reselected, since Radix unmounts inactive TabsContent, so this isn't
  // just a first-visit state.
  if (!loaded) {
    return (
      <Card>
        <CardHeader className="space-y-1.5">
          <div className="flex flex-row items-center justify-between gap-4">
            <CardTitle className="text-sm">{title}</CardTitle>
            <Skeleton className="h-2 w-20 rounded-full" />
          </div>
          <Skeleton className="h-4 w-64 max-w-full" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {rows.map((row) => (
              <div key={row.key} className="flex items-center gap-2">
                {showRowLabels ? <Skeleton className="h-3 w-20 shrink-0" /> : null}
                <Skeleton className="h-5 flex-1 rounded-[3px]" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (loaded && buckets.length === 0) {
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
      <CardHeader className="space-y-1.5">
        <div className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-sm">{title}</CardTitle>
          <div className="flex shrink-0 items-center gap-1.5 text-[10px] text-muted-foreground">
            <span>Cool</span>
            <div
              className="h-2 w-20 rounded-full"
              style={{ background: "linear-gradient(to right, hsl(140,65%,42%), hsl(70,65%,42%), hsl(0,65%,42%))" }}
            />
            <span>Hot</span>
          </div>
        </div>
        <CardDescription>
          {intervalLabel} average &middot; color shows how close each reading ran to its own safe ceiling
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.key} className="flex items-center gap-2">
              {showRowLabels ? (
                <span className="w-28 shrink-0 truncate text-xs text-muted-foreground">{row.label}</span>
              ) : null}
              <div className="flex flex-1 gap-1">
                {buckets.map((bk) => {
                  const v = bucketed.get(bk)?.[row.key] ?? null;
                  return (
                    <Tooltip key={bk}>
                      <TooltipTrigger asChild>
                        <div
                          className="h-5 flex-1 rounded-[3px]"
                          style={{ background: v !== null ? heatColor(v, row.maxC) : "var(--muted)" }}
                        />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="font-medium">{row.label}</p>
                        <p>
                          {v !== null ? `${v.toFixed(1)} °C` : "No data"} &middot; {formatBucketLabel(bk, bucketMinutes)}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className={cn("mt-1.5 flex gap-1", showRowLabels && "pl-[7.5rem]")}>
          {buckets.map((bk) => (
            <span key={bk} className="flex-1 text-center text-[9px] text-muted-foreground">
              {bk.slice(14, 16) === "00" ? formatBucketLabel(bk, bucketMinutes) : ""}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
