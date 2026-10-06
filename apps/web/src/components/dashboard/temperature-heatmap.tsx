"use client";

import * as React from "react";
import { INTERVAL_OPTIONS, formatBucketLabel } from "@/lib/day-buckets";
import { istSlotKey } from "@/lib/telemetry/combine";
import { useTodaySeries } from "@/lib/telemetry/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ChartEmptyState } from "./chart-empty-state";
import { ChartErrorCard } from "./chart-states";
import { useDelayedLoading } from "./use-delayed-loading";

export interface HeatmapRow {
  key: string;
  label: string;
  /** Color-scale ceiling — a reading at/above this renders fully "hot"
   *  (red). Reuses the same warn thresholds TemperatureGauge already uses
   *  elsewhere on this page, so a cell that reads red here means the same
   *  thing a red gauge would. */
  maxC: number;
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
  // The shared store: one request per page, the interval combined locally, live ticks applied in place.
  const state = useTodaySeries(deviceId, rowKeys, bucketMinutes);
  const buckets = React.useMemo(() => state.axis.map((t) => istSlotKey(t)), [state.axis]);
  const valueAt = (key: string, i: number): number | null => state.byKey[key]?.[i]?.avg ?? null;
  const intervalLabel = INTERVAL_OPTIONS.find((o) => o.minutes === bucketMinutes)?.label ?? `${bucketMinutes} min`;

  const loading = state.status === "loading";
  const { showSkeleton } = useDelayedLoading(loading);

  // Same shell-stays-put approach as the other charts: the card keeps its size while loading.
  if (loading || showSkeleton) {
    return (
      <Card>
        <CardHeader className="space-y-1.5">
          <div className="flex flex-row items-center justify-between gap-4">
            <CardTitle className="text-sm">{title}</CardTitle>
            {showSkeleton ? <Skeleton className="h-2 w-20 rounded-full" /> : <div className="h-2 w-20" />}
          </div>
          {showSkeleton ? <Skeleton className="h-4 w-64 max-w-full" /> : <div className="h-4" />}
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {rows.map((row) => (
              <div key={row.key} className="flex items-center gap-2">
                {showRowLabels ? showSkeleton ? <Skeleton className="h-3 w-20 shrink-0" /> : <div className="h-3 w-20 shrink-0" /> : null}
                {showSkeleton ? <Skeleton className="h-5 flex-1 rounded-[3px]" /> : <div className="h-5 flex-1" />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }
  if (state.status === "error") return <ChartErrorCard title={title} message={state.error} onRetry={state.retry} height={80} />;

  if (!rowKeys.some((k) => state.byKey[k]?.some((p) => p !== null))) {
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
                {buckets.map((bk, i) => {
                  const v = valueAt(row.key, i);
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
