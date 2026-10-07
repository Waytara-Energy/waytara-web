"use client";

import * as React from "react";
import { BarTrendChart, type BarTrendSeries } from "./bar-trend-chart";
import { useRange } from "./range-context";
import { useGoLive } from "./go-live";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DEFAULT_INTERVAL_MINUTES, INTERVAL_OPTIONS } from "@/lib/day-buckets";

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
  const range = useRange();
  const goLive = useGoLive();
  // The picker is for today's bars; a longer range or Go Live brings its own charts.
  const showPicker = !goLive?.active && (!range || range.preset === "today");

  return (
    <>
      <div className="space-y-3">
        {showPicker && (
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-medium text-foreground">Power Flows</h3>
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
          </div>
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
