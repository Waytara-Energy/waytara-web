"use client";

import { Zap, Gauge, BatteryCharging, Thermometer } from "lucide-react";
import { useLiveNumbers } from "@/lib/telemetry/live-values";
import { EV_CONNECTOR_TEMP_WARN_C } from "@/lib/ev-charger-catalog";
import { Figures, WidgetCard, type WidgetTone } from "./widget-ui";
import { cn } from "@/lib/utils";
import { useUnits } from "@/components/units-provider";

const TEMP_WARN_C = EV_CONNECTOR_TEMP_WARN_C;
const BADGE = { good: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400", warn: "bg-amber-500/15 text-amber-600 dark:text-amber-400", neutral: "bg-muted text-muted-foreground" } as const;
const KEYS = ["power_active_import_kw", "power_offered_kw", "current_import_l1_a", "voltage_l1_n_v", "connector_temperature_c"];

export type EvCardId = "power" | "current" | "temp" | "energy";

/** The EV charger's live-status cards, live like SolarLiveCards. Energy Delivered Today comes from charging
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
  /** One card of the four (an Overview widget each), or a pair: "left" is Charging Power + Current, "right" is Temperature + Energy. */
  which: EvCardId | "left" | "right";
}) {
  const n = useLiveNumbers([chargerId], KEYS, initial);
  const u = useUnits();

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
  const href = `/dashboard/monitoring?device=${chargerId}#hub`;

  const tile = (o: { icon: typeof Zap; tone: WidgetTone; title: string; value: string; unit?: string; subtitle: string; badge: string; badgeTone: "good" | "warn" | "neutral" }) => (
    <WidgetCard icon={o.icon} tone={o.tone} title={o.title} href={href}>
      <div className="flex min-h-0 flex-1 flex-col justify-center">
        <Figures size="lg" items={[{ label: o.subtitle, value: o.value, unit: o.unit }]} />
      </div>
      <span className={cn("self-start rounded-full px-2.5 py-0.5 text-xs font-medium", BADGE[o.badgeTone])}>{o.badge}</span>
    </WidgetCard>
  );
  const num = (v: number | null, unit: string, key: string, decimals: number) => (v !== null ? u.format(v, unit, key, decimals, false) : "—");

  const cards: Record<EvCardId, React.ReactNode> = {
    power: tile({
      icon: Zap,
      tone: charging ? "emerald" : "slate",
      title: "Charging power",
      value: num(powerKw, "kW", "power_active_import_kw", 2),
      unit: powerKw !== null ? u.unit("kW", "power_active_import_kw") : undefined,
      subtitle: offeredKw !== null ? `Offered ${u.format(offeredKw, "kW", "power_offered_kw", 1)}` : "Live charging",
      badge: charging ? "Charging" : "Idle",
      badgeTone: charging ? "good" : "neutral",
    }),
    current: tile({
      icon: Gauge,
      tone: drawing ? "emerald" : "slate",
      title: "Charging current",
      value: num(currentA, "A", "current_import_l1_a", 1),
      unit: currentA !== null ? u.unit("A", "current_import_l1_a") : undefined,
      subtitle: voltageV !== null ? `Voltage ${Math.round(voltageV)} V` : "Live draw",
      badge: drawing ? "Drawing" : "Idle",
      badgeTone: drawing ? "good" : "neutral",
    }),
    temp: tile({
      icon: Thermometer,
      tone: tempC === null ? "slate" : tempWarm ? "amber" : "emerald",
      title: "Connector temperature",
      value: num(tempC, "°C", "connector_temperature_c", 1),
      unit: tempC !== null ? u.unit("°C", "connector_temperature_c") : undefined,
      subtitle: "Live reading",
      badge: tempC === null ? "—" : tempWarm ? "Warm" : "Normal",
      badgeTone: tempC === null ? "neutral" : tempWarm ? "warn" : "good",
    }),
    energy: tile({
      icon: BatteryCharging,
      tone: hasEnergyToday ? "emerald" : "slate",
      title: "Energy delivered today",
      value: num(todayEnergyKwh, "kWh", "ev_energy_today_kwh", 1),
      unit: todayEnergyKwh !== null ? u.unit("kWh", "ev_energy_today_kwh") : undefined,
      subtitle: costToday !== null ? `Cost ₹${costToday.toLocaleString("en-IN", { maximumFractionDigits: 0 })}` : "Since midnight",
      badge: hasEnergyToday ? "Charged" : "None yet",
      badgeTone: hasEnergyToday ? "good" : "neutral",
    }),
  };

  if (which === "left") return <>{cards.power}{cards.current}</>;
  if (which === "right") return <>{cards.temp}{cards.energy}</>;
  return <>{cards[which]}</>;
}
