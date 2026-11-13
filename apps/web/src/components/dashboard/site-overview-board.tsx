"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, BatteryCharging, EvCharger, Home, Leaf, Server, Sun, Zap, type LucideIcon } from "lucide-react";
import { useUnits } from "@/components/units-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { useFitRows } from "@/hooks/use-fit-rows";
import { useSiteWeather } from "@/hooks/use-site-weather";
import { CONNECTION_LABEL, type ConnectionStatus } from "@/lib/device-state";
import { areaPoints, TODAY_COUNTER_KEYS as K } from "@/lib/energy-today";
import type { EnumOption } from "@/lib/enum-labels";
import { co2AvoidedKg } from "@/lib/environmental-impact";
import { chargeProgress, minutesText, type CarProfile } from "@/lib/ev-car";
import { getConnectorStatusLabel } from "@/lib/ev-charger-catalog";
import type { EvHistorySession } from "@/lib/ev-history";
import { EV_LIVE_KEYS } from "@/lib/ev-live-keys";
import type { OpenCharge } from "@/lib/ev-overview";
import { siteAgg } from "@/lib/overview-keys";
import { solarGenerationW } from "@/lib/solar-generation";
import { useLiveNumbers, type Agg } from "@/lib/telemetry/live-values";
import { useDeviceLive, useTodaySeries } from "@/lib/telemetry/react";
import { CONDITION_TEXT } from "@/lib/weather";
import { cn } from "@/lib/utils";
import { useDeviceHub } from "./device-live-hub";
import { FLOW } from "./flow-colors";
import { useOverviewTabs } from "./overview-tabs";
import { TodayAreaChart } from "./today-area-chart";
import { WEATHER_ICON, temp } from "./weather-ui";

/** The site's inverters, as the site's Overview needs them. */
export interface SiteBoardInverters {
  ids: string[];
  /** The first numbers, combined over the inverters (powers and day counters added, state of charge averaged): the live channel takes over. */
  initial: Record<string, number | null>;
  /** The PV power keys the inverters have (solar generation is their sum). */
  pvKeys: string[];
  hasBattery: boolean;
  hasGrid: boolean;
}

/** One of the site's chargers. */
export interface SiteBoardCharger {
  id: string;
  name: string;
  /** The charger answers through its unit, as the server saw it (null = no verdict yet). */
  connected: boolean | null;
  connectorOptions: EnumOption[];
  open: OpenCharge | null;
  initial: Record<string, number | null>;
  /** Energy of today's charges, kWh. */
  todayKwh: number | null;
  /** The last finished charge. */
  last: EvHistorySession | null;
  /** Charges and their energy over the last 30 days. */
  sessions30: number;
  kwh30: number;
}

/** A device in the site's list. */
export interface SiteBoardDevice {
  id: string;
  name: string;
  kind: "inverter" | "charger" | "other";
  /** What it is, in a few words (the model), or null. */
  model: string | null;
  /** Its connection as the server saw it (null = not known); the live channel takes over. */
  status: ConnectionStatus | null;
}

const agg = (k: string) => siteAgg(k) as Agg;
const NO_KEYS: string[] = [];
const IST_MS = 19_800_000;
const clockOf = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
const dayOf = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

const TONE = {
  solar: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  load: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  grid: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  battery: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  ev: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  green: "bg-green-500/15 text-green-600 dark:text-green-400",
  plain: "bg-muted text-foreground",
} as const;

// ---- the parts every widget is made of ------------------------------------------------------------------------------------------------

const SHELL = "group relative flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-border p-4 outline-none [@media(min-height:820px)]:lg:p-5";

/** A widget: a bordered tile in the Overview's card style. With `href` the whole tile is a link. */
function Widget({ href, label, className, children }: { href?: string; label?: string; className?: string; children: React.ReactNode }) {
  if (href) {
    return (
      <Link href={href} aria-label={label} data-widget className={cn(SHELL, "focus-visible:ring-2 focus-visible:ring-ring", className)}>
        {children}
      </Link>
    );
  }
  return (
    <div data-widget className={cn(SHELL, className)}>
      {children}
    </div>
  );
}

