"use client";

import * as React from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { createClient } from "@waytara/supabase/client";
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
}

/** Client-polling time-series chart for Monitoring — same "poll on an
 *  interval, don't bother with Realtime" choice MonitoringPanel already
 *  made (packages/ui), just plotted over time instead of flat dt/dd
 *  pairs. Multiple series share one time axis: readings from different
 *  instruments rarely land on the exact same timestamp, so points are
 *  bucketed to the minute and forward-filled per series — otherwise a
 *  series that reports less often than another would show constant gaps
 *  rather than a continuous line. */
export function LiveMetricChart({
  deviceId,
  series,
  pollIntervalMs = 30000,
  windowMinutes = 120,
}: {
  deviceId: string;
  series: LiveChartSeries[];
  pollIntervalMs?: number;
  windowMinutes?: number;
}) {
  const [points, setPoints] = React.useState<Record<string, string | number | null>[]>([]);
  const [loaded, setLoaded] = React.useState(false);
  const seriesKeys = series.map((s) => s.key).join(",");

  React.useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    const keys = seriesKeys.split(",");

    async function fetchData() {
      const since = new Date(Date.now() - windowMinutes * 60000).toISOString();
      const { data } = await supabase
        .from("device_readings")
        .select("instrument_key, value, ts")
        .eq("device_id", deviceId)
        .in("instrument_key", keys)
        .eq("is_test", false)
        .gte("ts", since)
        .order("ts", { ascending: true })
        .limit(2000);

      if (cancelled) return;
      setLoaded(true);
      if (!data || data.length === 0) {
        setPoints([]);
        return;
      }

      const buckets = new Map<string, Record<string, string | number | null>>();
      for (const row of data) {
        const bucketKey = row.ts.slice(0, 16); // YYYY-MM-DDTHH:MM
        if (!buckets.has(bucketKey)) buckets.set(bucketKey, { time: bucketKey });
        buckets.get(bucketKey)![row.instrument_key] = row.value;
      }

      const sortedBucketKeys = Array.from(buckets.keys()).sort();
      const carry: Record<string, number | null> = {};
      const filled = sortedBucketKeys.map((bk) => {
        const point = buckets.get(bk)!;
        for (const key of keys) {
          if (point[key] === undefined) point[key] = carry[key] ?? null;
          else carry[key] = point[key] as number;
        }
        return point;
      });
      setPoints(filled);
    }

    fetchData();
    const interval = setInterval(fetchData, pollIntervalMs);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [deviceId, pollIntervalMs, windowMinutes, seriesKeys]);

  const chartConfig = Object.fromEntries(
    series.map((s) => [s.key, { label: s.label, color: s.color }])
  ) satisfies ChartConfig;

  if (loaded && points.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No live data yet.</p>;
  }

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-[220px] w-full">
      <LineChart data={points} margin={{ left: 4, right: 4, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="time"
          tickFormatter={(t: string) => t.slice(11)}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={40}
        />
        <YAxis tickLine={false} axisLine={false} tickMargin={8} width={44} tickFormatter={(v: number) => v.toLocaleString("en-IN")} />
        <ChartTooltip content={<ChartTooltipContent labelFormatter={(l) => String(l).slice(11)} />} />
        {series.length > 1 && <ChartLegend content={<ChartLegendContent />} />}
        {series.map((s) => (
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
      </LineChart>
    </ChartContainer>
  );
}
