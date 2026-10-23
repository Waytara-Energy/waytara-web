"use client";

import * as React from "react";
import type { ComponentProps } from "react";
import Link from "next/link";
import { BatteryCharging, CircleOff, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useUnits } from "@/components/units-provider";
import { SITE_OVERVIEW_KEYS, siteAgg } from "@/lib/overview-keys";
import { solarGenerationW } from "@/lib/solar-generation";
import { useLiveNumbers, type Agg } from "@/lib/telemetry/live-values";
import { widgetMeta, type WidgetType } from "@/lib/overview-layout";
import { cn } from "@/lib/utils";
import { EnergyTodayCards } from "./energy-today-cards";
import { EvLiveCards, type EvCardId } from "./ev-live-cards";
import type { EvCardsProps } from "./ev-live-status-cards";
import { LiveEnergyFlow } from "./overview-live";
import type { SolarCardsProps } from "./solar-live-status-cards";
import { FLOW } from "./flow-colors";

/** What a widget can draw from: the site's inverter numbers, its charger numbers and the energy-flow settings (each null when the site has no such
 *  device, and the widgets that need it then say so), and who is looking. */
export interface WidgetContext {
  solar: SolarCardsProps | null;
  ev: EvCardsProps | null;
  flow: ComponentProps<typeof LiveEnergyFlow> | null;
  firstName: string;
}

const EV_OF: Record<string, EvCardId> = { ev_power: "power", ev_current: "current", ev_temp: "temp", ev_energy: "energy" };

/** The inside of one widget. A widget whose device the site does not have shows a quiet note instead (it can still be moved or removed). */
export function WidgetBody({ type, ctx }: { type: WidgetType; ctx: WidgetContext }) {
  const meta = widgetMeta(type)!;
  const missing = (meta.needs === "inverter" && !ctx.solar) || (meta.needs === "charger" && !ctx.ev);
  if (missing) return <Unavailable label={meta.label} what={meta.needs === "charger" ? "an EV charger" : "a solar inverter"} />;

  switch (type) {
    case "solar":
    case "grid":
    case "load":
    case "battery":
    case "selfpowered":
    case "exported":
    case "imported":
      return <EnergyTodayCards {...ctx.solar!} cards={[type]} />;
    case "flow":
      return (
        // the drawing is as tall as the widget (the widget is a size container), less the colour key under it
        <div className="flex h-full min-w-0 items-center justify-center" style={{ "--flow-h": "calc(100cqh - 3.5rem)" } as React.CSSProperties}>
          <div className="w-full">
            <LiveEnergyFlow {...ctx.flow!} fit />
          </div>
        </div>
      );
    case "battery_level":
      return <BatteryLevel solar={ctx.solar!} flow={ctx.flow} />;
    case "power_now":
      return <PowerNow solar={ctx.solar!} flow={ctx.flow} />;
    case "ev_power":
    case "ev_current":
    case "ev_temp":
    case "ev_energy":
      return <EvLiveCards {...ctx.ev!} which={EV_OF[type]} />;
    case "clock":
      return <Clock firstName={ctx.firstName} />;
  }
}

function Unavailable({ label, what }: { label: string; what: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border p-3 text-center">
      <CircleOff className="size-5 text-muted-foreground" />
      <p className="text-sm font-medium text-foreground">{label}</p>
      <p className="text-xs text-muted-foreground">This site has no {what}.</p>
    </div>
  );
}

function useSite(solar: SolarCardsProps, flow: WidgetContext["flow"]) {
  const ids = flow?.inverterIds ?? [solar.inverterId];
  const pvKeys = flow?.pvKeys ?? solar.pvKeys;
  const keys = React.useMemo(() => [...SITE_OVERVIEW_KEYS, ...pvKeys], [pvKeys]);
  const n = useLiveNumbers(ids, keys, flow?.initial ?? solar.initial, (k) => siteAgg(k) as Agg);
  return { n, pvKeys, deviceId: ids[0] ?? solar.inverterId };
}