/** A widget's heading: a tinted icon, the title with a small note under it, and the round arrow (`href` makes the arrow itself a link, for a tile that is not one). */
function Head({ icon: Icon, tone, title, note, href, arrow = true }: { icon: LucideIcon; tone: string; title: string; note?: string | null; href?: string; arrow?: boolean }) {
  const round = "size-7 shrink-0 place-items-center max-md:hidden md:grid rounded-full bg-muted text-foreground transition-colors group-hover:bg-emerald-500 group-hover:text-white";
  return (
    <div className="flex items-center gap-2.5">
      <span className={cn("grid size-8 shrink-0 place-items-center rounded-xl", tone)}>
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate text-sm font-medium text-foreground">{title}</span>
        {note ? <span className="block truncate text-xs text-muted-foreground">{note}</span> : null}
      </span>
      {href ? (
        <Link href={href} aria-label={`Open ${title.toLowerCase()}`} className={cn(round, "relative z-10 outline-none hover:bg-emerald-500 hover:text-white focus-visible:ring-2 focus-visible:ring-ring")}>
          <ArrowUpRight className="size-3.5" />
        </Link>
      ) : arrow ? (
        <span aria-hidden="true" className={round}>
          <ArrowUpRight className="size-3.5" />
        </span>
      ) : null}
    </div>
  );
}

/** A widget's large number with its unit. */
function Figure({ value, unit, large = false }: { value: React.ReactNode; unit?: string; large?: boolean }) {
  return (
    <span className="flex min-w-0 shrink-0 items-baseline gap-1.5">
      <span className={cn("truncate font-semibold tabular-nums leading-none text-foreground", large ? "text-4xl" : "text-3xl")}>{value}</span>
      {unit ? <span className="text-sm text-muted-foreground">{unit}</span> : null}
    </span>
  );
}

const Sub = ({ children }: { children: React.ReactNode }) => <span className="mt-1.5 block shrink-0 truncate text-xs text-muted-foreground">{children}</span>;

/** A ring for a share of 100. */
function Ring({ pct, color }: { pct: number | null; color: string }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const part = pct === null ? 0 : Math.min(100, Math.max(0, pct)) / 100;
  return (
    <svg viewBox="0 0 64 64" className="size-16 shrink-0 -rotate-90" aria-hidden="true">
      <circle cx="32" cy="32" r={r} fill="none" strokeWidth="7" className="stroke-foreground/[0.08]" />
      {part > 0 && <circle cx="32" cy="32" r={r} fill="none" strokeWidth="7" strokeLinecap="round" stroke={color} strokeDasharray={`${c * part} ${c}`} />}
    </svg>
  );
}

// ---- the inverters' numbers -----------------------------------------------------------------------------------------------------------

/** Today's curve of one or more power keys (added up), in kW. Drawn for a site with one inverter (the readings of several are not added up here). */
function useDayCurve(inv: SiteBoardInverters, keys: string[]) {
  const single = inv.ids.length === 1;
  const series = useTodaySeries(inv.ids[0], single ? keys : NO_KEYS, 15);
  if (!single) return { points: null, now: series.nowMs };
  const values = series.axis.map((_, i) => {
    let sum = 0;
    let any = false;
    for (const k of keys) {
      const v = series.byKey[k]?.[i]?.avg;
      if (v !== null && v !== undefined) {
        sum += v;
        any = true;
      }
    }
    return any ? sum : null;
  });
  return { points: areaPoints(series.axis, values, series.nowMs, 0.001), now: series.nowMs };
}

/** What the unit preferences make of a power in watts and an energy in kWh: the number and its unit apart. */
function useFigures() {
  const u = useUnits();
  return {
    kw: (watts: number | null, key?: string) => ({ value: watts === null ? "—" : u.format(Math.abs(watts) / 1000, "kW", key, 2, false), unit: u.unit("kW", key) }),
    kwh: (v: number | null, key?: string) => (v === null || !Number.isFinite(v) ? "—" : u.format(v, "kWh", key, v >= 100 ? 0 : 1)),
    u,
  };
}

const monitoring = (inv: SiteBoardInverters, tab: string) => `/dashboard/monitoring?device=${encodeURIComponent(inv.ids[0])}#${tab}`;

