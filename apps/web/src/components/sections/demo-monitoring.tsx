"use client";

import * as React from "react";
import Image from "next/image";
import { Area, AreaChart, XAxis, YAxis } from "recharts";
import { BatteryCharging, Gauge, Home, PanelLeft, Server, Sun, Thermometer, Zap } from "lucide-react";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LiveStatusCard } from "@/components/dashboard/live-status-card";
import { TabHeadlineBar } from "@/components/dashboard/monitoring-tabs";
import { NAV_ITEMS } from "@/components/dashboard/nav-config";
import { FLOW, PV_SHADES } from "@/components/dashboard/flow-colors";
import { cn } from "@/lib/utils";
import type { LandingSnapshot } from "@/lib/landing-live";

// The customer's Monitoring page, as a small read-only copy for the landing page: the same cards, tabs, headline and chart look, fed by
// the Waytara Office's live figures. Only the tabs and the sidebar button respond; nothing here links anywhere.

export const DEMO_WIDTH = 1180;
export const DEMO_HEIGHT = 737;

const IST_MS = 19_800_000;
const HOUR_MS = 3_600_000;

type Point = { t: number; v: number | null };
type TabId = "hub" | "solar" | "battery" | "load" | "grid";

const TABS: { id: TabId; label: string; icon: typeof Sun; active: string }[] = [
  { id: "hub", label: "Main Hub", icon: Server, active: "data-[state=active]:border-primary data-[state=active]:text-primary" },
  { id: "solar", label: "Solar Array", icon: Sun, active: "data-[state=active]:border-amber-500 data-[state=active]:text-amber-600 dark:data-[state=active]:text-amber-400" },
  { id: "battery", label: "Battery Pack", icon: BatteryCharging, active: "data-[state=active]:border-emerald-500 data-[state=active]:text-emerald-600 dark:data-[state=active]:text-emerald-400" },
  { id: "load", label: "Load", icon: Home, active: "data-[state=active]:border-sky-500 data-[state=active]:text-sky-600 dark:data-[state=active]:text-sky-400" },
  { id: "grid", label: "Grid Interface", icon: Zap, active: "data-[state=active]:border-violet-500 data-[state=active]:text-violet-600 dark:data-[state=active]:text-violet-400" },
];

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

