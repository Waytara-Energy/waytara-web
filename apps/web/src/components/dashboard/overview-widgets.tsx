"use client";

import * as React from "react";
import type { ComponentProps } from "react";
import { BatteryCharging, CircleOff, Workflow, Zap } from "lucide-react";
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
import { Figures, WidgetCard } from "./widget-ui";

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
        <WidgetCard icon={Workflow} tone="emerald" title="Energy flow">
          {/* the drawing is as tall as the widget (the widget is a size container), less the title and the colour key */}
          <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center" style={{ "--flow-h": "calc(100cqh - 8.5rem)" } as React.CSSProperties}>
            <div className="w-full">
              <LiveEnergyFlow {...ctx.flow!} fit />
            </div>
          </div>
        </WidgetCard>
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
    <div className="flex h-full flex-col items-center justify-center gap-1.5 rounded-3xl border border-dashed border-border p-3 text-center">
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

/** The battery as a big percentage with a row of bars that fill with the charge (red when low, amber, green), and what it is doing under it. */
function BatteryLevel({ solar, flow }: { solar: SolarCardsProps; flow: WidgetContext["flow"] }) {
  const { n, deviceId } = useSite(solar, flow);
  const u = useUnits();
  const soc = n.battery_soc_pct;
  const pct = soc === null || soc === undefined ? null : Math.min(100, Math.max(0, soc));
  const raw = n.battery_power_w ?? null; // the inverter reports discharging as positive
  const charging = raw !== null && raw < -50;
  const discharging = raw !== null && raw > 50;
  const colour = pct === null ? FLOW.idle : pct < 20 ? "#ef4444" : pct < 50 ? FLOW.drawing : FLOW.producing;
  const BARS = 5;
  const filled = pct === null ? 0 : Math.ceil((pct / 100) * BARS);
  return (
    <WidgetCard icon={BatteryCharging} tone="green" title="Battery level" href={`/dashboard/monitoring?device=${deviceId}#battery`}>
      <div className="flex min-h-0 flex-1 items-end justify-between gap-3">
        <div className="min-w-0 self-center">
          <p className="truncate text-[clamp(1.75rem,12cqw,3.5rem)] font-semibold tabular-nums leading-none text-foreground" style={{ color: pct === null ? undefined : colour }}>
            {pct === null ? "—" : `${Math.round(pct)}%`}
          </p>
          <p className="mt-1.5 truncate text-xs text-muted-foreground">
            {raw === null ? "No reading yet" : charging ? `Charging · ${u.format(-raw / 1000, "kW", "battery_power_w", 2)}` : discharging ? `Discharging · ${u.format(raw / 1000, "kW", "battery_power_w", 2)}` : "Resting"}
          </p>
        </div>
        <div className="flex h-full max-h-28 min-h-8 w-[38%] max-w-32 items-end gap-1.5" role="img" aria-label={pct === null ? "Battery level unknown" : `Battery ${Math.round(pct)} per cent`}>
          {Array.from({ length: BARS }, (_, i) => (
            <span key={i} className="min-w-0 flex-1 rounded-md transition-colors" style={{ height: `${40 + i * 15}%`, background: i < filled ? colour : "currentColor", opacity: i < filled ? 1 : 0.14 }} />
          ))}
        </div>
      </div>
    </WidgetCard>
  );
}

