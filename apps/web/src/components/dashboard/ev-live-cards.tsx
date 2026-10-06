"use client";

import * as React from "react";
import { Zap, Gauge, BatteryCharging, Thermometer } from "lucide-react";
import { useTodaySeries } from "@/lib/telemetry/react";
import { useLiveNumbers } from "@/lib/telemetry/live-values";
import { EV_CONNECTOR_TEMP_WARN_C } from "@/lib/ev-charger-catalog";
import { LiveStatusCard, type SparkPoint, type SparkTone } from "./live-status-card";

const SPARK_POINTS = 60;
const TEMP_WARN_C = EV_CONNECTOR_TEMP_WARN_C;
// A second, higher band above TEMP_WARN_C for the sparkline's red vs yellow split.
const TEMP_HOT_C = 55;
const KEYS = ["power_active_import_kw", "power_offered_kw", "current_import_l1_a", "voltage_l1_n_v", "connector_temperature_c"];

interface TrendPoint {
  value: number;
  ts: string;
}

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

// Charging power / current draw: 0 is idle, a low fraction of the series' own peak is yellow (trickling),
// a healthy fraction is green.
function drawTone(value: number, max: number): SparkTone {
  if (value <= 0) return "gray";
  return value / max < 0.34 ? "yellow" : "green";
}

// Connector temperature is an absolute scale: green below the warn threshold, yellow up to the hot one, red past it.
function tempTone(value: number): SparkTone {
  if (value < TEMP_WARN_C) return "green";
  if (value < TEMP_HOT_C) return "yellow";
  return "red";
}

/** The EV charger's live-status row, live like SolarLiveCards. Energy Delivered Today comes from charging
 *  sessions (not telemetry), so it arrives from the server as-is and is refreshed when a session starts or ends. */
export function EvLiveCards({
  chargerId,
  initial,
  todayEnergyKwh,
  energySparkline,
  tariffRate,
}: {
  chargerId: string;
  initial: Record<string, number | null>;
  todayEnergyKwh: number | null;
  energySparkline: SparkPoint[];
  tariffRate: number;
}) {
  const n = useLiveNumbers([chargerId], KEYS, initial);
  const series = useTodaySeries(chargerId, KEYS, 15);

  const powerKw = n.power_active_import_kw;
  const offeredKw = n.power_offered_kw;
  const currentA = n.current_import_l1_a;
  const voltageV = n.voltage_l1_n_v;
  const tempC = n.connector_temperature_c;

  const powerSeries = React.useMemo(() => recent(series.axis, series.byKey.power_active_import_kw), [series.axis, series.byKey]);
  const currentSeries = React.useMemo(() => recent(series.axis, series.byKey.current_import_l1_a), [series.axis, series.byKey]);
  const tempSeries = React.useMemo(() => recent(series.axis, series.byKey.connector_temperature_c), [series.axis, series.byKey]);

  const tempWarm = tempC !== null && tempC >= TEMP_WARN_C;
  const charging = powerKw !== null && powerKw > 0;
  const drawing = currentA !== null && currentA > 0;
  const hasEnergyToday = todayEnergyKwh !== null && todayEnergyKwh > 0;
  const costToday = todayEnergyKwh !== null ? todayEnergyKwh * tariffRate : null;

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <LiveStatusCard
        icon={Zap}
        iconTone={charging ? "good" : "neutral"}
        title="Charging Power"
        subtitle={offeredKw !== null ? `Power Offered · ${offeredKw.toFixed(1)} kW` : "Live Charging"}
        value={powerKw !== null ? `${powerKw.toFixed(2)} kW` : "—"}
        liveValue={powerKw}
        statusLabel="Status"
        badgeLabel={charging ? "Charging" : "Idle"}
        badgeTone={charging ? "good" : "neutral"}
        sparkline={toSparkline(powerSeries, drawTone, (v) => `${v.toFixed(2)} kW`)}
        href={`/dashboard/monitoring?device=${chargerId}#hub`}
      />

      <LiveStatusCard
        icon={Gauge}
        iconTone={drawing ? "good" : "neutral"}
        title="Current"
        subtitle={voltageV !== null ? `Voltage · ${Math.round(voltageV)} V` : "Live Draw"}
        value={currentA !== null ? `${currentA.toFixed(1)} A` : "—"}
        liveValue={currentA}
        statusLabel="Draw"
        badgeLabel={drawing ? "Drawing" : "Idle"}
        badgeTone={drawing ? "good" : "neutral"}
        sparkline={toSparkline(currentSeries, drawTone, (v) => `${v.toFixed(1)} A`)}
        href={`/dashboard/monitoring?device=${chargerId}#hub`}
      />

      <LiveStatusCard
        icon={Thermometer}
        iconTone={tempC === null ? "neutral" : tempWarm ? "warn" : "good"}
        title="Connector Temperature"
        subtitle="Live Reading"
        value={tempC !== null ? `${tempC.toFixed(1)} °C` : "—"}
        liveValue={tempC}
        statusLabel="Status"
        badgeLabel={tempC === null ? "—" : tempWarm ? "Warm" : "Normal"}
        badgeTone={tempC === null ? "neutral" : tempWarm ? "warn" : "good"}
        sparkline={toSparkline(tempSeries, (v) => tempTone(v), (v) => `${v.toFixed(1)} °C`)}
        href={`/dashboard/monitoring?device=${chargerId}#hub`}
      />

      <LiveStatusCard
        icon={BatteryCharging}
        iconTone={hasEnergyToday ? "good" : "neutral"}
        title="Energy Delivered Today"
        subtitle={costToday !== null ? `Cost · ₹${costToday.toLocaleString("en-IN", { maximumFractionDigits: 0 })}` : "Since midnight"}
        value={todayEnergyKwh !== null ? `${todayEnergyKwh.toFixed(1)} kWh` : "—"}
        liveValue={todayEnergyKwh}
        statusLabel="Status"
        badgeLabel={hasEnergyToday ? "Charged" : "None yet"}
        badgeTone={hasEnergyToday ? "good" : "neutral"}
        sparkline={energySparkline}
        href={`/dashboard/monitoring?device=${chargerId}#hub`}
      />
    </div>
  );
}