function SolarWidget({ inv, className }: { inv: SiteBoardInverters; className?: string }) {
  const f = useFigures();
  const solarKeys = inv.pvKeys.length > 0 ? inv.pvKeys : ["inverter_output_power_w"];
  const n = useLiveNumbers(inv.ids, [...solarKeys, K.solar], inv.initial, agg);
  const now = f.kw(solarGenerationW(n, inv.pvKeys), solarKeys[0]);
  const curve = useDayCurve(inv, solarKeys);
  return (
    <Widget href={monitoring(inv, "solar")} label="Solar generation. Open it on Monitoring." className={className}>
      <Head icon={Sun} tone={TONE.solar} title="Solar" note="Generating now" />
      <span className="mt-3 flex items-end justify-between gap-4">
        <Figure value={now.value} unit={now.unit} large />
        <span className="shrink-0 text-right leading-tight">
          <span className="block text-xs text-muted-foreground">Today</span>
          <span className="block text-lg font-semibold tabular-nums text-foreground">{f.kwh(n[K.solar], K.solar)}</span>
        </span>
      </span>
      {curve.points && (
        <div className="mt-3 min-h-12 flex-1">
          <TodayAreaChart points={curve.points} now={curve.now} posColor={FLOW.producing} posLabel="Solar" compact />
        </div>
      )}
    </Widget>
  );
}

function LoadWidget({ inv, className }: { inv: SiteBoardInverters; className?: string }) {
  const f = useFigures();
  const n = useLiveNumbers(inv.ids, ["load_total_power_w", K.load], inv.initial, agg);
  const now = f.kw(n.load_total_power_w, "load_total_power_w");
  const curve = useDayCurve(inv, ["load_total_power_w"]);
  return (
    <Widget href={monitoring(inv, "load")} label="Load. Open it on Monitoring." className={className}>
      <Head icon={Home} tone={TONE.load} title="Load" note="Using now" />
      <span className="mt-3 block">
        <Figure value={now.value} unit={now.unit} />
        <Sub>{f.kwh(n[K.load], K.load)} today</Sub>
      </span>
      {curve.points && (
        <div className="mt-2 min-h-10 flex-1">
          <TodayAreaChart points={curve.points} now={curve.now} posColor={FLOW.consuming} posLabel="Load" compact />
        </div>
      )}
    </Widget>
  );
}

function GridWidget({ inv, className }: { inv: SiteBoardInverters; className?: string }) {
  const f = useFigures();
  const n = useLiveNumbers(inv.ids, ["grid_total_power_w", K.imported, K.exported], inv.initial, agg);
  const w = n.grid_total_power_w;
  // the inverter reports buying from the grid as positive
  const state = w === null ? "No reading" : w > 20 ? "Importing now" : w < -20 ? "Exporting now" : "Idle";
  const now = f.kw(w, "grid_total_power_w");
  const curve = useDayCurve(inv, ["grid_total_power_w"]);
  return (
    <Widget href={monitoring(inv, "grid")} label="Grid. Open it on Monitoring." className={className}>
      <Head icon={Zap} tone={TONE.grid} title="Grid" note={state} />
      <span className="mt-3 block">
        <Figure value={now.value} unit={now.unit} />
        <Sub>
          {f.kwh(n[K.imported], K.imported)} in · {f.kwh(n[K.exported], K.exported)} out today
        </Sub>
      </span>
      {curve.points && (
        <div className="mt-2 min-h-10 flex-1">
          <TodayAreaChart points={curve.points} now={curve.now} posColor={FLOW.drawing} negColor={FLOW.consuming} posLabel="Importing" negLabel="Exporting" compact />
        </div>
      )}
    </Widget>
  );
}

function BatteryWidget({ inv, className }: { inv: SiteBoardInverters; className?: string }) {
  const f = useFigures();
  const n = useLiveNumbers(inv.ids, ["battery_soc_pct", "battery_power_w", K.charged, K.discharged], inv.initial, agg);
  const soc = n.battery_soc_pct;
  const w = n.battery_power_w; // the inverter reports discharging as positive
  const power = f.kw(w, "battery_power_w");
  const state = w === null ? "No reading" : w > 20 ? `Discharging · ${power.value} ${power.unit}` : w < -20 ? `Charging · ${power.value} ${power.unit}` : "Idle";
  const level = soc === null ? 0 : Math.round(Math.min(100, Math.max(0, soc)) / 10);
  const color = soc !== null && soc < 20 ? "bg-red-500" : soc !== null && soc < 40 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <Widget href={monitoring(inv, "battery")} label="Battery. Open it on Monitoring." className={className}>
      <Head icon={BatteryCharging} tone={TONE.battery} title="Battery" note={state} />
      <span className="mt-3 block">
        <Figure value={soc === null ? "—" : Math.round(soc)} unit="%" />
        <Sub>
          {f.kwh(n[K.charged], K.charged)} in · {f.kwh(n[K.discharged], K.discharged)} out today
        </Sub>
      </span>
      {/* the charge, in ten steps */}
      <span className="mt-auto flex gap-1 pt-3" role="img" aria-label={soc === null ? "State of charge not known" : `State of charge ${Math.round(soc)}%`}>
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className={cn("h-2.5 flex-1 rounded-full", i < level ? color : "bg-foreground/[0.08]")} />
        ))}
      </span>
    </Widget>
  );
}

