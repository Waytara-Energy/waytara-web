"use client";

import * as React from "react";
import { BarTrendChart, type BarTrendSeries } from "./bar-trend-chart";
import { TemperatureHeatmap, type HeatmapRow } from "./temperature-heatmap";
import { DEFAULT_INTERVAL_MINUTES } from "@/lib/day-buckets";

/** Owns the one interval Battery Pack's SOC Trend chart and its own
 *  temperature heatmap share — same pattern as MainHubTrendGroup. */
export function BatteryTrendGroup({
  deviceId,
  socSeries,
  temperatureRows,
}: {
  deviceId: string;
  socSeries: BarTrendSeries[];
  temperatureRows: HeatmapRow[];
}) {
  const [bucketMinutes, setBucketMinutes] = React.useState(DEFAULT_INTERVAL_MINUTES);

  return (
    <>
      <BarTrendChart
        deviceId={deviceId}
        title="Battery SOC Trend"
        series={socSeries}
        unit="%"
        valueScale={1}
        footerMode="average"
        bucketMinutes={bucketMinutes}
        onBucketMinutesChange={setBucketMinutes}
      />
      <TemperatureHeatmap deviceId={deviceId} rows={temperatureRows} bucketMinutes={bucketMinutes} />
    </>
  );
}
