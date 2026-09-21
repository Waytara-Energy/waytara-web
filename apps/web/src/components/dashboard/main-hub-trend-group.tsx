"use client";

import * as React from "react";
import { BarTrendChart, type BarTrendSeries } from "./bar-trend-chart";
import { TemperatureHeatmap, type HeatmapRow } from "./temperature-heatmap";
import { DEFAULT_INTERVAL_MINUTES } from "@/lib/day-buckets";

/** Owns the one interval (15m/30m/1h/2h) both Main Hub charts share —
 *  Power Flows' own Select drives it (passed through as a controlled
 *  prop), and TemperatureHeatmap just reads the same value, so changing
 *  the interval on one rebuckets both instead of the two silently
 *  showing different granularities side by side. */
export function MainHubTrendGroup({
  deviceId,
  powerSeries,
  temperatureRows,
}: {
  deviceId: string;
  powerSeries: BarTrendSeries[];
  temperatureRows: HeatmapRow[];
}) {
  const [bucketMinutes, setBucketMinutes] = React.useState(DEFAULT_INTERVAL_MINUTES);

  return (
    <>
      <BarTrendChart
        deviceId={deviceId}
        title="Power Flows"
        series={powerSeries}
        bucketMinutes={bucketMinutes}
        onBucketMinutesChange={setBucketMinutes}
      />
      <TemperatureHeatmap deviceId={deviceId} rows={temperatureRows} bucketMinutes={bucketMinutes} />
    </>
  );
}