function SelfPoweredWidget({ inv, className }: { inv: SiteBoardInverters; className?: string }) {
  const f = useFigures();
  const n = useLiveNumbers(inv.ids, [K.load, K.imported], inv.initial, agg);
  const load = n[K.load];
  const imported = n[K.imported];
  const pct = load !== null && load > 0 && imported !== null ? Math.min(100, Math.max(0, (1 - imported / load) * 100)) : null;
  return (
    <Widget href={monitoring(inv, "grid")} label="Self-powered today. Open it on Monitoring." className={className}>
      <Head icon={Sun} tone={TONE.green} title="Self-powered" note="Today" />
      <span className="flex flex-1 items-center justify-between gap-3 pt-3">
        <span className="min-w-0">
          <Figure value={pct === null ? "—" : pct.toFixed(0)} unit="%" />
          <Sub>{load !== null && imported !== null ? `${f.kwh(imported, K.imported)} bought` : "No readings yet"}</Sub>
        </span>
        <Ring pct={pct} color={FLOW.producing} />
      </span>
    </Widget>
  );
}

function Co2Widget({ inv, className }: { inv: SiteBoardInverters; className?: string }) {
  const f = useFigures();
  const n = useLiveNumbers(inv.ids, [K.solar], inv.initial, agg);
  const solar = n[K.solar];
  const kg = solar === null ? null : co2AvoidedKg(solar);
  return (
    <Widget href={`/dashboard/performance?device=${encodeURIComponent(inv.ids[0])}`} label="Carbon dioxide avoided today. Open Performance." className={className}>
      <Leaf aria-hidden="true" className="pointer-events-none absolute -right-4 -bottom-5 size-28 text-emerald-500/10" strokeWidth={1.5} />
      <Head icon={Leaf} tone={TONE.green} title="CO₂ avoided" note="Today, estimated" />
      <span className="mt-3 block">
        <Figure value={kg === null ? "—" : kg.toFixed(kg >= 100 ? 0 : 1)} unit="kg" />
        <Sub>{solar === null ? "No readings yet" : `from ${f.kwh(solar, K.solar)} of solar`}</Sub>
      </span>
    </Widget>
  );
}

// ---- the weather ----------------------------------------------------------------------------------------------------------------------

