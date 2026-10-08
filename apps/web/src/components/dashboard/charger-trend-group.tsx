"use client";

import * as React from "react";
import { BarTrendChart, type BarTrendSeries, type BarTrendSessionMarker } from "./bar-trend-chart";
import { TemperatureHeatmap, type HeatmapRow } from "./temperature-heatmap";
import { useSharedInterval } from "./interval-context";

/** Owns the one interval Charging Power & Current chart and its own
 *  connector-temperature heatmap share. */
export function ChargerTrendGroup({
  deviceId,
  powerSeries,
  sessionMarkers,
  temperatureRows,
}: {
  deviceId: string;
  powerSeries: BarTrendSeries[];
  sessionMarkers: BarTrendSessionMarker[];
  temperatureRows: HeatmapRow[];
}) {
  const [bucketMinutes, setBucketMinutes] = useSharedInterval();

  return (
    <>
      <BarTrendChart
        deviceId={deviceId}
        title="Charging Power & Current"
        series={powerSeries}
        sessionMarkers={sessionMarkers}
        bucketMinutes={bucketMinutes}
        onBucketMinutesChange={setBucketMinutes}
      />
      <TemperatureHeatmap
        deviceId={deviceId}
        rows={temperatureRows}
        bucketMinutes={bucketMinutes}
        title="Connector Temperature"
        showRowLabels={false}
      />
    </>
  );
}
