"use client";

import * as React from "react";
import { BarTrendChart, type BarTrendSeries } from "./bar-trend-chart";
import { IntervalHeader } from "./interval-header";
import { useSharedInterval } from "./interval-context";

/** Main Hub's trends: the inverter's output power in one full-width chart on top, then one power chart each for solar,
 *  load, grid and battery in a 2x2 grid, each showing the whole day. One interval (15m/30m/1h/2h) rebuckets all of them. */
export function MainHubTrendGroup({
  deviceId,
  inverterSeries,
  powerSeries,
}: {
  deviceId: string;
  inverterSeries?: BarTrendSeries;
  powerSeries: BarTrendSeries[];
}) {
  const [bucketMinutes, setBucketMinutes] = useSharedInterval();

  return (
    <>
      <div className="space-y-3">
        <IntervalHeader title="Power Flows" minutes={bucketMinutes} onChange={setBucketMinutes} />
        {inverterSeries && (
          <BarTrendChart deviceId={deviceId} title={`${inverterSeries.label} power`} series={[inverterSeries]} bucketMinutes={bucketMinutes} hideIntervalSelect showYAxis hideFooter fromFirstData />
        )}
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
