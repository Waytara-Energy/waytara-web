"use client";

import { Zap, Gauge, BatteryCharging, Thermometer } from "lucide-react";
import { useLiveNumbers } from "@/lib/telemetry/live-values";
import { EV_CONNECTOR_TEMP_WARN_C } from "@/lib/ev-charger-catalog";
import { LiveStatusCard } from "./live-status-card";

const TEMP_WARN_C = EV_CONNECTOR_TEMP_WARN_C;
const KEYS = ["power_active_import_kw", "power_offered_kw", "current_import_l1_a", "voltage_l1_n_v", "connector_temperature_c"];

/** The EV charger's live-status row, live like SolarLiveCards. Energy Delivered Today comes from charging
 *  sessions (not telemetry), so it arrives from the server as-is and is refreshed when a session starts or ends. */
export function EvLiveCards({
  chargerId,
  initial,
  todayEnergyKwh,
  tariffRate,
  which,
}: {
  chargerId: string;
  initial: Record<string, number | null>;
  todayEnergyKwh: number | null;
  tariffRate: number;
  /** Overview puts two cards on each side of the energy flow: Charging Power + Current on the left, Temperature + Energy on the right. */
  which: "left" | "right";
}) {
  const n = useLiveNumbers([chargerId], KEYS, initial);

  const powerKw = n.power_active_import_kw;
  const offeredKw = n.power_offered_kw;
  const currentA = n.current_import_l1_a;
  const voltageV = n.voltage_l1_n_v;
  const tempC = n.connector_temperature_c;

  const tempWarm = tempC !== null && tempC >= TEMP_WARN_C;
  const charging = powerKw !== null && powerKw > 0;
  const drawing = currentA !== null && currentA > 0;
  const hasEnergyToday = todayEnergyKwh !== null && todayEnergyKwh > 0;
  const costToday = todayEnergyKwh !== null ? todayEnergyKwh * tariffRate : null;

  return which === "left" ? (
    <>
      <LiveStatusCard
        compact
        icon={Zap}
        iconTone={charging ? "good" : "neutral"}
        title="Charging Power"
        subtitle={offeredKw !== null ? `Power Offered · ${offeredKw.toFixed(1)} kW` : "Live Charging"}
        value={powerKw !== null ? `${powerKw.toFixed(2)} kW` : "—"}
        statusLabel="Status"
        badgeLabel={charging ? "Charging" : "Idle"}
        badgeTone={charging ? "good" : "neutral"}
        href={`/dashboard/monitoring?device=${chargerId}#hub`}
      />


      <LiveStatusCard
        compact
        icon={Gauge}
        iconTone={drawing ? "good" : "neutral"}
        title="Current"
        subtitle={voltageV !== null ? `Voltage · ${Math.round(voltageV)} V` : "Live Draw"}
        value={currentA !== null ? `${currentA.toFixed(1)} A` : "—"}
        statusLabel="Draw"
        badgeLabel={drawing ? "Drawing" : "Idle"}
        badgeTone={drawing ? "good" : "neutral"}
        href={`/dashboard/monitoring?device=${chargerId}#hub`}
      />

    </>
  ) : (
    <>
      <LiveStatusCard
        compact
        icon={Thermometer}
        iconTone={tempC === null ? "neutral" : tempWarm ? "warn" : "good"}
        title="Connector Temperature"
        subtitle="Live Reading"
        value={tempC !== null ? `${tempC.toFixed(1)} °C` : "—"}
        statusLabel="Status"
        badgeLabel={tempC === null ? "—" : tempWarm ? "Warm" : "Normal"}
        badgeTone={tempC === null ? "neutral" : tempWarm ? "warn" : "good"}
        href={`/dashboard/monitoring?device=${chargerId}#hub`}
      />


      <LiveStatusCard
        compact
        icon={BatteryCharging}
        iconTone={hasEnergyToday ? "good" : "neutral"}
        title="Energy Delivered Today"
        subtitle={costToday !== null ? `Cost · ₹${costToday.toLocaleString("en-IN", { maximumFractionDigits: 0 })}` : "Since midnight"}
        value={todayEnergyKwh !== null ? `${todayEnergyKwh.toFixed(1)} kWh` : "—"}
        statusLabel="Status"
        badgeLabel={hasEnergyToday ? "Charged" : "None yet"}
        badgeTone={hasEnergyToday ? "good" : "neutral"}
        href={`/dashboard/monitoring?device=${chargerId}#hub`}
      />
    </>
  );
}