function WeatherWidget({ siteId, place, wide, className }: { siteId: string; place: string | null; wide: boolean; className?: string }) {
  const { weather, reason } = useSiteWeather(siteId);
  if (!weather) {
    return (
      <Widget href="/dashboard/weather" label="Weather. Open the forecast." className={className}>
        <Head icon={Sun} tone={TONE.solar} title="Weather" note={place} />
        {weather === undefined ? (
          <span className="mt-3 block space-y-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-3 w-28" />
          </span>
        ) : (
          <span className="mt-3 block text-sm text-muted-foreground">{reason === "no-location" ? "This site has no saved location yet." : "The weather could not be read just now."}</span>
        )}
      </Widget>
    );
  }
  const n = weather.now;
  const look = WEATHER_ICON[n.condition];
  const today = weather.days[0];
  const sunshine = weather.solar.potentialPct;
  const hours = weather.solar.hours;
  const nowHour = new Date(Date.parse(n.at) + IST_MS).getUTCHours();
  return (
    <Widget href="/dashboard/weather" label="Weather. Open the forecast." className={className}>
      <Head icon={look[n.night ? "night" : "day"]} tone={cn("bg-amber-500/15", look.tone)} title="Weather" note={place} />
      <span className="mt-3 flex min-h-0 flex-1 gap-5">
        <span className="flex min-w-0 flex-1 flex-col">
          <Figure value={temp(n.tempC)} />
          <Sub>
            {CONDITION_TEXT[n.condition]}
            {today ? ` · ${temp(today.maxC)} / ${temp(today.minC)}` : ""}
          </Sub>
          {/* how much of a clear day's sunshine the forecast cloud leaves */}
          <span className="mt-auto block pt-3">
            <span className="flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
              <span className="truncate">Sunshine for solar</span>
              <span className="font-semibold tabular-nums text-foreground">{sunshine}%</span>
            </span>
            <span className="mt-1.5 block h-2 overflow-hidden rounded-full bg-foreground/[0.08]">
              <span className="block h-full rounded-full bg-amber-400" style={{ width: `${Math.min(100, Math.max(0, sunshine))}%` }} />
            </span>
          </span>
        </span>
        {/* the sunshine hour by hour: what the cloud leaves, over a faded bar for a clear sky */}
        {wide && hours.length > 0 && (
          <span className="flex min-w-0 flex-1 flex-col max-md:hidden">
            <span className="flex min-h-12 flex-1 items-end gap-[3px]" role="img" aria-label="Expected sunshine by hour today">
              {hours.map((h) => (
                <span key={h.hour} className="relative flex-1 rounded-t-sm bg-foreground/[0.08]" style={{ height: `${Math.max(4, (h.clearWm2 / 1100) * 100)}%` }}>
                  <span className={cn("absolute inset-x-0 bottom-0 rounded-t-sm", h.hour === nowHour ? "bg-amber-500" : "bg-amber-400/80")} style={{ height: `${h.clearWm2 > 0 ? (h.wm2 / h.clearWm2) * 100 : 0}%` }} />
                </span>
              ))}
            </span>
            <span className="mt-1 flex justify-between text-[10px] text-muted-foreground">
              <span>{today?.sunrise ? clockOf(today.sunrise) : ""}</span>
              <span>{today?.sunset ? clockOf(today.sunset) : ""}</span>
            </span>
          </span>
        )}
      </span>
    </Widget>
  );
}

// ---- the devices ----------------------------------------------------------------------------------------------------------------------

const DEVICE_ICON: Record<SiteBoardDevice["kind"], LucideIcon> = { inverter: Sun, charger: EvCharger, other: Server };
const DOT: Record<ConnectionStatus, string> = { online: "bg-emerald-500", connection_lost: "bg-amber-500", offline: "bg-red-500" };
const statusWord = (s: ConnectionStatus | null) => (s === null ? "No data" : s === "online" ? "Online" : CONNECTION_LABEL[s]);

/** What a charger is doing right now: the live channel's verdict and the connector's own status, over what the server saw. */
function useChargerLive(c: SiteBoardCharger, car: CarProfile | null) {
  const n = useLiveNumbers([c.id], EV_LIVE_KEYS, c.initial);
  const live = useDeviceLive(c.id);
  const connected = live.verdict ? live.verdict.status === "online" : c.connected;
  const offline = connected === false;
  const status = getConnectorStatusLabel(n.connector_status, c.connectorOptions).label;
  // a charge is on when a session is open or the connector says "Charging" (the electrical readings are never the proof: they stay after a charge)
  const charging = !offline && (c.open !== null || /^charging$/i.test(status));
  const powerKw = charging ? n.power_active_import_kw : null;
  const reg = n.energy_active_import_register_kwh;
  const chargeKwh = c.open ? (reg !== null && c.open.startEnergyKwh !== null ? Math.max(0, reg - c.open.startEnergyKwh) : c.open.kwh) : null;
  const progress = chargeProgress({ deliveredKwh: chargeKwh, targetKwh: c.open?.targetKwh ?? null, powerKw, car });
  return { offline, status, charging, powerKw, chargeKwh, progress };
}

/** A charger's word in the devices list: "Charging" while a charge runs, else its connection. */
function ChargerWord({ charger, status }: { charger: SiteBoardCharger; status: ConnectionStatus | null }) {
  const live = useChargerLive(charger, null);
  if (live.charging) return <StatusWord status="online" word="Charging" pulse />;
  return <StatusWord status={status} />;
}

function StatusWord({ status, word, pulse = false }: { status: ConnectionStatus | null; word?: string; pulse?: boolean }) {
  return (
    <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
      <span aria-hidden="true" className={cn("size-2 rounded-full", status === null ? "bg-foreground/25" : DOT[status], pulse && "motion-safe:animate-pulse")} />
      {word ?? statusWord(status)}
    </span>
  );
}

