"use client";

import * as React from "react";
import Image from "next/image";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Bell, BatteryCharging, Check, ChevronDown, ChevronsUpDown, CloudRain, Gauge, Home, Server, SlidersHorizontal, Sun, Thermometer, Zap } from "lucide-react";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LiveStatusCard } from "@/components/dashboard/live-status-card";
import { TabHeadlineBar } from "@/components/dashboard/monitoring-tabs";
import { CHART_CURSOR } from "@/components/dashboard/chart-cursor";
import { FLOW, PV_SHADES } from "@/components/dashboard/flow-colors";
import { INTERVAL_OPTIONS } from "@/lib/day-buckets";
import { bucketSeries, buildSampleData, SAMPLE_DEVICE, type DemoData, type SeriesPoint } from "@/lib/landing-sample";
import { cn } from "@/lib/utils";

// The customer's Monitoring page, as a small copy for the landing page, running on sample figures (lib/landing-sample.ts): the same header,
// tabs, cards and charts as the real page. The tabs, the interval, the charts (hover them) and the device menu respond; the sidebar, the
// notification bell, the weather and the site switcher are for show, and the device menu has no Go live or Refresh.

export const DEMO_WIDTH = 1180;
export const DEMO_HEIGHT = 737;

const IST_MS = 19_800_000;
const HOUR_MS = 3_600_000;

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

/** Close a menu when the pointer goes down anywhere outside it, or on Escape. */
function useDismiss(open: boolean, close: () => void) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);
  return ref;
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

