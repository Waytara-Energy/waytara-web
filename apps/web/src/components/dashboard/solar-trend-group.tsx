"use client";

import * as React from "react";
import { BarTrendChart, type BarTrendSeries } from "./bar-trend-chart";
import { IntervalHeader } from "./interval-header";
import { DEFAULT_INTERVAL_MINUTES } from "@/lib/day-buckets";

const PV_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-4)", "var(--chart-5)"];

/** Solar Array's trends: the solar power chart (the device's PV inputs added together) full width, and under it one chart
 *  per PV input side by side. All of them follow one interval picker and plot from the day's first reading to now. */
export function SolarTrendGroup({ deviceId, pvKeys }: { deviceId: string; pvKeys: string[] }) {
  const [bucketMinutes, setBucketMinutes] = React.useState(DEFAULT_INTERVAL_MINUTES);
  // A device with no PV power registers enabled falls back to its AC output.
  const total: BarTrendSeries =
    pvKeys.length > 0
      ? { key: "solar_total_w", label: "Solar", color: "var(--chart-3)", sumOf: pvKeys }
      : { key: "inverter_output_power_w", label: "Solar", color: "var(--chart-3)" };
  const inputs: BarTrendSeries[] = pvKeys.length > 1
    ? pvKeys.map((key, i) => ({ key, label: `PV${/^pv(\d+)_/.exec(key)?.[1] ?? i + 1}`, color: PV_COLORS[i % PV_COLORS.length] }))
    : [];
  const chart = { deviceId, bucketMinutes, hideIntervalSelect: true, showYAxis: true, fromFirstData: true, hideFooter: true } as const;

  return (
    <div className="space-y-3">
      <IntervalHeader title="Solar Power" minutes={bucketMinutes} onChange={setBucketMinutes} />
      <BarTrendChart {...chart} title="Solar power" series={[total]} />
      {inputs.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {inputs.map((s) => (
            <BarTrendChart key={s.key} {...chart} title={`${s.label} power`} series={[s]} />
          ))}
        </div>
      )}
    </div>
  );
}
