"use client";

import { Sun, Home, BatteryCharging, Zap } from "lucide-react";
import { useLiveNumbers } from "@/lib/telemetry/live-values";
import type { DeviceSyncInit } from "@/lib/device-sync-types";
import { LiveStatusCard, type StatusTone } from "./live-status-card";
import { useDeviceState } from "./use-device-state";

const KEYS = ["inverter_output_power_w", "load_total_power_w", "battery_soc_pct", "grid_total_power_w", "battery_power_w"];

function toKw(watts: number | null): string {
  return watts === null ? "—" : `${(watts / 1000).toFixed(2)} kW`;
}

type ConsumptionSource = "grid" | "battery" | "solar" | "idle";
const CONSUMPTION_BADGE: Record<ConsumptionSource, string> = { grid: "Grid-Assisted", battery: "Battery-Powered", solar: "Solar-Powered", idle: "Idle" };
const CONSUMPTION_TONE: Record<ConsumptionSource, StatusTone> = { grid: "warn", battery: "good", solar: "good", idle: "neutral" };

/** Overview's Solar / Consumption / Battery / Grid row, live: the headline numbers, badges and tones follow every
 *  upload from the device.
 *
 *  Battery power from the inverter is POSITIVE = DISCHARGING, NEGATIVE = CHARGING (register 190). */
export function SolarLiveCards({ inverterId, initial, sync }: { inverterId: string; initial: Record<string, number | null>; sync: DeviceSyncInit }) {
  const live = useLiveNumbers([inverterId], KEYS, initial);
  const { offline } = useDeviceState(inverterId, sync);
  // A device that is not answering has no current reading: show dashes, not the last numbers it sent.
  const n = offline ? Object.fromEntries(KEYS.map((k) => [k, null])) : live;

  const solarW = n.inverter_output_power_w;
  const loadW = n.load_total_power_w;
  const socPct = n.battery_soc_pct;
  const gridW = n.grid_total_power_w;
  const batteryW = n.battery_power_w;

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

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <LiveStatusCard
        icon={Sun}
        iconTone={solarW !== null && solarW > 0 ? "good" : "neutral"}
        title="Solar Generated"
        subtitle="Live Production"
        value={toKw(solarW)}
        statusLabel="Status"
        badgeLabel={offline ? "Offline" : solarW !== null && solarW > 0 ? "Producing" : "Idle"}
        badgeTone={solarW !== null && solarW > 0 ? "good" : "neutral"}
        href={`/dashboard/monitoring?device=${inverterId}#solar`}
      />

      <LiveStatusCard
        icon={Home}
        iconTone={CONSUMPTION_TONE[consumptionSource]}
        title="Consumption"
        subtitle="Live Usage"
        value={toKw(loadW)}
        statusLabel="Source"
        badgeLabel={offline ? "Offline" : CONSUMPTION_BADGE[consumptionSource]}
        badgeTone={CONSUMPTION_TONE[consumptionSource]}
        href={`/dashboard/monitoring?device=${inverterId}#load`}
      />

      <LiveStatusCard
        icon={BatteryCharging}
        iconTone={batteryTone}
        title="Battery"
        subtitle={batteryW !== null && batteryW !== 0 ? `${batteryDirection} · ${toKw(Math.abs(batteryW))}` : batteryDirection}
        value={socPct !== null ? `${Math.round(socPct)}%` : "—"}
        statusLabel="Charge Level"
        badgeLabel={offline ? "Offline" : batteryBadge}
        badgeTone={batteryTone}
        href={`/dashboard/monitoring?device=${inverterId}#battery`}
      />

      <LiveStatusCard
        icon={Zap}
        iconTone={gridTone}
        title="Grid Interaction"
        subtitle="Live Interaction"
        value={toKw(gridW !== null ? Math.abs(gridW) : null)}
        statusLabel="Direction"
        badgeLabel={offline ? "Offline" : gridDirection}
        badgeTone={gridTone}
        href={`/dashboard/monitoring?device=${inverterId}#grid`}
      />
    </div>
  );
}