/** Four live numbers in a row: what the panels make, what the site uses, and what the grid and the battery are doing. */
function PowerNow({ solar, flow }: { solar: SolarCardsProps; flow: WidgetContext["flow"] }) {
  const { n, pvKeys, deviceId } = useSite(solar, flow);
  const u = useUnits();
  const kw = (w: number | null | undefined, key: string) => (w === null || w === undefined ? "—" : u.format(w / 1000, "kW", key, 2, false));
  const grid = n.grid_total_power_w ?? null;
  const battery = n.battery_power_w ?? null;
  const unit = u.unit("kW", null);
  const items = [
    { label: "Solar", value: kw(solarGenerationW(n, pvKeys), "inverter_output_power_w"), unit },
    { label: "Load", value: kw(n.load_total_power_w, "load_total_power_w"), unit },
    { label: grid === null ? "Grid" : grid >= 0 ? "Grid in" : "Grid out", value: grid === null ? "—" : kw(Math.abs(grid), "grid_total_power_w"), unit },
    { label: battery === null ? "Battery" : battery > 50 ? "Battery out" : battery < -50 ? "Battery in" : "Battery", value: battery === null ? "—" : kw(Math.abs(battery), "battery_power_w"), unit },
  ];
  const dots = [FLOW.producing, FLOW.consuming, FLOW.drawing, FLOW.idle];
  return (
    <WidgetCard icon={Zap} tone="amber" title="Power now" href={`/dashboard/monitoring?device=${deviceId}#hub`}>
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-3">
        <Figures items={items} />
        <div className="flex h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
          {dots.map((c, i) => (
            <span key={c} className="h-full" style={{ background: c, width: `${[40, 25, 20, 15][i]}%`, opacity: 0.85 }} />
          ))}
        </div>
      </div>
    </WidgetCard>
  );
}

const IST = "Asia/Kolkata";

/** Hours, minutes and seconds in India time, as the angle of each hand (degrees from 12 o'clock). */
function handAngles(ms: number): { hour: number; minute: number; second: number; h24: number } {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: IST, hour: "numeric", minute: "numeric", second: "numeric", hourCycle: "h23" }).formatToParts(ms);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const h = get("hour");
  const m = get("minute");
  const s = get("second");
  return { hour: ((h % 12) + m / 60) * 30, minute: (m + s / 60) * 6, second: s * 6, h24: h };
}

/** An analog clock face (India time) with a digital time and the date beside it when the widget is wide enough, and a greeting by the hour. */
function Clock({ firstName }: { firstName: string }) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const a = handAngles(now);
  const greeting = a.h24 < 5 ? "Good night" : a.h24 < 12 ? "Good morning" : a.h24 < 17 ? "Good afternoon" : a.h24 < 21 ? "Good evening" : "Good night";
  return (
    <div className="flex h-full min-h-0 min-w-0 items-center gap-3 overflow-hidden rounded-3xl border border-border bg-card p-3 text-foreground shadow-sm">
      <svg viewBox="0 0 100 100" className="aspect-square h-full max-h-full min-h-0 shrink-0" role="img" aria-label="Clock" suppressHydrationWarning>
        <circle cx="50" cy="50" r="47" fill="none" stroke="currentColor" strokeOpacity="0.14" strokeWidth="2" />
        {Array.from({ length: 12 }, (_, i) => (
          <line key={i} x1="50" y1="9" x2="50" y2={i % 3 === 0 ? 17 : 13} stroke="currentColor" strokeOpacity={i % 3 === 0 ? 0.7 : 0.3} strokeWidth={i % 3 === 0 ? 2.4 : 1.4} strokeLinecap="round" transform={`rotate(${i * 30} 50 50)`} />
        ))}
        <line x1="50" y1="50" x2="50" y2="27" stroke="currentColor" strokeWidth="4" strokeLinecap="round" transform={`rotate(${a.hour} 50 50)`} suppressHydrationWarning />
        <line x1="50" y1="50" x2="50" y2="16" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" transform={`rotate(${a.minute} 50 50)`} suppressHydrationWarning />
        <line x1="50" y1="56" x2="50" y2="13" stroke="#ef4444" strokeWidth="1.4" strokeLinecap="round" transform={`rotate(${a.second} 50 50)`} suppressHydrationWarning />
        <circle cx="50" cy="50" r="3" fill="#ef4444" />
      </svg>
      <div className={cn("ov-clock-text min-w-0 flex-1")}>
        <p className="truncate text-xs text-muted-foreground" suppressHydrationWarning>
          {greeting}
          {firstName ? `, ${firstName}` : ""}
        </p>
        <p className="text-[clamp(1.25rem,9cqw,2.4rem)] font-semibold tabular-nums leading-tight" suppressHydrationWarning>
          {new Date(now).toLocaleTimeString("en-IN", { timeZone: IST, hour: "numeric", minute: "2-digit", hour12: true })}
        </p>
        <p className="truncate text-xs text-muted-foreground" suppressHydrationWarning>
          {new Date(now).toLocaleDateString("en-IN", { timeZone: IST, weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>
    </div>
  );
}
