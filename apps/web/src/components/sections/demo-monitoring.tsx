"use client";

import * as React from "react";
import Image from "next/image";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  Bell,
  BatteryCharging,
  Check,
  ChevronsUpDown,
  CircleAlert,
  CircleCheck,
  Cloud,
  CloudMoon,
  CloudRain,
  CloudSun,
  Cpu,
  EvCharger,
  Gauge,
  Home,
  Moon,
  OctagonAlert,
  Server,
  SlidersHorizontal,
  Sun,
  Thermometer,
  TriangleAlert,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LiveStatusCard } from "@/components/dashboard/live-status-card";
import { TabHeadlineBar } from "@/components/dashboard/monitoring-tabs";
import { CHART_CURSOR } from "@/components/dashboard/chart-cursor";
import { FLOW, PV_SHADES } from "@/components/dashboard/flow-colors";
import {
  buildCharger,
  buildSampleData,
  istDay,
  SAMPLE_SITES,
  weatherAt,
  type DemoData,
  type EvEvent,
  type EvSample,
  type SampleCondition,
  type SampleDevice,
  type SampleSite,
  type SeriesPoint,
} from "@/lib/landing-sample";
import { cn } from "@/lib/utils";

// The customer's Monitoring page, as a small copy for the website, running on made-up figures (lib/landing-sample.ts): the same header, tabs, cards and charts
// as the real page. Its figures follow the real clock in India and move on every 10 seconds. The header works like the real one (the site switcher, the weather,
// the devices, the notifications), but there is no side menu and nothing leaves the page: Start / Stop charging only change this demo's own charger.

export const DEMO_WIDTH = 1180;
export const DEMO_HEIGHT = 737;

const IST_MS = 19_800_000;
const HOUR_MS = 3_600_000;
const TICK_MS = 10_000;

type InverterTab = "hub" | "solar" | "battery" | "load" | "grid";

const INVERTER_TABS: { id: InverterTab; label: string; icon: typeof Sun; active: string }[] = [
  { id: "hub", label: "Main Hub", icon: Server, active: "data-[state=active]:border-primary data-[state=active]:text-primary" },
  { id: "solar", label: "Solar Array", icon: Sun, active: "data-[state=active]:border-amber-500 data-[state=active]:text-amber-600 dark:data-[state=active]:text-amber-400" },
  { id: "battery", label: "Battery Pack", icon: BatteryCharging, active: "data-[state=active]:border-emerald-500 data-[state=active]:text-emerald-600 dark:data-[state=active]:text-emerald-400" },
  { id: "load", label: "Load", icon: Home, active: "data-[state=active]:border-sky-500 data-[state=active]:text-sky-600 dark:data-[state=active]:text-sky-400" },
  { id: "grid", label: "Grid Interface", icon: Zap, active: "data-[state=active]:border-violet-500 data-[state=active]:text-violet-600 dark:data-[state=active]:text-violet-400" },
];
const CHARGER_TAB_CLASS = "data-[state=active]:border-emerald-500 data-[state=active]:text-emerald-600 dark:data-[state=active]:text-emerald-400";

const DASH = "—";
const fixed = (v: number | null | undefined, d = 1) => (v === null || v === undefined ? DASH : v.toFixed(d));
const kw = (w: number | null | undefined) => (w === null || w === undefined ? DASH : (w / 1000).toFixed(2));

function clock(t: number) {
  const d = new Date(t + IST_MS);
  const h = d.getUTCHours();
  return `${h % 12 === 0 ? 12 : h % 12}:${String(d.getUTCMinutes()).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

function hourLabel(t: number, dayStart: number) {
  const h = Math.round((t - dayStart) / HOUR_MS) % 24;
  return `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? "AM" : "PM"}`;
}

/** The tab name of a charger: its name, without a rating that follows a dot ("EV Charger · 7.4 kW" is the tab "EV Charger"; "DUO 11 kW" stays as it is). */
const tabName = (d: SampleDevice) => d.name.split(" · ")[0];

/** The tick of the demo's clock: nothing until the page has loaded (so the server and the first paint agree), then the time now, every 10 seconds. */
function useNow(): [number | null, (ms: number) => void] {
  const [now, setNow] = React.useState<number | null>(null);
  React.useEffect(() => {
    void Promise.resolve().then(() => setNow(Date.now()));
    const id = window.setInterval(() => {
      if (!document.hidden) setNow(Date.now());
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, []);
  return [now, setNow];
}

/** The tooltip that follows the pointer over a chart. */
function HoverTip({ active, payload, unit, digits }: { active?: boolean; payload?: { payload: { t: number; v: number } }[]; unit: string; digits: number }) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="rounded-lg border bg-background px-2.5 py-1.5 text-xs shadow-md">
      <p className="tabular-nums text-muted-foreground">{clock(point.t)}</p>
      <p className="font-semibold tabular-nums">
        {point.v.toFixed(digits)} <span className="font-normal text-muted-foreground">{unit}</span>
      </p>
    </div>
  );
}

/** One trend card: title, the newest value with its time, and today's curve (hover it for the reading at any time). */
function TrendChart({
  title,
  unit,
  digits = 2,
  points,
  color,
  dayStart,
  now,
  legend,
  tall = false,
  labelEvery = 2,
}: {
  title: string;
  unit: string;
  digits?: number;
  points: SeriesPoint[];
  color: string;
  dayStart: number;
  now: number;
  legend?: { color: string; label: string }[];
  tall?: boolean;
  /** A time label every this many hours. */
  labelEvery?: number;
}) {
  const uid = React.useId().replace(/[^a-zA-Z0-9]/g, "");
  const data = React.useMemo(() => points.map(([t, v]) => ({ t, v })), [points]);
  const last = data[data.length - 1];
  const config = { v: { label: title, color } } satisfies ChartConfig;
  const ticks: number[] = [];
  for (let t = dayStart; t <= now; t += labelEvery * HOUR_MS) ticks.push(t);
  return (
    <div className="rounded-2xl border bg-card px-5 pb-2 pt-4 shadow-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[0.85rem] font-semibold text-foreground">{title}</p>
          <p className="mt-1 flex items-baseline gap-1 tabular-nums">
            <span className="text-[1.65rem] font-semibold leading-none text-foreground">{last ? last.v.toFixed(digits) : DASH}</span>
            <span className="text-xs text-muted-foreground">{unit}</span>
          </p>
          <p className="mt-1 text-[0.68rem] text-muted-foreground">{last ? clock(last.t) : "Waiting for readings"}</p>
        </div>
        {legend && (
          <div className="flex shrink-0 gap-3 pt-0.5 text-[0.65rem] text-muted-foreground">
            {legend.map((l) => (
              <span key={l.label} className="flex items-center gap-1">
                <span className="size-1.5 rounded-[2px]" style={{ backgroundColor: l.color }} />
                {l.label}
              </span>
            ))}
          </div>
        )}
      </div>
      <ChartContainer config={config} className={cn("mt-1 w-full", tall ? "h-[176px]" : "h-[112px]")}>
        <AreaChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: 6 }}>
          <defs>
            <linearGradient id={`g${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.38} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 4" stroke="var(--border)" />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={[dayStart, now]}
            ticks={ticks}
            tickFormatter={(t) => hourLabel(t as number, dayStart)}
            tickLine={{ stroke: "var(--muted-foreground)", strokeOpacity: 0.6 }}
            tickSize={5}
            axisLine={false}
            tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
            height={22}
            interval={0}
          />
          <YAxis hide domain={["auto", "auto"]} />
          <ChartTooltip cursor={CHART_CURSOR} allowEscapeViewBox={{ x: true, y: true }} offset={14} wrapperStyle={{ pointerEvents: "none", zIndex: 20 }} content={<HoverTip unit={unit} digits={digits} />} />
          <Area dataKey="v" type="monotone" stroke={color} strokeWidth={1.8} fill={`url(#g${uid})`} isAnimationActive={false} dot={false} activeDot={{ r: 4, fill: color, stroke: "var(--background)", strokeWidth: 2 }} />
        </AreaChart>
      </ChartContainer>
    </div>
  );
}

