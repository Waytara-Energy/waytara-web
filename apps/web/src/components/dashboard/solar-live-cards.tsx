"use client";

import * as React from "react";
import { Sun, Home, BatteryCharging, Zap } from "lucide-react";
import { useTodaySeries } from "@/lib/telemetry/react";
import { useLiveNumbers } from "@/lib/telemetry/live-values";
import { LiveStatusCard, type SparkPoint, type SparkTone, type StatusTone } from "./live-status-card";

const SPARK_POINTS = 60;
const KEYS = ["inverter_output_power_w", "load_total_power_w", "battery_soc_pct", "grid_total_power_w", "battery_power_w"];

function toKw(watts: number | null): string {
  return watts === null ? "—" : `${(watts / 1000).toFixed(2)} kW`;
}

interface TrendPoint {
  value: number;
  ts: string;
}

/** The last SPARK_POINTS reported 15-minute slots of today for one metric. */
function recent(axis: number[], pts: ({ avg: number | null } | null)[] | undefined): TrendPoint[] {
  const out: TrendPoint[] = [];
  pts?.forEach((p, i) => {
    if (p && p.avg !== null) out.push({ value: p.avg, ts: new Date(axis[i]).toISOString() });
  });
  return out.slice(-SPARK_POINTS);
}

function toSparkline(series: TrendPoint[], tone: (value: number, max: number) => SparkTone, format: (value: number) => string): SparkPoint[] {
  const max = Math.max(1, ...series.map((p) => Math.abs(p.value)));
  return series.map((p) => ({ value: p.value, tone: tone(p.value, max), ts: p.ts, display: format(p.value) }));
}

// Power generation/draw: 0 is idle (gray), a low fraction of this series' own recent peak is yellow
// (underperforming relative to itself), and a healthy fraction is green.
function outputTone(value: number, max: number): SparkTone {
  if (value <= 0) return "gray";
  return value / max < 0.34 ? "yellow" : "green";
}

// Consumption: a *high* draw is what is worth flagging (more grid dependence, more cost).
function loadTone(value: number, max: number): SparkTone {
  if (value <= 0) return "gray";
  const frac = value / max;
  if (frac < 0.34) return "green";
  if (frac < 0.67) return "yellow";
  return "red";
}

// Battery SOC is a 0-100% absolute scale, so its bands are fixed thresholds.
function socTone(value: number): SparkTone {
  if (value < 20) return "red";
  if (value < 50) return "yellow";
  return "green";
}

type ConsumptionSource = "grid" | "battery" | "solar" | "idle";
const CONSUMPTION_BADGE: Record<ConsumptionSource, string> = { grid: "Grid-Assisted", battery: "Battery-Powered", solar: "Solar-Powered", idle: "Idle" };
const CONSUMPTION_TONE: Record<ConsumptionSource, StatusTone> = { grid: "warn", battery: "good", solar: "good", idle: "neutral" };

/** Overview's Solar / Consumption / Battery / Grid row, live: the headline numbers, badges and tones follow every
 *  upload from the device, the sparklines are today's 15-minute averages (the newest slot grows as the day goes).
 *
 *  Battery power from the inverter is POSITIVE = DISCHARGING, NEGATIVE = CHARGING (register 190). */