function DevicesWidget({ devices, chargers, className }: { devices: SiteBoardDevice[]; chargers: SiteBoardCharger[]; className?: string }) {
  const hub = useDeviceHub();
  const tabs = useOverviewTabs();
  const { ref, count } = useFitRows(4);
  const rows = devices.map((d) => ({ ...d, status: hub.states[d.id]?.status ?? d.status }));
  const known = rows.filter((d) => d.status !== null);
  const down = known.filter((d) => d.status !== "online").length;
  const summary = known.length === 0 ? "No data yet" : down === 0 ? "All online" : `${down} of ${known.length} not reporting`;
  return (
    <Widget className={className}>
      <Head icon={Server} tone={TONE.plain} title="Devices" note={summary} href="/dashboard/devices" />

      {/* a phone: the devices as icons with their state, and the whole tile opens the Devices page */}
      <span className="flex flex-1 flex-col md:hidden">
        <span className="mt-3 flex flex-wrap gap-2">
          {rows.slice(0, 4).map((d) => {
            const Icon = DEVICE_ICON[d.kind];
            return (
              <span key={d.id} className="relative grid size-10 place-items-center rounded-full bg-muted text-foreground" title={`${d.name}: ${statusWord(d.status)}`}>
                <Icon className="size-[18px]" />
                <span aria-hidden="true" className={cn("absolute right-0 bottom-0 size-2.5 rounded-full ring-2 ring-background", d.status === null ? "bg-foreground/25" : DOT[d.status])} />
              </span>
            );
          })}
        </span>
        <span className="mt-auto block pt-3 text-lg font-semibold leading-tight text-foreground">
          {rows.length} {rows.length === 1 ? "device" : "devices"}
        </span>
        <Link href="/dashboard/devices" aria-label="Open the devices" className="absolute inset-0 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      </span>

      {/* wider: one row per device (as many as fit); pressing one opens its tab */}
      <ul ref={ref} className="-mx-2 mt-2 min-h-0 flex-1 divide-y overflow-hidden px-1 max-md:hidden">
        {rows.slice(0, count).map((d) => {
          const Icon = DEVICE_ICON[d.kind];
          const charger = d.kind === "charger" ? chargers.find((c) => c.id === d.id) : undefined;
          const hasTab = tabs?.has(d.id) ?? false;
          const body = (
            <>
              <span className={cn("grid size-8 shrink-0 place-items-center rounded-xl", d.kind === "inverter" ? TONE.solar : d.kind === "charger" ? TONE.ev : TONE.plain)}>
                <Icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-sm font-medium text-foreground">{d.name}</span>
                {d.model ? <span className="block truncate text-xs text-muted-foreground">{d.model}</span> : null}
              </span>
              {charger ? <ChargerWord charger={charger} status={d.status} /> : <StatusWord status={d.status} />}
            </>
          );
          return (
            <li key={d.id}>
              {hasTab ? (
                <button type="button" onClick={() => tabs?.open(d.id)} aria-label={`Open ${d.name}`} className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring">
                  {body}
                </button>
              ) : (
                <span className="flex items-center gap-3 px-2 py-2.5">{body}</span>
              )}
            </li>
          );
        })}
      </ul>
    </Widget>
  );
}

// ---- the charger ----------------------------------------------------------------------------------------------------------------------