/** The title above a group of charts. */
function GroupTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-medium text-foreground">{children}</h3>;
}

// ------------------------------------------------------------------------------------------------ the header

export type PanelId = "site" | "weather" | "bell" | `device:${string}`;

/** Where the demo starts: a site, a tab, a menu already open, and a notification already opened out (used by the sign-in page's pictures of the app). */
export interface DemoInitial {
  site?: string;
  tab?: string;
  panel?: PanelId;
  alert?: number;
}

const WEATHER_ICON: Record<SampleCondition, { day: LucideIcon; night: LucideIcon; tone: string }> = {
  clear: { day: Sun, night: Moon, tone: "text-amber-500" },
  fair: { day: CloudSun, night: CloudMoon, tone: "text-amber-500" },
  partly: { day: CloudSun, night: CloudMoon, tone: "text-amber-500" },
  cloudy: { day: Cloud, night: Cloud, tone: "text-slate-400" },
  rain: { day: CloudRain, night: CloudRain, tone: "text-sky-500" },
};

interface Alert {
  kind: "fault" | "action" | "attention" | "good";
  title: string;
  body: string;
  where: string;
  minutesAgo: number;
}

const KIND_STYLE: Record<Alert["kind"], { icon: LucideIcon; tone: string; label: string }> = {
  fault: { icon: OctagonAlert, tone: "text-rose-500", label: "Fault" },
  action: { icon: CircleAlert, tone: "text-violet-500", label: "Needs action" },
  attention: { icon: TriangleAlert, tone: "text-amber-500", label: "Needs attention" },
  good: { icon: CircleCheck, tone: "text-emerald-500", label: "All good" },
};

/** The notifications of each site: one fault, one thing to act on, one to look at, and the good news (seven for the home). */
const ALERTS: Record<string, Alert[]> = {
  home: [
    { kind: "fault", title: "Grid over-voltage fault (E-21)", body: "The grid voltage went above the inverter's limit. The inverter paused and restarted by itself.", where: "Hybrid Inverter 8 kW", minutesAgo: 18 },
    { kind: "action", title: "Charger update waiting for you", body: "A new firmware version is ready for the DUO 7.4 kW. Approve it to install it when no car is charging.", where: "DUO 7.4 kW", minutesAgo: 64 },
    { kind: "attention", title: "Battery is warmer than usual", body: "The battery is a few degrees above its usual range for this time of day. It is still working normally.", where: "Battery pack", minutesAgo: 42 },
    { kind: "good", title: "Battery reached 80%", body: "Your battery charged from the sun and is now at 80%.", where: "Battery pack", minutesAgo: 96 },
    { kind: "good", title: "Automation completed", body: "The charging schedule ran from 12:00 PM to 2:00 PM and finished as planned.", where: "Schedules", minutesAgo: 25 },
    { kind: "good", title: "Report ready", body: "Your daily energy report has been generated and is ready to download.", where: "Reports", minutesAgo: 130 },
    { kind: "good", title: "Back online", body: "All devices are reporting again after a short network drop.", where: "Site", minutesAgo: 190 },
  ],
  hub: [
    { kind: "action", title: "Charger update waiting for you", body: "A new firmware version is ready for the DUO 7.4 kW B. Approve it to install it when no car is charging.", where: "DUO 7.4 kW B", minutesAgo: 51 },
    { kind: "attention", title: "Connector is warm", body: "The connector of the DUO 22 kW is warmer than usual during fast charging. It is still within its limits.", where: "DUO 22 kW", minutesAgo: 22 },
    { kind: "good", title: "Charge finished", body: "The DUO 11 kW finished a charge and delivered 18.4 kWh.", where: "DUO 11 kW", minutesAgo: 77 },
    { kind: "good", title: "Report ready", body: "Your daily charging report has been generated and is ready to download.", where: "Reports", minutesAgo: 150 },
  ],
};