export function SolarLiveCards({ inverterId, initial }: { inverterId: string; initial: Record<string, number | null> }) {
  const n = useLiveNumbers([inverterId], KEYS, initial);
  const series = useTodaySeries(inverterId, KEYS, 15);

  const solarW = n.inverter_output_power_w;
  const loadW = n.load_total_power_w;
  const socPct = n.battery_soc_pct;
  const gridW = n.grid_total_power_w;
  const batteryW = n.battery_power_w;

  const solarSeries = React.useMemo(() => recent(series.axis, series.byKey.inverter_output_power_w), [series.axis, series.byKey]);
  const loadSeries = React.useMemo(() => recent(series.axis, series.byKey.load_total_power_w), [series.axis, series.byKey]);
  const socSeries = React.useMemo(() => recent(series.axis, series.byKey.battery_soc_pct), [series.axis, series.byKey]);
  const gridSeries = React.useMemo(() => recent(series.axis, series.byKey.grid_total_power_w), [series.axis, series.byKey]);

  // Which of the site's sources is covering the load right now: grid import wins outright (it costs money),
  // otherwise whichever of solar / battery contributes more.
  const gridAssisted = gridW !== null && gridW > 0;
  const solarContribution = Math.max(0, solarW ?? 0);
  const batteryDischarge = batteryW !== null && batteryW > 0 ? batteryW : 0;
  const consumptionSource: ConsumptionSource = gridAssisted
    ? "grid"
    : loadW === null || loadW <= 0
      ? "idle"
      : batteryDischarge > solarContribution
        ? "battery"
        : solarContribution > 0
          ? "solar"
          : "idle";

  const batteryDirection = batteryW === null || batteryW === 0 ? "Idle" : batteryW < 0 ? "Charging" : "Discharging";
  const batteryTone: StatusTone = socPct === null ? "neutral" : socPct >= 60 ? "good" : socPct >= 20 ? "neutral" : "warn";
  const batteryBadge = socPct === null ? "—" : socPct >= 60 ? "Good" : socPct >= 20 ? "Moderate" : "Low";

  const gridDirection = gridW === null || gridW === 0 ? "Idle" : gridW > 0 ? "Importing" : "Exporting";
  const gridTone: StatusTone = gridW === null || gridW === 0 ? "neutral" : gridW > 0 ? "warn" : "good";
  const gridMaxAbs = Math.max(1, ...gridSeries.map((p) => Math.abs(p.value)));
  const gridSparkline: SparkPoint[] = gridSeries.map((p) => ({
    value: p.value,
    tone: p.value === 0 ? "gray" : p.value > 0 ? (p.value / gridMaxAbs >= 0.5 ? "red" : "yellow") : "green",
    ts: p.ts,
    display: toKw(Math.abs(p.value)),
    directionLabel: p.value > 0 ? "Importing" : p.value < 0 ? "Exporting" : "Idle",
  }));

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <LiveStatusCard
        icon={Sun}
        iconTone={solarW !== null && solarW > 0 ? "good" : "neutral"}
        title="Solar Generated"
        subtitle="Live Production"
        value={toKw(solarW)}
        liveValue={solarW}
        statusLabel="Status"
        badgeLabel={solarW !== null && solarW > 0 ? "Producing" : "Idle"}
        badgeTone={solarW !== null && solarW > 0 ? "good" : "neutral"}
        sparkline={toSparkline(solarSeries, outputTone, (v) => toKw(v))}
        href={`/dashboard/monitoring?device=${inverterId}#solar`}
      />

      <LiveStatusCard
        icon={Home}
        iconTone={CONSUMPTION_TONE[consumptionSource]}
        title="Consumption"
        subtitle="Live Usage"
        value={toKw(loadW)}
        liveValue={loadW}
        statusLabel="Source"
        badgeLabel={CONSUMPTION_BADGE[consumptionSource]}
        badgeTone={CONSUMPTION_TONE[consumptionSource]}
        sparkline={toSparkline(loadSeries, loadTone, (v) => toKw(v))}
        href={`/dashboard/monitoring?device=${inverterId}#load`}
      />

      <LiveStatusCard
        icon={BatteryCharging}
        iconTone={batteryTone}
        title="Battery"
        subtitle={batteryW !== null && batteryW !== 0 ? `${batteryDirection} · ${toKw(Math.abs(batteryW))}` : batteryDirection}
        value={socPct !== null ? `${Math.round(socPct)}%` : "—"}
        liveValue={socPct}
        statusLabel="Charge Level"
        badgeLabel={batteryBadge}
        badgeTone={batteryTone}
        sparkline={toSparkline(socSeries, (v) => socTone(v), (v) => `${Math.round(v)}%`)}
        href={`/dashboard/monitoring?device=${inverterId}#battery`}
      />

      <LiveStatusCard
        icon={Zap}
        iconTone={gridTone}
        title="Grid Interaction"
        subtitle="Live Interaction"
        value={toKw(gridW !== null ? Math.abs(gridW) : null)}
        liveValue={gridW}
        statusLabel="Direction"
        badgeLabel={gridDirection}
        badgeTone={gridTone}
        sparkline={gridSparkline}
        href={`/dashboard/monitoring?device=${inverterId}#grid`}
      />
    </div>
  );
}