function EvWidget({ charger, car, className }: { charger: SiteBoardCharger; car: CarProfile | null; className?: string }) {
  const { u } = useFigures();
  const tabs = useOverviewTabs();
  const live = useChargerLive(charger, car);
  const kwh = (v: number, digits = 2) => u.format(v, "kWh", "ev_energy_today_kwh", digits);
  const last = charger.last;
  const percent = live.progress.percent;

  // how the last charge ended: against what was booked (or the car's battery), full when there was nothing to measure it by
  const lastPercent = (() => {
    if (!last) return null;
    const p = chargeProgress({ deliveredKwh: last.kwh, targetKwh: last.targetKwh, powerKw: null, car }).percent;
    return p === null || p >= 98 ? 100 : p;
  })();

  const note = live.offline ? "Offline" : live.charging ? "Charging" : live.status;
  const figure = live.charging
    ? percent !== null
      ? { value: String(Math.round(percent)), unit: "%" }
      : live.chargeKwh !== null
        ? { value: u.format(live.chargeKwh, "kWh", "ev_energy_today_kwh", 2, false), unit: u.unit("kWh", "ev_energy_today_kwh") }
        : { value: "Charging", unit: undefined }
    : live.offline
      ? { value: "Offline", unit: undefined }
      : last
        ? { value: u.format(last.kwh, "kWh", "ev_energy_today_kwh", 2, false), unit: u.unit("kWh", "ev_energy_today_kwh") }
        : { value: "Ready", unit: undefined };
  const sub = live.charging
    ? [
        percent !== null && live.chargeKwh !== null ? kwh(live.chargeKwh) : null,
        live.powerKw !== null ? u.format(live.powerKw, "kW", "power_active_import_kw", 2) : null,
        live.progress.minutesLeft !== null ? `${minutesText(live.progress.minutesLeft)} left` : null,
      ]
        .filter(Boolean)
        .join(" · ") || "A charge is running"
    : last
      ? `Last charge · ${dayOf(last.startedAt)}, ${clockOf(last.startedAt)}`
      : live.offline
        ? "The charger is not answering"
        : "No charge yet";
  const fill = live.charging ? percent : live.offline ? null : lastPercent;
  const open = tabs?.has(charger.id) ? () => tabs.open(charger.id) : null;

  return (
    <Widget className={className}>
      {/* the car, at the right, fading into the tile */}
      <Image
        src="/images/ev-car-nexon-v2.webp"
        alt=""
        width={1400}
        height={796}
        sizes="(max-width: 767px) 70vw, 30vw"
        className={cn(
          "pointer-events-none absolute -right-[9%] bottom-[4%] h-[70%] w-auto max-w-none select-none object-contain [mask-image:linear-gradient(to_right,transparent_2%,black_38%)] dark:brightness-125 dark:contrast-110",
          !live.charging && "opacity-80"
        )}
      />
      <span className="relative flex min-h-0 flex-1 flex-col">
        <Head icon={EvCharger} tone={TONE.ev} title={charger.name} note={note} arrow={open !== null} />
        <span className="mt-3 block max-w-[62%]">
          <Figure value={figure.value} unit={figure.unit} large />
          <Sub>{sub}</Sub>
        </span>
        <span className="mt-auto block max-w-[62%] pt-3">
          <span className="block h-2 overflow-hidden rounded-full bg-foreground/[0.08]" role="img" aria-label={fill === null ? "No charge to show" : `${Math.round(fill)}% of the charge`}>
            {fill !== null && fill > 0 && <span className={cn("block h-full rounded-full bg-emerald-500", live.charging && "motion-safe:animate-pulse")} style={{ width: `${Math.min(100, fill)}%` }} />}
          </span>
          <span className="mt-1.5 block truncate text-xs text-muted-foreground">Today {charger.todayKwh === null ? "—" : kwh(charger.todayKwh, 1)}</span>
        </span>
      </span>
      {open && <button type="button" onClick={open} aria-label={`Open ${charger.name}`} className="absolute inset-0 cursor-pointer rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring" />}
    </Widget>
  );
}

/** A site with a charger and no inverter: the charger's last 30 days in a small tile. */
function EvMonthWidget({ charger, className }: { charger: SiteBoardCharger; className?: string }) {
  const { u } = useFigures();
  return (
    <Widget href={`/dashboard/reports?device=${encodeURIComponent(charger.id)}#ev`} label="Charging in the last 30 days. Open Reports." className={className}>
      <Head icon={Zap} tone={TONE.ev} title="Charged" note="Last 30 days" />
      <span className="mt-3 block">
        <Figure value={u.format(charger.kwh30, "kWh", "ev_energy_today_kwh", charger.kwh30 >= 100 ? 0 : 1, false)} unit={u.unit("kWh", "ev_energy_today_kwh")} />
        <Sub>
          {charger.sessions30} {charger.sessions30 === 1 ? "charge" : "charges"}
        </Sub>
      </span>
    </Widget>
  );
}

// ---- the board ------------------------------------------------------------------------------------------------------------------------