/** A ring that fills with the battery's state of charge, with what the battery is doing under it. */
function BatteryLevel({ solar, flow }: { solar: SolarCardsProps; flow: WidgetContext["flow"] }) {
  const { n, deviceId } = useSite(solar, flow);
  const u = useUnits();
  const soc = n.battery_soc_pct;
  const pct = soc === null || soc === undefined ? null : Math.min(100, Math.max(0, soc));
  const raw = n.battery_power_w ?? null; // the inverter reports discharging as positive
  const charging = raw !== null && raw < -50;
  const discharging = raw !== null && raw > 50;
  const colour = pct === null ? FLOW.idle : pct < 20 ? "#ef4444" : pct < 50 ? FLOW.drawing : FLOW.producing;
  const R = 42;
  const C = 2 * Math.PI * R;
  return (
    <Card className="h-full min-h-0 gap-0 py-0">
      <Link href={`/dashboard/monitoring?device=${deviceId}#battery`} className="group flex h-full min-h-0 flex-col gap-2 p-4">
        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
          <BatteryCharging className="size-4 text-muted-foreground" />
          Battery level
        </span>
        <div className="relative flex min-h-0 flex-1 items-center justify-center">
          <svg viewBox="0 0 100 100" className="h-full max-h-full w-auto max-w-full" role="img" aria-label={pct === null ? "Battery level unknown" : `Battery ${Math.round(pct)} per cent`}>
            <circle cx="50" cy="50" r={R} fill="none" stroke="currentColor" strokeOpacity="0.12" strokeWidth="9" />
            {pct !== null && <circle cx="50" cy="50" r={R} fill="none" stroke={colour} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${(C * pct) / 100} ${C}`} transform="rotate(-90 50 50)" />}
            <text x="50" y="55" textAnchor="middle" className="fill-foreground text-[22px] font-semibold">
              {pct === null ? "—" : `${Math.round(pct)}%`}
            </text>
          </svg>
        </div>
        <p className="truncate text-center text-xs text-muted-foreground">
          {raw === null ? "No reading yet" : charging ? `Charging · ${u.format(-raw / 1000, "kW", "battery_power_w", 2)}` : discharging ? `Discharging · ${u.format(raw / 1000, "kW", "battery_power_w", 2)}` : "Resting"}
        </p>
      </Link>
    </Card>
  );
}

/** Four live numbers: what the panels make, what the site uses, and what the grid and the battery are doing. */
function PowerNow({ solar, flow }: { solar: SolarCardsProps; flow: WidgetContext["flow"] }) {
  const { n, pvKeys, deviceId } = useSite(solar, flow);
  const u = useUnits();
  const kw = (w: number | null | undefined, key: string) => (w === null || w === undefined ? "—" : u.format(w / 1000, "kW", key, 2));
  const grid = n.grid_total_power_w ?? null;
  const battery = n.battery_power_w ?? null;
  const tiles: { label: string; value: string; note?: string; colour: string }[] = [
    { label: "Solar", value: kw(solarGenerationW(n, pvKeys), "inverter_output_power_w"), colour: FLOW.producing },
    { label: "Load", value: kw(n.load_total_power_w, "load_total_power_w"), colour: FLOW.consuming },
    { label: "Grid", value: grid === null ? "—" : kw(Math.abs(grid), "grid_total_power_w"), note: grid === null ? undefined : grid >= 0 ? "importing" : "exporting", colour: FLOW.drawing },
    { label: "Battery", value: battery === null ? "—" : kw(Math.abs(battery), "battery_power_w"), note: battery === null ? undefined : battery > 50 ? "discharging" : battery < -50 ? "charging" : "resting", colour: FLOW.idle },
  ];
  return (
    <Card className="h-full min-h-0 gap-0 py-0">
      <Link href={`/dashboard/monitoring?device=${deviceId}#hub`} className="group flex h-full min-h-0 flex-col gap-2 p-4">
        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Zap className="size-4 text-muted-foreground" />
          Power now
        </span>
        <div className="grid min-h-0 flex-1 grid-cols-2 content-center gap-x-4 gap-y-2 @min-[26rem]:grid-cols-4">
          {tiles.map((t) => (
            <div key={t.label} className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="size-2 shrink-0 rounded-full" style={{ background: t.colour }} />
                {t.label}
              </div>
              <div className="truncate text-xl font-semibold tabular-nums leading-tight text-foreground">{t.value}</div>
              {t.note && <div className="text-[11px] text-muted-foreground">{t.note}</div>}
            </div>
          ))}
        </div>
      </Link>
    </Card>
  );
}

const IST = "Asia/Kolkata";
const hourIst = (ms: number) => Number(new Intl.DateTimeFormat("en-GB", { timeZone: IST, hour: "numeric", hourCycle: "h23" }).format(ms));

/** The time and the date (India time, like the rest of the app) with a greeting by the hour. */
function Clock({ firstName }: { firstName: string }) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(t);
  }, []);
  const h = hourIst(now);
  const greeting = h < 5 ? "Good night" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : h < 21 ? "Good evening" : "Good night";
  return (
    <Card className="h-full min-h-0 justify-center gap-0 py-0">
      <div className="flex h-full min-h-0 flex-col justify-center px-4 @container">
        <p className={cn("truncate text-xs text-muted-foreground")} suppressHydrationWarning>
          {greeting}
          {firstName ? `, ${firstName}` : ""}
        </p>
        <p className="text-3xl font-semibold tabular-nums leading-tight text-foreground" suppressHydrationWarning>
          {new Date(now).toLocaleTimeString("en-IN", { timeZone: IST, hour: "numeric", minute: "2-digit", hour12: true })}
        </p>
        <p className="truncate text-xs text-muted-foreground" suppressHydrationWarning>
          {new Date(now).toLocaleDateString("en-IN", { timeZone: IST, weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>
    </Card>
  );
}