/** The interval picker above a group of charts (15 min to 2 hours): one choice for every chart on every tab. */
function IntervalHeader({ title, minutes, onChange }: { title: string; minutes: number; onChange: (minutes: number) => void }) {
  const [open, setOpen] = React.useState(false);
  const ref = useDismiss(open, React.useCallback(() => setOpen(false), []));
  const current = INTERVAL_OPTIONS.find((o) => o.minutes === minutes) ?? INTERVAL_OPTIONS[0];
  return (
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      <div ref={ref} className="relative">
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="flex h-8 w-[110px] cursor-pointer items-center justify-between gap-2 rounded-md border bg-background px-3 text-xs shadow-xs outline-none transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          {current.label}
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </button>
        {open && (
          <ul role="listbox" className="absolute right-0 top-9 z-30 w-[110px] rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
            {INTERVAL_OPTIONS.map((o) => (
              <li key={o.minutes}>
                <button
                  type="button"
                  role="option"
                  aria-selected={o.minutes === minutes}
                  onClick={() => {
                    onChange(o.minutes);
                    setOpen(false);
                  }}
                  className="flex w-full cursor-pointer items-center justify-between rounded-sm px-2 py-1.5 text-left text-xs outline-none hover:bg-accent focus-visible:bg-accent"
                >
                  {o.label}
                  {o.minutes === minutes && <Check className="size-3.5" />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** The device button in the header and its menu: which device this is and when it last reported. No Go live and no Refresh here. */
function DeviceMenu({ at }: { at: number }) {
  const [open, setOpen] = React.useState(false);
  const ref = useDismiss(open, React.useCallback(() => setOpen(false), []));
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Inverter: 1, online. Open the device menu."
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-8 min-w-8 cursor-pointer items-center justify-center rounded-md border px-2 text-emerald-500 outline-none transition-colors hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring/50",
          open ? "bg-accent/40" : "bg-card",
        )}
      >
        <Server className="size-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-30 w-[22rem] rounded-2xl border bg-popover text-popover-foreground shadow-lg">
          <div className="flex items-start gap-3 p-4">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-500/12 text-emerald-600">
              <Server className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold leading-5">{SAMPLE_DEVICE}</p>
              <p className="text-xs leading-snug text-muted-foreground">Inverter · Online · last reading 2 min ago</p>
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
              <span className="block">2 min ago</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/** The page header: the brand button and the site at the left; the weather, the device menu and the notification bell at the right. */
function DemoHeader({ site, at }: { site: string; at: number }) {
  return (
    <header className="relative z-20 flex h-14 shrink-0 items-center justify-between gap-3 bg-background px-4">
      <div className="flex min-w-0 items-center gap-2">
        <span className="grid size-9 shrink-0 place-items-center rounded-full border bg-card">
          <Image src="/images/icon.png" alt="" width={20} height={20} unoptimized className="size-5 object-contain opacity-60" />
        </span>
        <span className="flex h-8 min-w-0 items-center gap-1.5 px-2 text-sm font-medium text-foreground">
          <span className="truncate">{site}</span>
          <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="flex h-8 items-center gap-1.5 px-1 text-sm font-medium text-foreground">
          <CloudRain className="size-[18px] text-sky-500" strokeWidth={1.7} />
          <span className="tabular-nums">30°</span>
        </span>
        <DeviceMenu at={at} />
        <span className="relative grid size-9 place-items-center rounded-full border bg-card text-foreground" title="Notifications are part of the full dashboard">
          <Bell className="size-4" />
          <span className="absolute -right-1 -top-1 grid size-[18px] place-items-center rounded-full bg-red-500 text-[10px] font-semibold leading-none text-white">7</span>
        </span>
      </div>
    </header>
  );
}

export function DemoMonitoring() {
  const data: DemoData = React.useMemo(() => buildSampleData(), []);
  const [tab, setTab] = React.useState<TabId>("hub");
  const [interval, setInterval] = React.useState(15);

  const { live, dayStart, now } = data;
  const L = (k: string) => live[k] ?? null;

  const series = (key: string, scale = 1, mode: "avg" | "last" = "avg"): SeriesPoint[] =>
    bucketSeries(data.series[key] ?? [], interval, mode).map(([t, v]) => [t, v * scale]);
  const sum = (keys: string[], scale = 1): SeriesPoint[] => {
    const by = new Map<number, number>();
    for (const k of keys) for (const [t, v] of data.series[k] ?? []) by.set(t, (by.get(t) ?? 0) + v);
    const merged = [...by.entries()].sort((a, b) => a[0] - b[0]) as SeriesPoint[];
    return bucketSeries(merged, interval).map(([t, v]) => [t, v * scale]);
  };

  const chart = (title: string, unit: string, points: SeriesPoint[], color: string, opts: { digits?: number; legend?: { color: string; label: string }[]; tall?: boolean; labelEvery?: number } = {}) => (
    <TrendChart title={title} unit={unit} points={points} color={color} dayStart={dayStart} now={now} {...opts} />
  );

  const solarW = (L("pv1_power_w") ?? 0) + (L("pv2_power_w") ?? 0);
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
    <div className="flex h-full w-full flex-col bg-background text-foreground">
      <DemoHeader site={data.site} at={data.at} />

      <main className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-1 [scrollbar-width:thin]">
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
              <LiveStatusCard icon={Thermometer} title="Temperature" subtitle="Hottest · Heat-sink Temperature (DC)" value={Number.isFinite(hottest) ? `${hottest.toFixed(1)} °C` : DASH} statusLabel="Status" badgeLabel="Normal" badgeTone="good" compact />
            </div>
            <IntervalHeader title="Power Flows" minutes={interval} onChange={setInterval} />
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
            <IntervalHeader title="Solar Power" minutes={interval} onChange={setInterval} />
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
            <IntervalHeader title="Battery" minutes={interval} onChange={setInterval} />
            {chart("Battery SOC Trend", "%", series("battery_soc_pct"), FLOW.producing, { tall: true, digits: 1, labelEvery: 1 })}
            <div className={row2}>
              {chart("Charged today", "kWh", series("day_battery_charge_energy_kwh", 1, "last"), FLOW.producing)}
              {chart("Discharged today", "kWh", series("day_battery_discharge_energy_kwh", 1, "last"), FLOW.drawing)}
            </div>
          </TabsContent>

          <TabsContent value="load" className="mt-3 space-y-3">
            <div className={cards}>
              <LiveStatusCard icon={Home} title="Live Draw" subtitle="Current draw" value={`${kw(L("load_total_power_w"))} kW`} statusLabel="Status" badgeLabel="Live" compact />
              <LiveStatusCard icon={Zap} title="Consumed Today" subtitle="So far today" value={`${fixed(L("day_load_energy_kwh"))} kWh`} statusLabel="Status" badgeLabel="Today" compact />
              <LiveStatusCard icon={Zap} title="L1 Power" subtitle="Phase L1" value={`${fixed(L("load_l1_power_w"), 0)} W`} statusLabel="Status" badgeLabel="Live" compact />
              <LiveStatusCard icon={Gauge} title="Electrical" subtitle={`Current · ${fixed(L("load_l1_current_a"), 2)} A`} value={`${fixed(L("load_l1_voltage_v"))} V`} statusLabel="Frequency" badgeLabel={`${fixed(L("load_frequency_hz"), 2)} Hz`} compact />
            </div>
            <IntervalHeader title="Load" minutes={interval} onChange={setInterval} />
            {chart("Load Power", "kW", series("load_total_power_w", 0.001), FLOW.consuming, { tall: true, labelEvery: 1 })}
            <div className={row2}>
              {chart("Consumed today", "kWh", series("day_load_energy_kwh", 1, "last"), FLOW.consuming)}
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
            <IntervalHeader title="Grid" minutes={interval} onChange={setInterval} />
            {chart("Grid Power", "kW", series("grid_total_power_w", 0.001), FLOW.drawing, { tall: true, labelEvery: 1, legend: [{ color: FLOW.drawing, label: "Importing" }, { color: FLOW.consuming, label: "Exporting" }] })}
            <div className={row2}>
              {chart("Imported today", "kWh", series("day_grid_import_energy_kwh", 1, "last"), FLOW.drawing)}
              {chart("Exported today", "kWh", series("day_grid_export_energy_kwh", 1, "last"), FLOW.consuming)}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