/**
 * The site's own Overview: every device together, as widgets. Solar now and today with the day's curve, the weather at the site, the devices and their
 * state (pressing one opens its tab), the load, the grid, the battery, how much of the day's use did not come from the grid, the carbon dioxide the
 * day's solar avoided, and the charger with its car. A widget is there only when the site has what it shows (no charger tile without a charger, no
 * battery tile without a battery), and the tiles are laid out to fill a four-column grid whatever is there: the weather widens (and shows the
 * sunshine hour by hour) and the last small tile stretches when a cell would be left empty. On a wide screen the grid fits the screen's height; on a
 * phone it is two columns that scroll. The numbers are live (in place, no page refresh); the curves are today's 15-minute readings (one inverter).
 */
export function SiteOverviewBoard({
  siteId,
  place,
  devices,
  inverters,
  chargers,
  car,
  background,
}: {
  siteId: string;
  /** Where the site is, in a word (its city, else its name). */
  place: string | null;
  devices: SiteBoardDevice[];
  inverters: SiteBoardInverters | null;
  chargers: SiteBoardCharger[];
  car: CarProfile | null;
  /** The CSS of the person's own background (null for none): the tiles turn to frosted glass over it. */
  background: string | null;
}) {
  // the charger shown: the one that is charging, else the first
  const charger = chargers.find((c) => c.open !== null) ?? chargers[0] ?? null;
  const inv = inverters;

  const smalls: ((className: string) => React.ReactNode)[] = [];
  if (inv) {
    smalls.push((c) => <LoadWidget key="load" inv={inv} className={c} />);
    if (inv.hasGrid) smalls.push((c) => <GridWidget key="grid" inv={inv} className={c} />);
    if (inv.hasBattery) smalls.push((c) => <BatteryWidget key="battery" inv={inv} className={c} />);
    if (inv.hasGrid) smalls.push((c) => <SelfPoweredWidget key="self" inv={inv} className={c} />);
    smalls.push((c) => <Co2Widget key="co2" inv={inv} className={c} />);
  } else if (charger) {
    smalls.push((c) => <EvMonthWidget key="month" charger={charger} className={c} />);
  }

  // The four-column grid (from a tablet up). Solar is two cells (four when there is no charger to fill the row under it), the charger two (four on its
  // own), the devices list one column over two rows, everything else one cell. What would be left empty goes to the weather and the last small tile.
  const solarTall = inv !== null && charger === null;
  const evBig = charger !== null && inv === null;
  const cells = (inv ? (solarTall ? 4 : 2) : 0) + 1 + 2 + (charger ? (evBig ? 4 : 2) : 0) + smalls.length;
  const rows = Math.max(2, Math.ceil(cells / 4));
  const spare = rows * 4 - cells;
  const weatherWide = spare >= 1 && rows >= 3;
  const lastExtra = Math.max(0, spare - (weatherWide ? 1 : 0));
  const lastSpan = ["", "md:col-span-2", "md:col-span-3", "md:col-span-4"][Math.min(3, lastExtra)];

  return (
    <div
      style={{ "--rows": rows } as React.CSSProperties}
      className={cn(
        "grid grid-flow-dense grid-cols-2 gap-3 md:auto-rows-[minmax(12.5rem,auto)] md:grid-cols-4 lg:h-[max(calc(100svh-9.5rem),34rem)] lg:auto-rows-auto lg:gap-4 lg:[grid-template-rows:repeat(var(--rows),minmax(0,1fr))]",
        background && "[&_[data-widget]]:border-white/15 [&_[data-widget]]:bg-card/60 [&_[data-widget]]:backdrop-blur-md"
      )}
    >
      {inv && <SolarWidget inv={inv} className={cn("order-3 col-span-2 min-h-56 md:order-none md:min-h-0", solarTall && "md:row-span-2")} />}
      <WeatherWidget siteId={siteId} place={place} wide={weatherWide} className={cn("order-2 min-h-44 md:order-none md:min-h-0", weatherWide && "md:col-span-2")} />
      <DevicesWidget devices={devices} chargers={chargers} className={cn("order-1 min-h-44 md:order-none md:col-start-4 md:row-span-2 md:min-h-0", weatherWide ? "md:row-start-2" : "md:row-start-1")} />
      {smalls.map((render, i) => {
        const last = i === smalls.length - 1;
        return render(cn("order-4 min-h-40 md:order-none md:min-h-0", last && smalls.length % 2 === 1 && "max-md:col-span-2 max-md:min-h-32", last && lastSpan));
      })}
      {charger && <EvWidget charger={charger} car={car} className={cn("order-5 col-span-2 min-h-48 md:order-none md:min-h-0", evBig && "md:row-span-2")} />}
    </div>
  );
}