/** One small trend card: title, the newest value with its time, and today's curve. */
function TrendCard({
  title,
  unit,
  digits = 2,
  points,
  color,
  dayStart,
  now,
  legend,
  tall = false,
}: {
  title: string;
  unit: string;
  digits?: number;
  points: Point[];
  color: string;
  dayStart: number;
  now: number;
  legend?: { color: string; label: string }[];
  tall?: boolean;
}) {
  const uid = React.useId().replace(/[^a-zA-Z0-9]/g, "");
  const shown = points.filter((p) => p.v !== null && p.t <= now);
  const last = shown[shown.length - 1];
  const config = { v: { label: title, color } } satisfies ChartConfig;
  const ticks = [0, 3, 6, 9, 12, 15, 18, 21].map((h) => dayStart + h * HOUR_MS);
  return (
    <div className="rounded-xl border bg-card px-4 pb-2 pt-3 shadow-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[0.8rem] font-semibold text-foreground">{title}</p>
          <p className="mt-0.5 flex items-baseline gap-1 tabular-nums">
            <span className="text-xl font-bold leading-none text-foreground">{last ? (last.v as number).toFixed(digits) : DASH}</span>
            <span className="text-xs text-muted-foreground">{unit}</span>
          </p>
          <p className="mt-0.5 text-[0.65rem] text-muted-foreground">{last ? clock(last.t) : "Waiting for readings"}</p>
        </div>
        {legend && (
          <div className="flex shrink-0 gap-2.5 pt-0.5 text-[0.62rem] text-muted-foreground">
            {legend.map((l) => (
              <span key={l.label} className="flex items-center gap-1">
                <span className="size-1.5 rounded-[2px]" style={{ backgroundColor: l.color }} />
                {l.label}
              </span>
            ))}
          </div>
        )}
      </div>
      <ChartContainer config={config} className={cn("pointer-events-none mt-1 w-full", tall ? "h-[88px]" : "h-[64px]")}>
        <AreaChart data={shown} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
          <defs>
            <linearGradient id={`g${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.4} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis dataKey="t" type="number" scale="time" domain={[dayStart, dayStart + 24 * HOUR_MS]} ticks={ticks} tickFormatter={(t) => hourLabel(t as number, dayStart)} tickLine={false} axisLine={false} tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} height={16} interval={0} />
          <YAxis hide domain={["auto", "auto"]} />
          <Area dataKey="v" type="monotone" stroke={color} strokeWidth={1.6} fill={`url(#g${uid})`} isAnimationActive={false} dot={false} connectNulls />
        </AreaChart>
      </ChartContainer>
    </div>
  );
}

/** The sidebar: the same pages as the real dashboard (Monitoring is the open one), but nothing here is clickable. */
function MiniSidebar({ open }: { open: boolean }) {
  return (
    <aside className={cn("flex shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground transition-[width] duration-300 ease-out", open ? "w-[208px]" : "w-[58px]")}>
      <div className={cn("flex h-14 items-center", open ? "px-4" : "justify-center")}>
        {open ? <Image src="/images/logo.png" alt="WayTara" width={110} height={30} unoptimized className="h-6 w-auto object-contain" /> : <Image src="/images/icon.png" alt="WayTara" width={24} height={24} unoptimized className="size-6 object-contain" />}
      </div>
      <nav className="mt-2 flex flex-col gap-1 px-2">
        {NAV_ITEMS.map(({ label, icon: Icon }) => {
          const on = label === "Monitoring";
          return (
            <div
              key={label}
              className={cn("flex h-9 items-center gap-3 rounded-md text-[13px] font-medium", open ? "px-3" : "justify-center", on ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/75")}
              title={open ? undefined : label}
            >
              <Icon className="size-4 shrink-0" />
              {open && <span className="truncate">{label}</span>}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

export function DemoMonitoring({ data }: { data: LandingSnapshot | null }) {
  const [tab, setTab] = React.useState<TabId>("solar");
  const [sidebarOpen, setSidebarOpen] = React.useState(true);

  const live = data?.live ?? {};
  const dayStart = data?.dayStart ?? 0;
  const now = data?.now ?? 0;
  const L = (k: string) => (live[k] ?? null) as number | null;

  const pts = (key: string, scale = 1): Point[] => (data?.series[key] ?? []).map(([t, v]) => ({ t, v: v === null ? null : v * scale }));
  const sumPts = (keys: string[], scale = 1): Point[] => {
    const by = new Map<number, number>();
    for (const k of keys) for (const [t, v] of data?.series[k] ?? []) if (v !== null) by.set(t, (by.get(t) ?? 0) + v);
    return [...by.entries()].sort((a, b) => a[0] - b[0]).map(([t, v]) => ({ t, v: v * scale }));
  };

  const trend = (title: string, unit: string, points: Point[], color: string, opts: { digits?: number; legend?: { color: string; label: string }[]; tall?: boolean } = {}) => (
    <TrendCard title={title} unit={unit} points={points} color={color} dayStart={dayStart} now={now} {...opts} />
  );

  const solarW = L("pv1_power_w") === null && L("pv2_power_w") === null ? null : (L("pv1_power_w") ?? 0) + (L("pv2_power_w") ?? 0);
  const gridW = L("grid_total_power_w");
  const battW = L("battery_power_w");
  const hottest = Math.max(L("inverter_dc_temperature_c") ?? -Infinity, L("inverter_ac_temperature_c") ?? -Infinity);
  const flowWord = (w: number | null, pos: string, neg: string) => (w === null ? "" : w > 0 ? pos : w < 0 ? neg : "Idle");

  const headlines: Record<TabId, { value: string; label: string }> = {
    hub: { value: `${kw(L("inverter_output_power_w"))} kW`, label: "Output Power" },
    solar: { value: `${fixed(L("day_pv_energy_kwh"))} kWh`, label: "Power Generated" },
    battery: { value: L("battery_soc_pct") === null ? DASH : `${Math.round(L("battery_soc_pct") as number)}%`, label: "Battery Level" },
    load: { value: `${fixed(L("day_load_energy_kwh"))} kWh`, label: "Consumed Today" },
    grid: { value: `${fixed(L("day_grid_import_energy_kwh"))} kWh`, label: "Imported Today" },
  };

  const cards = "grid grid-cols-4 gap-3";
  const row2 = "grid grid-cols-2 gap-3";

  return (
    <div className="flex h-full w-full select-none bg-background text-foreground">
      <MiniSidebar open={sidebarOpen} />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* the top bar: the sidebar button (works), the site, and when the figures were last stored */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b px-5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen((o) => !o)}
              aria-label={sidebarOpen ? "Close the sidebar" : "Open the sidebar"}
              aria-expanded={sidebarOpen}
              className="flex size-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              <PanelLeft className="size-[18px]" />
            </button>
            <span className="text-sm font-semibold">{data?.site ?? "Waytara Office"}</span>
          </div>
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full rounded-full bg-emerald-400 opacity-60 motion-safe:animate-ping" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            {data ? <>Live · {data.at ? `last reading ${clock(data.at)}` : "waiting for readings"}</> : "Connecting…"}
          </span>
        </header>

        <main className="min-h-0 flex-1 overflow-hidden px-6 pt-4">
          <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)}>
            <TabHeadlineBar tabValue={tab} headline={headlines[tab]} />
            <TabsList variant="line">
              {TABS.map(({ id, label, icon: Icon, active }) => (
                <TabsTrigger key={id} value={id} variant="line" className={active}>
                  <Icon className="size-4 shrink-0 group-data-[state=active]:hidden" />
                  <span className="text-sm font-medium">{label}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="hub" className="mt-3 space-y-3">
              <div className={cards}>
                <LiveStatusCard icon={Sun} title="Output Power" subtitle="Inverter output power" value={`${kw(L("inverter_output_power_w"))} kW`} statusLabel="Status" badgeLabel="Live" compact />
                <LiveStatusCard icon={Gauge} title="Electrical" subtitle={`Current · ${fixed(L("inverter_l1_current_a"), 2)} A`} value={`${fixed(L("inverter_l1_voltage_v"))} V`} statusLabel="Frequency" badgeLabel={`${fixed(L("inverter_output_frequency_hz"), 2)} Hz`} compact />
                <LiveStatusCard icon={Zap} title="AC Output" subtitle="Energy today" value={`${fixed(L("day_active_energy_kwh"))} kWh`} statusLabel="Status" badgeLabel="Today" compact />
                <LiveStatusCard icon={Thermometer} title="Temperature" subtitle="Hottest · Heat-sink" value={Number.isFinite(hottest) ? `${hottest.toFixed(1)} °C` : DASH} statusLabel="Status" badgeLabel="Normal" badgeTone="good" compact />
              </div>
              {trend("Inverter output power", "kW", pts("inverter_output_power_w", 0.001), FLOW.producing, { tall: true })}
              <div className="grid grid-cols-4 gap-3">
                {trend("Solar power", "kW", sumPts(["pv1_power_w", "pv2_power_w"], 0.001), FLOW.producing)}
                {trend("Load power", "kW", pts("load_total_power_w", 0.001), FLOW.consuming)}
                {trend("Grid power", "kW", pts("grid_total_power_w", 0.001), FLOW.drawing)}
                {trend("Battery power", "kW", pts("battery_power_w", 0.001), FLOW.producing)}
              </div>
            </TabsContent>

            <TabsContent value="solar" className="mt-3 space-y-3">
              <div className={cards}>
                <LiveStatusCard icon={Sun} title="Live Output" subtitle="Current power" value={`${kw(solarW)} kW`} statusLabel="Status" badgeLabel="Live" compact />
                <LiveStatusCard icon={Zap} title="Generated Today" subtitle="So far today" value={`${fixed(L("day_pv_energy_kwh"))} kWh`} statusLabel="Status" badgeLabel="Today" compact />
                <LiveStatusCard icon={Sun} title="PV1" subtitle={`${fixed(L("pv1_voltage_v"))} V · ${fixed(L("pv1_current_a"), 2)} A`} value={`${kw(L("pv1_power_w"))} kW`} statusLabel="Status" badgeLabel="Live" compact />
                <LiveStatusCard icon={Sun} title="PV2" subtitle={`${fixed(L("pv2_voltage_v"))} V · ${fixed(L("pv2_current_a"), 2)} A`} value={`${kw(L("pv2_power_w"))} kW`} statusLabel="Status" badgeLabel="Live" compact />
              </div>
              <p className="pt-1 text-[0.8rem] font-semibold text-foreground">Solar Power</p>
              {trend("Solar power", "kW", sumPts(["pv1_power_w", "pv2_power_w"], 0.001), FLOW.producing, { tall: true })}
              <div className={row2}>
                {trend("PV1 power", "kW", pts("pv1_power_w", 0.001), PV_SHADES[0])}
                {trend("PV2 power", "kW", pts("pv2_power_w", 0.001), PV_SHADES[1])}
              </div>
            </TabsContent>

            <TabsContent value="battery" className="mt-3 space-y-3">
              <div className={cards}>
                <LiveStatusCard icon={BatteryCharging} title="Battery Level" subtitle="State of charge" value={L("battery_soc_pct") === null ? DASH : `${Math.round(L("battery_soc_pct") as number)}%`} statusLabel="Temperature" badgeLabel={`${fixed(L("battery_temperature_c"))} °C`} compact />
                <LiveStatusCard icon={Zap} title="Battery Power" subtitle={`${fixed(L("battery_voltage_v"), 2)} V · ${fixed(L("battery_current_a"), 2)} A`} value={`${kw(battW === null ? null : Math.abs(battW))} kW`} statusLabel="Status" badgeLabel={flowWord(battW, "Charging", "Discharging")} badgeTone={battW !== null && battW > 0 ? "good" : battW !== null && battW < 0 ? "warn" : "neutral"} compact />
                <LiveStatusCard icon={Zap} title="Charged Today" subtitle="Into the battery" value={`${fixed(L("day_battery_charge_energy_kwh"))} kWh`} statusLabel="Status" badgeLabel="Today" compact />
                <LiveStatusCard icon={Zap} title="Discharged Today" subtitle="Out of the battery" value={`${fixed(L("day_battery_discharge_energy_kwh"))} kWh`} statusLabel="Status" badgeLabel="Today" compact />
              </div>
              {trend("Battery SOC Trend", "%", pts("battery_soc_pct"), FLOW.producing, { tall: true })}
              <div className={row2}>
                {trend("Charged today", "kWh", pts("day_battery_charge_energy_kwh"), FLOW.producing)}
                {trend("Discharged today", "kWh", pts("day_battery_discharge_energy_kwh"), FLOW.drawing)}
              </div>
            </TabsContent>

            <TabsContent value="load" className="mt-3 space-y-3">
              <div className={cards}>
                <LiveStatusCard icon={Home} title="Live Draw" subtitle="Current draw" value={`${kw(L("load_total_power_w"))} kW`} statusLabel="Status" badgeLabel="Live" compact />
                <LiveStatusCard icon={Zap} title="Consumed Today" subtitle="So far today" value={`${fixed(L("day_load_energy_kwh"))} kWh`} statusLabel="Status" badgeLabel="Today" compact />
                <LiveStatusCard icon={Zap} title="L1 Power" subtitle="Phase L1" value={`${fixed(L("load_l1_power_w"), 0)} W`} statusLabel="Status" badgeLabel="Live" compact />
                <LiveStatusCard icon={Gauge} title="Electrical" subtitle={`Current · ${fixed(L("load_l1_current_a"), 2)} A`} value={`${fixed(L("load_l1_voltage_v"))} V`} statusLabel="Frequency" badgeLabel={`${fixed(L("load_frequency_hz"), 2)} Hz`} compact />
              </div>
              {trend("Load Power", "kW", pts("load_total_power_w", 0.001), FLOW.consuming, { tall: true })}
              <div className={row2}>
                {trend("Consumed today", "kWh", pts("day_load_energy_kwh"), FLOW.consuming)}
                {trend("Load current", "A", pts("load_l1_current_a"), "#8b5cf6")}
              </div>
            </TabsContent>

            <TabsContent value="grid" className="mt-3 space-y-3">
              <div className={cards}>
                <LiveStatusCard icon={Zap} title="Live Flow" subtitle={flowWord(gridW, "Importing", "Exporting") || "Grid power"} value={`${kw(gridW === null ? null : Math.abs(gridW))} kW`} statusLabel="Status" badgeLabel={flowWord(gridW, "Importing", "Exporting")} badgeTone={gridW !== null && gridW > 0 ? "warn" : "neutral"} compact />
                <LiveStatusCard icon={Zap} title="Energy Today" subtitle="Imported / Exported" value={`${fixed(L("day_grid_import_energy_kwh"))} / ${fixed(L("day_grid_export_energy_kwh"))} kWh`} statusLabel="Status" badgeLabel="Today" compact />
                <LiveStatusCard icon={Gauge} title="Electrical" subtitle={`Current · ${fixed(L("grid_l1_current_a"), 2)} A`} value={`${fixed(L("grid_l1_voltage_v"))} V`} statusLabel="Frequency" badgeLabel={`${fixed(L("grid_frequency_hz"), 2)} Hz`} compact />
                <LiveStatusCard icon={Zap} title="CT Meter" subtitle={`Current · ${fixed(L("grid_ct_l1_current_a"), 2)} A`} value={`${kw(L("grid_ct_total_power_w"))} kW`} statusLabel="CT power" badgeLabel={`${fixed(L("grid_ct_total_power_w"), 0)} W`} compact />
              </div>
              {trend("Grid Power", "kW", pts("grid_total_power_w", 0.001), FLOW.drawing, { tall: true, legend: [{ color: FLOW.drawing, label: "Importing" }, { color: FLOW.consuming, label: "Exporting" }] })}
              <div className={row2}>
                {trend("Imported today", "kWh", pts("day_grid_import_energy_kwh"), FLOW.drawing)}
                {trend("Exported today", "kWh", pts("day_grid_export_energy_kwh"), FLOW.consuming)}
              </div>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}
