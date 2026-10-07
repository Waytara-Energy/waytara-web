"use client";

import * as React from "react";
import { BarTrendChart, type BarTrendSeries } from "./bar-trend-chart";
import { IntervalHeader } from "./interval-header";
import { DEFAULT_INTERVAL_MINUTES } from "@/lib/day-buckets";

/** Main Hub's trends: one power chart each for solar, load, grid and battery in a 2x2 grid, each showing the whole
 *  day. One interval picker (15m/30m/1h/2h) rebuckets all four. */
export function MainHubTrendGroup({
  deviceId,
  powerSeries,
}: {
  deviceId: string;
  powerSeries: BarTrendSeries[];
}) {
  const [bucketMinutes, setBucketMinutes] = React.useState(DEFAULT_INTERVAL_MINUTES);

  return (
    <>
      <div className="space-y-3">
        <IntervalHeader title="Power Flows" minutes={bucketMinutes} onChange={setBucketMinutes} />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {powerSeries.map((s) => (
            <BarTrendChart
              key={s.key}
              deviceId={deviceId}
              title={`${s.label} power`}
              series={[s]}
              bucketMinutes={bucketMinutes}
              hideIntervalSelect
              showYAxis
              hideFooter
              fromFirstData
            />
          ))}
        </div>
      </div>
    </>
  );
}
