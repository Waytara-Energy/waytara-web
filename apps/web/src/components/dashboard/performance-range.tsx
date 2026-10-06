"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { istDate } from "@/lib/telemetry/combine";
import { useSeriesRange } from "@/lib/telemetry/react";
import type { RangeWindow } from "@/lib/telemetry/ranges";
import { aggregateDailyYield, zipDailySeries, type DailyPoint } from "@/lib/energy-aggregation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { ChartEmptyState } from "./chart-empty-state";
import { ChartErrorCard, ChartLoadingCard } from "./chart-states";
import { DivergingBarChart, PerformanceChart } from "./lazy-charts";
import { RangeBar } from "./range-bar";
import { RangeProvider, useRange } from "./range-context";
import { useDelayedLoading } from "./use-delayed-loading";

// The inverter's own "today" energy counters. A day's value is the counter's highest reading of that day.
const YIELD_KEY = "day_pv_energy_kwh";
const CHARGE_KEY = "day_battery_charge_energy_kwh";
const DISCHARGE_KEY = "day_battery_discharge_energy_kwh";
const IMPORT_KEY = "day_grid_import_energy_kwh";
const EXPORT_KEY = "day_grid_export_energy_kwh";
const KEYS = [YIELD_KEY, CHARGE_KEY, DISCHARGE_KEY, IMPORT_KEY, EXPORT_KEY];

interface Pt {
  max: number | null;
  last: number | null;
}

/** Day-by-day totals of one counter over the window (a day's value = the counter's max that day). */
function dailyOf(axis: number[], pts: (Pt | null)[] | undefined, deviceId: string): DailyPoint[] {
  const rows = (pts ?? []).flatMap((p, i) => (p && p.max !== null ? [{ device_id: deviceId, value: p.max, ts: `${istDate(axis[i])}T00:00:00` }] : []));
  return aggregateDailyYield(rows);
}

/** Energy of each hour of today: the counter's rise during that hour. */
function hourlyOf(axis: number[], pts: (Pt | null)[] | undefined): { label: string; value: number }[] {
  let prev = 0;
  const out: { label: string; value: number }[] = [];
  (pts ?? []).forEach((p, i) => {
    if (p && p.last !== null) {
      out.push({ label: new Date(axis[i] + 19_800_000).toISOString().slice(11, 16), value: Math.max(0, p.last - prev) });
      prev = p.last;
    }
  });
  return out;
}

function HourlyBars({ title, series }: { title: string; series: { key: string; label: string; color: string; data: { label: string; value: number }[] }[] }) {
  const labels = Array.from(new Set(series.flatMap((s) => s.data.map((d) => d.label)))).sort();
  const rows = labels.map((label) => ({ label, ...Object.fromEntries(series.map((s) => [s.key, s.data.find((d) => d.label === label)?.value ?? 0])) }));
  const config = Object.fromEntries(series.map((s) => [s.key, { label: s.label, color: s.color }])) satisfies ChartConfig;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <ChartEmptyState />
        ) : (
          <ChartContainer config={config} className="aspect-auto h-[220px] w-full">
            <BarChart data={rows} margin={{ left: 4, right: 4, top: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
              <YAxis hide />
              <ChartTooltip content={<ChartTooltipContent formatter={(v, n) => <span>{String(n)}: {Number(v).toFixed(2)} kWh</span>} />} />
              {series.map((s) => (
                <Bar key={s.key} dataKey={s.key} name={s.label} fill={`var(--color-${s.key})`} radius={3} isAnimationActive={false} />
              ))}
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

function Charts({ deviceId, window: w, today }: { deviceId: string; window: RangeWindow; today: boolean }) {
  // Today: energy per hour (the counters' rise); longer ranges: one value per day.
  const state = useSeriesRange(deviceId, KEYS, w, today ? 60 : 1440);
  const loading = state.status === "loading";
  const { showSkeleton } = useDelayedLoading(loading);

  const hourly = React.useMemo(() => {
    if (!today) return null;
    return {
      yieldHours: hourlyOf(state.axis, state.byKey[YIELD_KEY]),
      chargeHours: hourlyOf(state.axis, state.byKey[CHARGE_KEY]),
      dischargeHours: hourlyOf(state.axis, state.byKey[DISCHARGE_KEY]),
      importHours: hourlyOf(state.axis, state.byKey[IMPORT_KEY]),
      exportHours: hourlyOf(state.axis, state.byKey[EXPORT_KEY]),
    };
  }, [state.axis, state.byKey, today]);
  const perDay = React.useMemo(() => {
    if (today) return null;
    const at = (k: string) => state.byKey[k];
    return {
      daily: dailyOf(state.axis, at(YIELD_KEY), deviceId),
      battery: zipDailySeries(dailyOf(state.axis, at(CHARGE_KEY), deviceId), dailyOf(state.axis, at(DISCHARGE_KEY), deviceId)),
      grid: zipDailySeries(dailyOf(state.axis, at(EXPORT_KEY), deviceId), dailyOf(state.axis, at(IMPORT_KEY), deviceId)),
    };
  }, [state.axis, state.byKey, today, deviceId]);

  if (loading || showSkeleton) {
    return (
      <div className="space-y-4">
        <ChartLoadingCard title="Energy" />
        <ChartLoadingCard title="Battery" height={180} />
        <ChartLoadingCard title="Grid" height={180} />
      </div>
    );
  }
  if (state.status === "error") return <ChartErrorCard title="Energy" message={state.error} onRetry={state.retry} />;

  if (hourly) {
    return (
      <div className="space-y-4">
        <HourlyBars title="Solar energy today, per hour" series={[{ key: "yield", label: "Generated", color: "var(--chart-3)", data: hourly.yieldHours }]} />
        <HourlyBars
          title="Battery today: charged vs. discharged"
          series={[
            { key: "charged", label: "Charged", color: "#10b981", data: hourly.chargeHours },
            { key: "discharged", label: "Discharged", color: "#f59e0b", data: hourly.dischargeHours },
          ]}
        />
        <HourlyBars
          title="Grid today: exported vs. imported"
          series={[
            { key: "exported", label: "Exported", color: "#10b981", data: hourly.exportHours },
            { key: "imported", label: "Imported", color: "#f59e0b", data: hourly.importHours },
          ]}
        />
      </div>
    );
  }
  if (!perDay) return null;
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-theme-border bg-theme-bg p-4">
        <PerformanceChart daily={perDay.daily} unit="kWh" />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Battery: Charge vs. Discharge</CardTitle>
        </CardHeader>
        <CardContent>
          <DivergingBarChart data={perDay.battery} positiveLabel="Charged" negativeLabel="Discharged" unit="kWh" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Grid: Export vs. Import</CardTitle>
        </CardHeader>
        <CardContent>
          <DivergingBarChart data={perDay.grid} positiveLabel="Exported" negativeLabel="Imported" unit="kWh" />
        </CardContent>
      </Card>
    </div>
  );
}

function Body({ deviceId }: { deviceId: string }) {
  const range = useRange();
  if (!range) return null;
  return <Charts deviceId={deviceId} window={range.window} today={range.preset === "today"} />;
}

/** Performance's energy history for a solar inverter: Today (per hour), 7 / 30 / 90 days or a custom window of up to
 *  30 days (per day), read from the rollups through the shared telemetry store. */
export function SolarPerformanceCharts({ deviceId }: { deviceId: string }) {
  return (
    <RangeProvider deviceId={deviceId}>
      <div className="space-y-4">
        <RangeBar />
        <Body deviceId={deviceId} />
      </div>
    </RangeProvider>
  );
}