const ICON_BTN = "flex h-8 min-w-8 cursor-pointer items-center justify-center rounded-md border px-2 outline-none transition-colors hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring/50";
const PANEL = "absolute z-40 rounded-2xl border bg-popover text-popover-foreground shadow-lg";

function DemoHeader({
  site,
  sites,
  panel,
  setPanel,
  onSite,
  nowMs,
  at,
  onDevice,
  activeDeviceId,
  chargers,
  mobile,
  initialAlert,
}: {
  site: SampleSite;
  sites: SampleSite[];
  panel: PanelId | null;
  setPanel: (p: PanelId | null) => void;
  onSite: (id: string) => void;
  nowMs: number | null;
  at: number;
  onDevice: (d: SampleDevice) => void;
  activeDeviceId: string | null;
  chargers: Record<string, EvSample>;
  /** The phone layout: a tighter header, the devices in one menu, and the panels as wide as the page. */
  mobile: boolean;
  initialAlert?: number;
}) {
  // on a phone the panels hang from the header itself (as wide as the page), not from the button that opened them
  const wrap = mobile ? "" : "relative";
  const toggle = (p: PanelId) => setPanel(panel === p ? null : p);
  const w = weatherAt(nowMs);
  const WIcon = WEATHER_ICON[w.condition][w.night ? "night" : "day"];
  const alerts = ALERTS[site.id] ?? [];
  const [filter, setFilter] = React.useState<"all" | Alert["kind"]>("all");
  const [openAlert, setOpenAlert] = React.useState<number | null>(initialAlert ?? null);
  const shown = alerts.filter((a) => filter === "all" || a.kind === filter);
  const counts = (k: Alert["kind"]) => alerts.filter((a) => a.kind === k).length;

  return (
    <header className={cn("relative z-20 flex h-14 shrink-0 items-center justify-between gap-3 bg-background", mobile ? "px-3" : "px-4")}>
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-full border bg-card">
          <Image src="/images/icon.png" alt="" width={20} height={20} unoptimized className="size-5 object-contain opacity-60" />
        </span>
        <div className={wrap}>
          <button
            type="button"
            data-demo-trigger
            aria-haspopup="listbox"
            aria-expanded={panel === "site"}
            onClick={() => toggle("site")}
            className="flex h-8 min-w-0 cursor-pointer items-center gap-1.5 rounded-md px-2 text-sm font-medium text-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <span className="truncate">{site.name}</span>
            <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
          </button>
          {panel === "site" && (
            <div data-demo-panel className={cn(PANEL, mobile ? "left-2 top-[3.25rem] w-64 p-1" : "left-0 top-10 w-64 p-1")}>
              {sites.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    onSite(s.id);
                    setPanel(null);
                  }}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-left outline-none hover:bg-accent focus-visible:bg-accent"
                >
                  <Check className={cn("size-4 shrink-0", s.id === site.id ? "opacity-100" : "opacity-0")} />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm">{s.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {s.devices.length} device{s.devices.length === 1 ? "" : "s"}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className={cn("flex items-center", mobile ? "gap-1.5" : "gap-2.5")}>
        {/* the weather at the site */}
        <div className={wrap}>
          <button
            type="button"
            data-demo-trigger
            aria-expanded={panel === "weather"}
            aria-label="Weather at the site. Open the forecast."
            onClick={() => toggle("weather")}
            className="flex h-8 cursor-pointer items-center gap-1.5 rounded-md px-1.5 text-sm font-medium text-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <WIcon className={cn("size-[18px]", WEATHER_ICON[w.condition].tone)} strokeWidth={1.7} />
            <span className="tabular-nums">{w.tempC}°</span>
          </button>
          {panel === "weather" && (
            <div data-demo-panel className={cn(PANEL, mobile ? "left-2 right-2 top-[3.25rem] p-4" : "right-0 top-10 w-[21rem] p-4")}>
              <div className="flex items-center gap-4">
                <WIcon className={cn("size-12", WEATHER_ICON[w.condition].tone)} strokeWidth={1.4} />
                <div>
                  <p className="text-3xl font-semibold leading-none tabular-nums">{w.tempC}°C</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {w.text} · feels like {w.feelsC}°
                  </p>
                </div>
              </div>
              <div className="mt-3 flex gap-5 text-xs text-muted-foreground">
                <span>Humidity {w.humidityPct}%</span>
                <span>Wind {w.windKmh} km/h</span>
              </div>
              <div className="mt-4 grid grid-cols-6 gap-1 border-t pt-3">
                {w.hours.map((x) => {
                  const HIcon = WEATHER_ICON[x.condition][x.night ? "night" : "day"];
                  return (
                    <div key={x.hour} className="flex flex-col items-center gap-1 text-xs">
                      <span className="text-muted-foreground">
                        {x.hour % 12 === 0 ? 12 : x.hour % 12} {x.hour < 12 ? "am" : "pm"}
                      </span>
                      <HIcon className={cn("size-4", WEATHER_ICON[x.condition].tone)} strokeWidth={1.7} />
                      <span className="tabular-nums">{x.tempC}°</span>
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 flex items-start gap-2 rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-foreground">
                <Sun className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
                {w.outlook}
              </p>
            </div>
          )}
        </div>

        {/* on a phone the devices are one button with a list */}
        {mobile && (
          <div className={wrap}>
            <button
              type="button"
              data-demo-trigger
              aria-label={`Devices: ${site.devices.length}. Open the list.`}
              aria-expanded={panel === "device:*"}
              onClick={() => toggle("device:*")}
              className={cn(ICON_BTN, "relative text-emerald-500", panel === "device:*" ? "bg-accent/40" : "bg-card")}
            >
              <Cpu className="size-4" />
              <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-emerald-500 text-[9px] font-semibold leading-none text-white">{site.devices.length}</span>
            </button>
            {panel === "device:*" && (
              <div data-demo-panel className={cn(PANEL, "left-2 right-2 top-[3.25rem] p-1")}>
                {site.devices.map((d) => {
                  const Icon = d.kind === "inverter" ? Server : EvCharger;
                  const ev = chargers[d.id];
                  const state = d.kind === "inverter" ? "Inverter · Online" : ev?.running ? "EV charger · Charging" : "EV charger · Available";
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => {
                        onDevice(d);
                        setPanel(null);
                      }}
                      className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left outline-none hover:bg-accent focus-visible:bg-accent"
                    >
                      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-500/12 text-emerald-600">
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{d.name}</span>
                        <span className="block text-xs text-muted-foreground">{state}</span>
                      </span>
                      {activeDeviceId === d.id && <Check className="size-4 shrink-0 text-emerald-600" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* one icon for each device of the site */}
        {!mobile &&
          site.devices.map((d) => {
          const Icon = d.kind === "inverter" ? Server : EvCharger;
          const ev = chargers[d.id];
          const state = d.kind === "inverter" ? "Inverter · Online" : ev?.running ? "EV charger · Charging" : "EV charger · Available";
          const id: PanelId = `device:${d.id}`;
          return (
            <div key={d.id} className="relative">
              <button
                type="button"
                data-demo-trigger
                aria-label={`${d.name}, online. Open its card.`}
                aria-expanded={panel === id}
                onClick={() => {
                  onDevice(d);
                  toggle(id);
                }}
                className={cn(ICON_BTN, "text-emerald-500", panel === id || activeDeviceId === d.id ? "bg-accent/40" : "bg-card")}
              >
                <Icon className="size-4" />
              </button>
              {panel === id && (
                <div data-demo-panel className={cn(PANEL, "right-0 top-10 w-[22rem]")}>
                  <div className="flex items-start gap-3 p-4">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-500/12 text-emerald-600">
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold leading-5">{d.name}</p>
                      <p className="text-xs leading-snug text-muted-foreground">{state}</p>
                    </div>
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-foreground" title="Device settings are part of the full dashboard">
                      <SlidersHorizontal className="size-4" />
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-4 border-t px-4 py-3 text-xs">
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-foreground">Last reading</span>
                      <span className="block text-muted-foreground">Online</span>
                    </span>
                    <span className="shrink-0 text-right tabular-nums text-muted-foreground">
                      {clock(at)}
                      <span className="block">just now</span>
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* the notifications */}
        <div className={wrap}>
          <button
            type="button"
            data-demo-trigger
            aria-expanded={panel === "bell"}
            aria-label={`Notifications, ${alerts.length} new`}
            onClick={() => toggle("bell")}
            className="relative grid size-9 cursor-pointer place-items-center rounded-full border bg-card text-foreground outline-none transition-colors hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <Bell className="size-4" />
            <span className="absolute -right-1 -top-1 grid size-[18px] place-items-center rounded-full bg-red-500 text-[10px] font-semibold leading-none text-white">{alerts.length}</span>
          </button>
          {panel === "bell" && (
            <div data-demo-panel className={cn(PANEL, "flex flex-col", mobile ? "left-2 right-2 top-[3.25rem] max-h-[26rem]" : "right-0 top-11 max-h-[30rem] w-[26rem]")}>
              <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-3.5">
                <p className="text-sm font-semibold">Notifications</p>
                <button type="button" onClick={() => setPanel(null)} aria-label="Close" className="grid size-6 cursor-pointer place-items-center rounded-md text-muted-foreground hover:bg-accent">
                  <X className="size-3.5" />
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 px-4 pb-2">
                {(
                  [
                    ["all", `All ${alerts.length}`],
                    ["fault", `Faults ${counts("fault")}`],
                    ["action", `Action ${counts("action")}`],
                    ["attention", `Attention ${counts("attention")}`],
                    ["good", `Good ${counts("good")}`],
                  ] as const
                )
                  .filter(([k]) => k === "all" || counts(k) > 0)
                  .map(([k, label]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => {
                        setFilter(k);
                        setOpenAlert(null);
                      }}
                      className={cn("cursor-pointer rounded-full border px-2.5 py-1 text-[11px] font-medium outline-none", filter === k ? "border-emerald-500/50 bg-emerald-500/10 text-foreground" : "text-muted-foreground hover:bg-accent")}
                    >
                      {label}
                    </button>
                  ))}
              </div>
              <ul className="min-h-0 flex-1 space-y-1 overflow-hidden px-2 pb-2">
                {shown.map((a, i) => {
                  const k = KIND_STYLE[a.kind];
                  const Icon = k.icon;
                  const open = openAlert === i;
                  return (
                    <li key={a.title} className={cn("rounded-2xl border border-transparent", open && "border-border bg-card/70")}>
                      <button type="button" onClick={() => setOpenAlert(open ? null : i)} aria-expanded={open} className="flex w-full cursor-pointer items-start gap-3 rounded-2xl px-3 py-2 text-left outline-none hover:bg-card/60 focus-visible:ring-2 focus-visible:ring-ring">
                        <Icon className={cn("mt-0.5 size-4 shrink-0", k.tone)} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-2">
                            <span className="truncate text-sm font-semibold text-foreground">{a.title}</span>
                            <span className="shrink-0 text-[11px] text-muted-foreground">{a.minutesAgo < 60 ? `${a.minutesAgo} min ago` : `${Math.floor(a.minutesAgo / 60)} h ago`}</span>
                          </span>
                          <span className={cn("block text-xs text-muted-foreground", !open && "truncate")}>{a.body}</span>
                          {open && (
                            <span className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                              <span className={cn("font-medium", k.tone)}>{k.label}</span>
                              <span>·</span>
                              <span>{a.where}</span>
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

// ------------------------------------------------------------------------------------------------ an EV charger

const SHARE_COLOR = { solar: FLOW.producing, battery: FLOW.drawing, grid: FLOW.idle } as const;

function EvTile({ label, value, unit, sub, bar, split }: { label: string; value: string; unit?: string; sub?: string; bar?: { pct: number; color: string } | null; split?: EvSample["shares"] | null }) {
  return (
    <div className="min-w-0 rounded-xl border bg-muted/30 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-2xl font-semibold leading-tight tabular-nums">
        {value}
        {unit ? <span className="ml-1 text-sm font-normal text-muted-foreground">{unit}</span> : null}
      </p>
      {bar ? (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-border" role="presentation">
          <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.min(100, bar.pct)}%`, backgroundColor: bar.color }} />
        </div>
      ) : null}
      {split ? (
        <div className="mt-2 flex h-1 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={split.map((x) => `${x.label} ${x.pct}%`).join(", ")}>
          {split
            .filter((x) => x.pct > 0)
            .map((x) => (
              <div key={x.key} style={{ width: `${x.pct}%`, backgroundColor: SHARE_COLOR[x.key] }} />
            ))}
        </div>
      ) : null}
      {sub ? <p className="mt-1.5 truncate text-xs text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

const hm = (m: number) => `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} min`;

/** One charger's Monitoring page: the live charge as tiles, today's power curve and today's charges. With no charge running the tiles are dashes. */
function ChargerPage({ ev, dayStart, now, mobile }: { ev: EvSample; dayStart: number; now: number; mobile: boolean }) {
  const top = [...ev.shares].sort((a, b) => b.pct - a.pct)[0];
  return (
    <div className="mt-3 space-y-3">
      {ev.running && (
      <div className={cn("grid gap-3", mobile ? "grid-cols-2 [&>*:last-child]:col-span-2" : "grid-cols-5")}>
          <EvTile
            label="Power"
            value={ev.running ? ev.kw.toFixed(1) : DASH}
            unit={ev.running ? "kW" : undefined}
            bar={ev.running ? { pct: (ev.kw / ev.ratedKw) * 100, color: FLOW.producing } : null}
            sub={ev.running ? `of ${ev.ratedKw.toFixed(1)} kW rated` : (ev.lastCharge ?? "Not charging")}
          />
          <EvTile label="Current" value={ev.running ? String(ev.amps) : DASH} unit={ev.running ? "A" : undefined} sub={ev.running ? `${ev.volts} V` : undefined} />
          <EvTile
            label="This charge"
            value={ev.running ? ev.sessionKwh.toFixed(1) : DASH}
            unit={ev.running ? "kWh" : undefined}
            bar={ev.running && ev.targetKwh ? { pct: (ev.sessionKwh / ev.targetKwh) * 100, color: FLOW.consuming } : null}
            sub={ev.running ? (ev.targetKwh ? `${Math.round((ev.sessionKwh / ev.targetKwh) * 100)}% of the ${ev.targetKwh} kWh target` : "No target set") : undefined}
          />
          <EvTile
            label="Time"
            value={ev.running ? hm(ev.elapsedMin) : DASH}
            sub={ev.running && ev.targetKwh && ev.kw > 0 ? `about ${hm(Math.max(0, Math.round(((ev.targetKwh - ev.sessionKwh) / ev.kw) * 60)))} left` : undefined}
          />
          <EvTile label="Powered by" value={ev.running ? String(top.pct) : DASH} unit={ev.running ? `% ${top.label.toLowerCase()}` : undefined} split={ev.running ? ev.shares : null} />
        </div>
      )}
      <GroupTitle>Today at this charger</GroupTitle>
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${mobile ? 2 : ev.earnings !== null ? 5 : 4}, minmax(0, 1fr))` }}>
        <EvTile label="Charges today" value={String(ev.sessionsToday)} sub={ev.sessionsToday > 0 ? `about ${(ev.deliveredToday / ev.sessionsToday).toFixed(1)} kWh each` : undefined} />
        <EvTile label="Energy delivered" value={ev.deliveredToday.toFixed(1)} unit="kWh" sub={`strongest ${ev.peakKw.toFixed(1)} kW`} />
        <EvTile label="Charging time" value={hm(ev.chargingMin)} sub={ev.sessionsToday > 0 ? `about ${hm(Math.round(ev.chargingMin / ev.sessionsToday))} each` : undefined} />
        <EvTile label="Average power" value={ev.chargingMin > 0 ? ((ev.deliveredToday / ev.chargingMin) * 60).toFixed(1) : DASH} unit={ev.chargingMin > 0 ? "kW" : undefined} sub={`of ${ev.ratedKw.toFixed(1)} kW rated`} />
        {ev.earnings !== null && <EvTile label="Earned today" value={`₹${ev.earnings.toLocaleString("en-IN")}`} sub={`at ₹${ev.tariff} per kWh`} />}
      </div>
      <GroupTitle>Charging</GroupTitle>
      <TrendChart title="Charging power" unit="kW" points={ev.series} color={FLOW.producing} dayStart={dayStart} now={now} tall labelEvery={mobile ? 4 : 1} />
      <div className="rounded-2xl border bg-card px-5 py-4 shadow-xs">
        <p className="text-[0.85rem] font-semibold text-foreground">Today&apos;s charges</p>
        {ev.charges.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No charge today yet.</p>
        ) : (
          <ul className="mt-2 divide-y">
            {ev.charges.map((c) => (
              <li key={c.start} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="tabular-nums text-foreground">{c.start}</span>
                <span className="tabular-nums text-muted-foreground">{c.kwh.toFixed(1)} kWh</span>
                <span className={cn("text-xs font-medium", c.running ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>{c.running ? "Charging" : "Finished"}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------ the page

/** `locked` shows the page at its first screen only: no scrolling inside it (the rest is simply cut off). The tabs, the menus and the charts still respond. */
export function DemoMonitoring({ locked = false, mobile = false, initial }: { locked?: boolean; /** The phone layout: two cards across, one chart across, the devices in one menu. */ mobile?: boolean; initial?: DemoInitial } = {}) {
  const [nowMs, setNowMs] = useNow();
  const data: DemoData = React.useMemo(() => buildSampleData(nowMs), [nowMs]);
  const [siteId, setSiteId] = React.useState(initial?.site ?? SAMPLE_SITES[0].id);
  const site = SAMPLE_SITES.find((s) => s.id === siteId) ?? SAMPLE_SITES[0];
  const [tabBySite, setTabBySite] = React.useState<Record<string, string>>(initial?.tab ? { [initial.site ?? SAMPLE_SITES[0].id]: initial.tab } : {});
  const firstTab = site.devices[0].kind === "inverter" ? "hub" : site.devices[0].id;
  const tab = tabBySite[site.id] ?? firstTab;
  const setTab = (t: string) => setTabBySite((prev) => ({ ...prev, [site.id]: t }));
  const [panel, setPanel] = React.useState<PanelId | null>(initial?.panel ?? null);
  const [events, setEvents] = React.useState<Record<string, EvEvent[]>>({});

  // a click outside an open menu, or Escape, closes it
  React.useEffect(() => {
    if (!panel) return;
    const onDown = (e: PointerEvent) => {
      if (!(e.target as Element).closest("[data-demo-panel],[data-demo-trigger]")) setPanel(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPanel(null);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [panel]);

  const { live, dayStart, now } = data;
  const L = (k: string) => live[k] ?? null;
  const chargerDevices = React.useMemo(() => site.devices.filter((d) => d.kind === "charger"), [site]);
  const chargers = React.useMemo(() => Object.fromEntries(chargerDevices.map((d) => [d.id, buildCharger(d, nowMs, events[d.id])])) as Record<string, EvSample>, [chargerDevices, nowMs, events]);
  const hasInverter = site.devices.some((d) => d.kind === "inverter");

  /** Start or stop the demo's own charge (nothing is sent to any charger). */
  const toggleCharge = (d: SampleDevice) => {
    const t = Date.now();
    const hour = istDay(t).hour;
    const running = chargers[d.id]?.running;
    const window = (d.windows ?? []).findIndex(([from, to]) => hour >= from && hour <= to);
    setEvents((prev) => ({ ...prev, [d.id]: [...(prev[d.id] ?? []), { mode: running ? "stop" : "start", at: hour, window: running ? window : -1 }] }));
    setNowMs(t); // the figures are read again at this moment, so the change shows at once
  };

  const series = (key: string, scale = 1): SeriesPoint[] => (data.series[key] ?? []).map(([t, v]) => [t, v * scale]);
  const sum = (keys: string[], scale = 1): SeriesPoint[] => {
    const by = new Map<number, number>();
    for (const k of keys) for (const [t, v] of data.series[k] ?? []) by.set(t, (by.get(t) ?? 0) + v);
    return ([...by.entries()].sort((a, b) => a[0] - b[0]) as SeriesPoint[]).map(([t, v]) => [t, v * scale]);
  };

  const chart = (title: string, unit: string, points: SeriesPoint[], color: string, opts: { digits?: number; legend?: { color: string; label: string }[]; tall?: boolean; labelEvery?: number } = {}) => (
    <TrendChart title={title} unit={unit} points={points} color={color} dayStart={dayStart} now={now} {...opts} labelEvery={mobile ? 4 : opts.labelEvery} />
  );

  const solarW = (L("pv1_power_w") ?? 0) + (L("pv2_power_w") ?? 0);
  const gridW = L("grid_total_power_w");
  const battW = L("battery_power_w");
  const hottest = Math.max(L("inverter_dc_temperature_c") ?? -Infinity, L("inverter_ac_temperature_c") ?? -Infinity);
  const flowWord = (w: number | null, pos: string, neg: string) => (w === null ? "" : w > 0 ? pos : w < 0 ? neg : "Idle");

  const inverterHeadlines: Record<InverterTab, { value: string; label: string }> = {
    hub: { value: `${kw(L("inverter_output_power_w"))} kW`, label: "Output Power" },
    solar: { value: `${fixed(L("day_pv_energy_kwh"))} kWh`, label: "Power Generated" },
    battery: { value: L("battery_soc_pct") === null ? DASH : `${Math.round(L("battery_soc_pct") as number)}%`, label: "Battery Level" },
    load: { value: `${fixed(L("day_load_energy_kwh"))} kWh`, label: "Consumed Today" },
    grid: { value: `${fixed(L("day_grid_import_energy_kwh"))} kWh`, label: "Imported Today" },
  };
  const activeCharger = chargerDevices.find((d) => d.id === tab);
  const activeEv = activeCharger ? chargers[activeCharger.id] : null;
  const headline = activeEv ? { value: `${activeEv.deliveredToday.toFixed(1)} kWh`, label: "Delivered Today" } : inverterHeadlines[tab in inverterHeadlines ? (tab as InverterTab) : "hub"];

  const cards = mobile ? "grid grid-cols-2 gap-3" : "grid grid-cols-4 gap-3";
  const row2 = mobile ? "grid grid-cols-1 gap-3" : "grid grid-cols-2 gap-3";

  return (
    <div className="relative flex h-full w-full flex-col bg-background text-foreground">
      <DemoHeader
        site={site}
        sites={SAMPLE_SITES}
        panel={panel}
        setPanel={setPanel}
        onSite={setSiteId}
        nowMs={nowMs}
        at={data.at}
        onDevice={(d) => setTab(d.kind === "inverter" ? "hub" : d.id)}
        activeDeviceId={activeCharger ? activeCharger.id : hasInverter ? "inverter" : null}
        chargers={chargers}
        mobile={mobile}
        initialAlert={initial?.alert}
      />

      <main className={cn("min-h-0 flex-1 pb-6 pt-1", mobile ? "px-4" : "px-6", locked ? "overflow-clip" : "overflow-y-auto [scrollbar-width:thin]")}>
        <Tabs value={tab} onValueChange={setTab}>
          <TabHeadlineBar
            tabValue={activeCharger ? "ev" : tab}
            headline={headline}
            actions={
              activeCharger && activeEv ? (
                <button
                  type="button"
                  onClick={() => toggleCharge(activeCharger)}
                  title="In this demo nothing is sent to a charger"
                  className={cn(
                    "inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-md border px-3.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
                    activeEv.running ? "bg-card text-foreground hover:bg-accent/60" : "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-500",
                  )}
                >
                  <Zap className="size-3.5" />
                  {activeEv.running ? "Stop charging" : "Start charging"}
                </button>
              ) : undefined
            }
          />
          <TabsList variant="line" className={mobile ? "w-full justify-start overflow-x-auto [scrollbar-width:none]" : undefined}>
            {hasInverter &&
              INVERTER_TABS.map(({ id, label, icon: Icon, active }) => (
                <TabsTrigger key={id} value={id} variant="line" className={active}>
                  <Icon className="size-4 shrink-0 group-data-[state=active]:hidden" />
                  <span className="text-sm font-medium">{label}</span>
                </TabsTrigger>
              ))}
            {chargerDevices.map((d) => (
              <TabsTrigger key={d.id} value={d.id} variant="line" className={CHARGER_TAB_CLASS}>
                <EvCharger className="size-4 shrink-0 group-data-[state=active]:hidden" />
                <span className="text-sm font-medium">{tabName(d)}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {hasInverter && (
            <>
              <TabsContent value="hub" className="mt-3 space-y-3">
                <div className={cards}>
                  <LiveStatusCard icon={Sun} title="Output Power" subtitle="Inverter output power" value={`${kw(L("inverter_output_power_w"))} kW`} statusLabel="Status" badgeLabel="Live" compact />
                  <LiveStatusCard icon={Gauge} title="Electrical" subtitle={`Current · ${fixed(L("inverter_l1_current_a"), 2)} A`} value={`${fixed(L("inverter_l1_voltage_v"))} V`} statusLabel="Frequency" badgeLabel={`${fixed(L("inverter_output_frequency_hz"), 2)} Hz`} compact />
                  <LiveStatusCard icon={Zap} title="AC Output" subtitle="Energy today" value={`${fixed(L("day_active_energy_kwh"))} kWh`} statusLabel="Status" badgeLabel="Today" compact />
                  <LiveStatusCard icon={Thermometer} title="Temperature" subtitle="Hottest · Heat-sink Temperature (DC)" value={Number.isFinite(hottest) ? `${hottest.toFixed(1)} °C` : DASH} statusLabel="Status" badgeLabel="Normal" badgeTone="good" compact />
                </div>
                <GroupTitle>Power Flows</GroupTitle>
                {chart("Inverter output power", "kW", series("inverter_output_power_w", 0.001), FLOW.producing, { tall: true, labelEvery: 1 })}
                <div className={row2}>
                  {chart("Solar power", "kW", sum(["pv1_power_w", "pv2_power_w"], 0.001), FLOW.producing)}
                  {chart("Load power", "kW", series("load_total_power_w", 0.001), FLOW.consuming)}
                  {chart("Grid power", "kW", series("grid_total_power_w", 0.001), FLOW.drawing)}
                  {chart("Battery power", "kW", series("battery_power_w", 0.001), FLOW.producing)}
                </div>
              </TabsContent>

              <TabsContent value="solar" className="mt-3 space-y-3">
                <div className={cards}>
                  <LiveStatusCard icon={Sun} title="Live Output" subtitle="Current power" value={`${kw(solarW)} kW`} statusLabel="Status" badgeLabel="Live" compact />
                  <LiveStatusCard icon={Zap} title="Generated Today" subtitle="So far today" value={`${fixed(L("day_pv_energy_kwh"))} kWh`} statusLabel="Status" badgeLabel="Today" compact />
                  <LiveStatusCard icon={Sun} title="PV1" subtitle={`${fixed(L("pv1_voltage_v"))} V · ${fixed(L("pv1_current_a"), 2)} A`} value={`${kw(L("pv1_power_w"))} kW`} statusLabel="Status" badgeLabel="Live" compact />
                  <LiveStatusCard icon={Sun} title="PV2" subtitle={`${fixed(L("pv2_voltage_v"))} V · ${fixed(L("pv2_current_a"), 2)} A`} value={`${kw(L("pv2_power_w"))} kW`} statusLabel="Status" badgeLabel="Live" compact />
                </div>
                <GroupTitle>Solar Power</GroupTitle>
                {chart("Solar power", "kW", sum(["pv1_power_w", "pv2_power_w"], 0.001), FLOW.producing, { tall: true, labelEvery: 1 })}
                <div className={row2}>
                  {chart("PV1 power", "kW", series("pv1_power_w", 0.001), PV_SHADES[0])}
                  {chart("PV2 power", "kW", series("pv2_power_w", 0.001), PV_SHADES[1])}
                </div>
              </TabsContent>

              <TabsContent value="battery" className="mt-3 space-y-3">
                <div className={cards}>
                  <LiveStatusCard icon={BatteryCharging} title="Battery Level" subtitle="State of charge" value={L("battery_soc_pct") === null ? DASH : `${Math.round(L("battery_soc_pct") as number)}%`} statusLabel="Temperature" badgeLabel={`${fixed(L("battery_temperature_c"))} °C`} compact />
                  <LiveStatusCard icon={Zap} title="Battery Power" subtitle={`${fixed(L("battery_voltage_v"), 2)} V · ${fixed(L("battery_current_a"), 2)} A`} value={`${kw(battW === null ? null : Math.abs(battW))} kW`} statusLabel="Status" badgeLabel={flowWord(battW, "Charging", "Discharging")} badgeTone={battW !== null && battW > 0 ? "good" : battW !== null && battW < 0 ? "warn" : "neutral"} compact />
                  <LiveStatusCard icon={Zap} title="Charged Today" subtitle="Into the battery" value={`${fixed(L("day_battery_charge_energy_kwh"))} kWh`} statusLabel="Status" badgeLabel="Today" compact />
                  <LiveStatusCard icon={Zap} title="Discharged Today" subtitle="Out of the battery" value={`${fixed(L("day_battery_discharge_energy_kwh"))} kWh`} statusLabel="Status" badgeLabel="Today" compact />
                </div>
                <GroupTitle>Battery</GroupTitle>
                {chart("Battery SOC Trend", "%", series("battery_soc_pct"), FLOW.producing, { tall: true, digits: 1, labelEvery: 1 })}
                <div className={row2}>
                  {chart("Charged today", "kWh", series("day_battery_charge_energy_kwh"), FLOW.producing)}
                  {chart("Discharged today", "kWh", series("day_battery_discharge_energy_kwh"), FLOW.drawing)}
                </div>
              </TabsContent>

              <TabsContent value="load" className="mt-3 space-y-3">
                <div className={cards}>
                  <LiveStatusCard icon={Home} title="Live Draw" subtitle="Current draw" value={`${kw(L("load_total_power_w"))} kW`} statusLabel="Status" badgeLabel="Live" compact />
                  <LiveStatusCard icon={Zap} title="Consumed Today" subtitle="So far today" value={`${fixed(L("day_load_energy_kwh"))} kWh`} statusLabel="Status" badgeLabel="Today" compact />
                  <LiveStatusCard icon={Zap} title="L1 Power" subtitle="Phase L1" value={`${fixed(L("load_l1_power_w"), 0)} W`} statusLabel="Status" badgeLabel="Live" compact />
                  <LiveStatusCard icon={Gauge} title="Electrical" subtitle={`Current · ${fixed(L("load_l1_current_a"), 2)} A`} value={`${fixed(L("load_l1_voltage_v"))} V`} statusLabel="Frequency" badgeLabel={`${fixed(L("load_frequency_hz"), 2)} Hz`} compact />
                </div>
                <GroupTitle>Load</GroupTitle>
                {chart("Load Power", "kW", series("load_total_power_w", 0.001), FLOW.consuming, { tall: true, labelEvery: 1 })}
                <div className={row2}>
                  {chart("Consumed today", "kWh", series("day_load_energy_kwh"), FLOW.consuming)}
                  {chart("Load current", "A", series("load_l1_current_a"), "#8b5cf6")}
                </div>
              </TabsContent>

              <TabsContent value="grid" className="mt-3 space-y-3">
                <div className={cards}>
                  <LiveStatusCard icon={Zap} title="Live Flow" subtitle={flowWord(gridW, "Importing", "Exporting") || "Grid power"} value={`${kw(gridW === null ? null : Math.abs(gridW))} kW`} statusLabel="Status" badgeLabel={flowWord(gridW, "Importing", "Exporting")} badgeTone={gridW !== null && gridW > 0 ? "warn" : "neutral"} compact />
                  <LiveStatusCard icon={Zap} title="Energy Today" subtitle="Imported / Exported" value={`${fixed(L("day_grid_import_energy_kwh"))} / ${fixed(L("day_grid_export_energy_kwh"))} kWh`} statusLabel="Status" badgeLabel="Today" compact />
                  <LiveStatusCard icon={Gauge} title="Electrical" subtitle={`Current · ${fixed(L("grid_l1_current_a"), 2)} A`} value={`${fixed(L("grid_l1_voltage_v"))} V`} statusLabel="Frequency" badgeLabel={`${fixed(L("grid_frequency_hz"), 2)} Hz`} compact />
                  <LiveStatusCard icon={Zap} title="CT Meter" subtitle={`Current · ${fixed(L("grid_ct_l1_current_a"), 2)} A`} value={`${kw(L("grid_ct_total_power_w"))} kW`} statusLabel="CT power" badgeLabel={`${fixed(L("grid_ct_total_power_w"), 0)} W`} compact />
                </div>
                <GroupTitle>Grid</GroupTitle>
                {chart("Grid Power", "kW", series("grid_total_power_w", 0.001), FLOW.drawing, { tall: true, labelEvery: 1, legend: [{ color: FLOW.drawing, label: "Importing" }, { color: FLOW.consuming, label: "Exporting" }] })}
                <div className={row2}>
                  {chart("Imported today", "kWh", series("day_grid_import_energy_kwh"), FLOW.drawing)}
                  {chart("Exported today", "kWh", series("day_grid_export_energy_kwh"), FLOW.consuming)}
                </div>
              </TabsContent>
            </>
          )}

          {chargerDevices.map((d) => (
            <TabsContent key={d.id} value={d.id}>
              <ChargerPage ev={chargers[d.id]} dayStart={dayStart} now={now} mobile={mobile} />
            </TabsContent>
          ))}
        </Tabs>
      </main>
    </div>
  );
}
