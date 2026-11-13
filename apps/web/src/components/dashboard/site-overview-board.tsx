"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, BatteryCharging, Check, ChevronRight, EvCharger, Home, IndianRupee, Leaf, MapPin, Server, Sun, Zap, type LucideIcon } from "lucide-react";
import { selectSite } from "@/app/dashboard/actions";
import { parseTarget } from "@/lib/ev-control";
import { inr } from "@/lib/savings";
import { useUnits } from "@/components/units-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { useFitRows } from "@/hooks/use-fit-rows";
import { useSiteWeather } from "@/hooks/use-site-weather";
import { CONNECTION_LABEL, type ConnectionStatus } from "@/lib/device-state";
import { agoText } from "@/lib/device-status-summary";
import { areaPoints, TODAY_COUNTER_KEYS as K } from "@/lib/energy-today";
import type { EnumOption } from "@/lib/enum-labels";
import { co2AvoidedKg, evCo2SavedKg, treesEquivalent } from "@/lib/environmental-impact";
import { DEFAULT_KM_PER_KWH, chargeProgress, minutesText, type CarProfile } from "@/lib/ev-car";
import { getConnectorStatusLabel } from "@/lib/ev-charger-catalog";
import type { EvHistorySession } from "@/lib/ev-history";
import { EV_LIVE_KEYS } from "@/lib/ev-live-keys";
import type { OpenCharge } from "@/lib/ev-overview";
import { siteAgg } from "@/lib/overview-keys";
import type { SiteSavings } from "@/lib/site-savings";
import { solarGenerationW } from "@/lib/solar-generation";
import { useLiveNumbers, type Agg } from "@/lib/telemetry/live-values";
import { useDeviceLive, useTodaySeries } from "@/lib/telemetry/react";
import { CONDITION_TEXT } from "@/lib/weather";
import { solarVerdict } from "@/lib/weather-format";
import { cn } from "@/lib/utils";
import { useDeviceHub } from "./device-live-hub";
import { badgeFor, homeSourceOf } from "./energy-flow-badge";
import { useEvCharge } from "./ev-charge-control";
import { SlideToConfirm } from "./slide-to-confirm";
import { FLOW } from "./flow-colors";
import { useOverviewTabs } from "./overview-tabs";
import { SiteMapCard } from "./site-map-card";
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

/** One of the customer's sites. */
export interface SiteBoardSite {
  id: string;
  name: string;
  /** Its city, when it has an address. */
  place: string | null;
  deviceCount: number;
  /** The site being shown. */
  selected: boolean;
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
  /** An inverter's first numbers and PV power keys (for the figures in the devices list). */
  initial?: Record<string, number | null>;
  pvKeys?: string[];
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

// ---- the inverters' numbers -----------------------------------------------------------------------------------------------------------

/** Today's curve of one or more power keys (added up), in kW. Drawn for a site with one inverter (the readings of several are not added up here). */
function useDayCurve(inv: SiteBoardInverters, keys: string[], sign: 1 | -1 = 1) {
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
    return any ? sum * sign : null;
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
  const solarW = solarGenerationW(n, inv.pvKeys);
  const now = f.kw(solarW, solarKeys[0]);
  const curve = useDayCurve(inv, solarKeys);
  return (
    <Widget href={monitoring(inv, "solar")} label="Solar generation. Open it on Monitoring." className={className}>
      {/* the state in the energy flow's own words (Producing, Idle) */}
      <Head icon={Sun} tone={TONE.solar} title="Solar" note={badgeFor("solar", solarW).label} />
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
  const solarKeys = inv.pvKeys.length > 0 ? inv.pvKeys : ["inverter_output_power_w"];
  const n = useLiveNumbers(inv.ids, [...solarKeys, "load_total_power_w", "battery_power_w", "grid_total_power_w", K.load], inv.initial, agg);
  const now = f.kw(n.load_total_power_w, "load_total_power_w");
  const curve = useDayCurve(inv, ["load_total_power_w"]);
  // what is supplying the load, in the energy flow's own words (Solar-powered, Grid power, Battery-powered, Idle)
  const source = homeSourceOf(n.load_total_power_w, solarGenerationW(n, inv.pvKeys), n.battery_power_w === null ? null : -n.battery_power_w, n.grid_total_power_w);
  return (
    <Widget href={monitoring(inv, "load")} label="Load. Open it on Monitoring." className={className}>
      <Head icon={Home} tone={TONE.load} title="Load" note={badgeFor("home", n.load_total_power_w, source).label} />
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
  // the inverter reports buying from the grid as positive; the words are the energy flow's own (Importing, Exporting, Idle)
  const state = w === null ? "No reading" : badgeFor("grid", w).label;
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
  // today's charging and discharging: the inverter reports discharging as positive, the graph draws charging as the main colour (as the inverter's own card does)
  const curve = useDayCurve(inv, ["battery_power_w"], -1);
  const soc = n.battery_soc_pct;
  const w = n.battery_power_w;
  const power = f.kw(w, "battery_power_w");
  // the inverter reports discharging as positive; the energy flow takes charging as positive and words it Charging, Discharging, Idle
  const word = w === null ? null : badgeFor("battery", -w).label;
  const state = word === null ? "No reading" : word === "Idle" ? "Idle" : `${word} · ${power.value} ${power.unit}`;
  const level = soc === null ? 0 : Math.round(Math.min(100, Math.max(0, soc)) / 10);
  const color = soc !== null && soc < 20 ? "bg-red-500" : soc !== null && soc < 40 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <Widget href={monitoring(inv, "battery")} label="Battery. Open it on Monitoring." className={className}>
      <Head icon={BatteryCharging} tone={TONE.battery} title="Battery" note={state} />
      <span className="mt-3 block">
        <Figure value={soc === null ? "—" : Math.round(soc)} unit="%" />
        <Sub>
          {f.kwh(n[K.charged], K.charged)} charged · {f.kwh(n[K.discharged], K.discharged)} discharged today
        </Sub>
      </span>
      {curve.points ? (
        <div className="mt-2 min-h-12 flex-1">
          <TodayAreaChart points={curve.points} now={curve.now} posColor={FLOW.producing} negColor={FLOW.drawing} posLabel="Charging" negLabel="Discharging" compact />
        </div>
      ) : (
        // (the curves are drawn for one inverter) several inverters: the charge in ten steps
        <span className="mt-auto flex gap-1 pt-3" role="img" aria-label={soc === null ? "State of charge not known" : `State of charge ${Math.round(soc)}%`}>
          {Array.from({ length: 10 }, (_, i) => (
            <span key={i} className={cn("h-2.5 flex-1 rounded-full", i < level ? color : "bg-foreground/[0.08]")} />
          ))}
        </span>
      )}
    </Widget>
  );
}

const monthsText = (m: number) => (m < 12 ? `${Math.max(1, Math.round(m))} ${Math.round(m) <= 1 ? "month" : "months"}` : `${(m / 12).toFixed(1)} years`);

/** A ring cut into parts (each part's colour and size); the middle is free for a figure. */
function Donut({ parts, size, children }: { parts: { value: number; color: string }[]; size: number; children?: React.ReactNode }) {
  const r = 28;
  const c = 2 * Math.PI * r;
  const total = parts.reduce((a, p) => a + Math.max(0, p.value), 0);
  let offset = 0;
  return (
    <span className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 72 72" className="size-full -rotate-90" aria-hidden="true">
        <circle cx="36" cy="36" r={r} fill="none" strokeWidth="9" className="stroke-foreground/[0.08]" />
        {total > 0 &&
          parts.map((p, k) => {
            const len = (Math.max(0, p.value) / total) * c;
            const seg = (
              <circle key={k} cx="36" cy="36" r={r} fill="none" strokeWidth="9" stroke={p.color} strokeDasharray={`${Math.max(0, len - (parts.length > 1 ? 1.5 : 0))} ${c}`} strokeDashoffset={-offset} strokeLinecap="butt" />
            );
            offset += len;
            return seg;
          })}
      </svg>
      <span className="absolute inset-0 grid place-items-center">{children}</span>
    </span>
  );
}

/**
 * The carbon dioxide saved since the start by the solar and by the electric car (estimates). Solar: the energy the inverters have made, at the grid's emission
 * factor (what it did not have to draw from the grid). Electric car: the petrol car's emissions over the distance driven, less what the grid part of the charging
 * gave off (distance = the energy charged times the car's km per kWh, 6 until the car is entered). The two do not overlap, so they are added: a ring split
 * between them around a leaf, the total beside it with the trees a year would take up, and under it each one's kilograms and share.
 */
function Co2Widget({ inv, savings, car, className }: { inv: SiteBoardInverters; savings: SiteSavings | null; car: CarProfile | null; className?: string }) {
  const solarKg = savings && savings.solarKwh !== null ? co2AvoidedKg(savings.solarKwh) : null;
  const ev = savings && savings.evKwh > 0 ? evCo2SavedKg(savings.evKwh, savings.evGridKwh, car?.kmPerKwh ?? DEFAULT_KM_PER_KWH) : null;
  const total = solarKg === null && ev === null ? null : (solarKg ?? 0) + (ev?.kg ?? 0);
  const trees = total === null ? null : treesEquivalent(total);
  const text = (v: number) => (v >= 10000 ? `${(v / 1000).toFixed(1)}` : v.toLocaleString("en-IN", { maximumFractionDigits: v >= 100 ? 0 : 1 }));
  const unit = total !== null && total >= 10000 ? "tonnes" : "kg";
  const parts = [
    ...(solarKg !== null ? [{ key: "solar", label: "Solar", detail: `${savings!.solarKwh!.toLocaleString("en-IN", { maximumFractionDigits: 0 })} kWh`, color: "#fbbf24", kg: solarKg }] : []),
    ...(ev ? [{ key: "ev", label: "Electric car", detail: `${ev.km.toLocaleString("en-IN", { maximumFractionDigits: 0 })} km`, color: "#10b981", kg: ev.kg }] : []),
  ];
  return (
    <Widget href={`/dashboard/performance?device=${encodeURIComponent(inv.ids[0])}`} label="Carbon dioxide saved so far. Open Performance." className={className}>
      <Head icon={Leaf} tone={TONE.green} title="CO₂ saved" note="Since the start, estimated" />
      <span className="mt-3 flex items-center gap-4">
        <Donut size={84} parts={parts.map((p) => ({ value: p.kg, color: p.color }))}>
          <Leaf className="size-6 text-emerald-500" strokeWidth={1.8} />
        </Donut>
        <span className="min-w-0 flex-1">
          <Figure value={total === null ? "—" : text(unit === "tonnes" ? total / 1000 : total)} unit={unit} />
          <Sub>{trees !== null && trees >= 1 ? `As much as ${Math.round(trees).toLocaleString("en-IN")} trees take up in a year` : total === null ? "No readings yet" : "Since the system started"}</Sub>
        </span>
      </span>
      {parts.length > 0 && total !== null && total > 0 && (
        <span className="mt-auto grid gap-1.5 pt-3">
          {parts.map((r) => (
            <span key={r.key} className="flex items-center gap-2 text-xs">
              <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: r.color }} />
              <span className="min-w-0 flex-1 truncate text-muted-foreground">
                {r.label} · {r.detail}
              </span>
              <span className="shrink-0 tabular-nums text-foreground">
                {text(r.kg)} kg · {Math.round((r.kg / total) * 100)}%
              </span>
            </span>
          ))}
        </span>
      )}
    </Widget>
  );
}

/**
 * What the electricity has cost and what the solar has saved: the saving since the start, with a ring for how much of the system's price it has paid back,
 * a chart of what was saved in each of the last six months (this month marked), and this month's bill against what it would have been without the solar
 * (a bill below zero is a credit: more was sent to the grid than bought).
 */
function SavingsWidget({ savings, className }: { savings: SiteSavings | null; className?: string }) {
  const m = savings?.month ?? null;
  const saved = savings?.savedTotal ?? null;
  const invested = savings?.invested ?? 0;
  const paidPct = saved !== null && invested > 0 ? Math.min(100, Math.max(0, (saved / invested) * 100)) : null;
  const monthly = savings?.monthly ?? [];
  const top = Math.max(1, ...monthly.map((x) => x.saved));
  const billText = (v: number) => (v < 0 ? `a ${inr(-v)} credit` : inr(v));
  return (
    <Widget href="/dashboard/performance" label="Cost and savings. Open Performance." className={className}>
      <Head icon={IndianRupee} tone={TONE.green} title="Cost & savings" note="Since the solar started" />
      <span className="mt-3 flex items-center justify-between gap-3">
        <span className="min-w-0">
          <Figure value={saved === null ? "—" : inr(saved)} />
          <Sub>saved on the electricity bill so far</Sub>
        </span>
        {paidPct !== null && (
          <span className="flex shrink-0 flex-col items-center gap-0.5" title={savings?.paybackMonths === 0 ? "The savings have paid for the system" : savings?.paybackMonths ? `About ${monthsText(savings.paybackMonths)} to go at the recent pace` : undefined}>
            <Donut size={60} parts={[{ value: paidPct, color: "#10b981" }, { value: 100 - paidPct, color: "transparent" }]}>
              <span className="text-xs font-semibold tabular-nums text-foreground">{Math.round(paidPct)}%</span>
            </Donut>
            <span className="text-[10px] text-muted-foreground">paid back</span>
          </span>
        )}
      </span>
      {monthly.length > 0 && (
        <span className="mt-3 flex min-h-14 flex-1 items-end gap-1.5" role="img" aria-label={`Saved each month: ${monthly.map((x) => `${x.label} ${inr(x.saved)}`).join(", ")}`}>
          {monthly.map((x, k) => (
            <span key={x.label} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${x.label}: ${inr(x.saved)}`}>
              <span className={cn("w-full rounded-t-md", k === monthly.length - 1 ? "bg-emerald-500" : "bg-emerald-500/35")} style={{ height: `${Math.max(6, (Math.max(0, x.saved) / top) * 100)}%` }} />
              <span className="text-[10px] leading-none text-muted-foreground">{x.label.slice(0, 3)}</span>
            </span>
          ))}
        </span>
      )}
      <span className="mt-2 block truncate text-xs text-muted-foreground">
        {m ? `This month: ${billText(m.withSolar)} instead of ${inr(m.withoutSolar)}` : saved === null ? "No readings yet" : "This month's bill shows once there are readings"}
      </span>
    </Widget>
  );
}

// ---- the weather ----------------------------------------------------------------------------------------------------------------------

type WeatherState = ReturnType<typeof useSiteWeather>;

/** The weather as a tile (a tablet and wider). */
function WeatherWidget({ state, place, wide, className }: { state: WeatherState; place: string | null; wide: boolean; className?: string }) {
  const { weather, reason } = state;
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

/** On a phone the weather is not a tile but the head of the page, as in a weather app: the place, the temperature large, the condition, high and low. */
function WeatherHero({ state, place, siteName, className }: { state: WeatherState; place: string | null; siteName: string; className?: string }) {
  const { weather, reason } = state;
  const n = weather?.now;
  const today = weather?.days[0];
  return (
    <Link href="/dashboard/weather" aria-label="Weather. Open the forecast." className={cn("flex flex-col items-center rounded-2xl px-2 pt-2 pb-3 text-center outline-none focus-visible:ring-2 focus-visible:ring-ring", className)}>
      <span className="max-w-full truncate text-lg font-medium text-foreground">{place && place !== siteName ? `${siteName} · ${place}` : siteName}</span>
      {weather === undefined ? (
        <span className="mt-3 flex flex-col items-center gap-2">
          <Skeleton className="h-20 w-32" />
          <Skeleton className="h-4 w-28" />
        </span>
      ) : !n ? (
        <span className="mt-3 text-sm text-muted-foreground">{reason === "no-location" ? "This site has no saved location yet." : "The weather could not be read just now."}</span>
      ) : (
        <>
          <span className="mt-1 text-[6.75rem] font-light leading-none tracking-tight tabular-nums text-foreground">{temp(n.tempC)}</span>
          <span className="mt-2 text-xl font-medium text-foreground/80">{CONDITION_TEXT[n.condition]}</span>
          {today && (
            <span className="mt-0.5 text-lg tabular-nums text-foreground/80">
              H:{temp(today.maxC)} L:{temp(today.minC)}
            </span>
          )}
        </>
      )}
    </Link>
  );
}

/** The sunshine for solar today, hour by hour (a phone: under the weather at the head of the page). */
function SunshineTile({ state, className }: { state: WeatherState; className?: string }) {
  const { weather } = state;
  if (!weather) return null;
  const today = weather.days[0];
  const hours = weather.solar.hours;
  const sunshine = weather.solar.potentialPct;
  const nowHour = new Date(Date.parse(weather.now.at) + IST_MS).getUTCHours();
  return (
    <Widget href="/dashboard/weather" label="Sunshine for solar today. Open the forecast." className={className}>
      <Head icon={Sun} tone={TONE.solar} title="Sunshine for solar" note={solarVerdict(sunshine).text} />
      <span className="mt-3 flex items-end gap-4">
        <span className="shrink-0">
          <Figure value={sunshine} unit="%" />
          <Sub>of a clear day</Sub>
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex h-14 items-end gap-[3px]" role="img" aria-label="Expected sunshine by hour today">
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

/** 5420 s -> "1 h 30 min", 154 s -> "3 min" (under a minute is "< 1 min"). */
function span(sec: number): string {
  const min = Math.round(sec / 60);
  if (min < 1) return "< 1 min";
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")} min`;
}

/** Three small figures side by side, each with its label over it. */
function Facts({ items }: { items: { label: string; value: string }[] }) {
  return (
    <span className="mt-2 grid grid-cols-3 gap-2">
      {items.map((x) => (
        <span key={x.label} className="min-w-0 leading-tight">
          <span className="block truncate text-[11px] text-muted-foreground">{x.label}</span>
          <span className="block truncate text-sm font-semibold tabular-nums text-foreground">{x.value}</span>
        </span>
      ))}
    </span>
  );
}

/** An inverter in the devices list: what it makes now and today, the battery, and when it last reported. */
function InverterFacts({ device, ago }: { device: SiteBoardDevice; ago: string | null }) {
  const f = useFigures();
  const pv = device.pvKeys ?? NO_KEYS;
  const keys = React.useMemo(() => [...pv, "inverter_output_power_w", "battery_soc_pct", "load_total_power_w", "grid_total_power_w", "battery_power_w", K.solar], [pv]);
  const n = useLiveNumbers([device.id], keys, device.initial ?? {});
  const soc = n.battery_soc_pct;
  const power = (w: number | null | undefined, key: string) => {
    const x = f.kw(w ?? null, key);
    return x.value === "—" ? "—" : `${x.value} ${x.unit}`;
  };
  const grid = n.grid_total_power_w;
  return (
    <>
      <Facts
        items={[
          { label: "Generating", value: power(solarGenerationW(n, pv), "inverter_output_power_w") },
          { label: "Today", value: f.kwh(n[K.solar], K.solar) },
          { label: "Battery", value: soc === null ? "—" : `${Math.round(soc)}%` },
        ]}
      />
      <Facts
        items={[
          { label: "Load", value: power(n.load_total_power_w, "load_total_power_w") },
          { label: grid === null ? "Grid" : grid < 0 ? "To the grid" : grid > 0 ? "From the grid" : "Grid", value: power(grid, "grid_total_power_w") },
          { label: n.battery_power_w === null ? "Battery power" : n.battery_power_w > 0 ? "Discharging" : n.battery_power_w < 0 ? "Charging" : "Battery power", value: power(n.battery_power_w, "battery_power_w") },
        ]}
      />
      <span className="mt-1.5 block truncate text-xs text-muted-foreground">{ago ? `Last reading ${ago}` : "No reading yet"}</span>
    </>
  );
}

/** A charger in the devices list: today's and the month's charging, its last session, and when it last reported. */
function ChargerFacts({ charger, ago }: { charger: SiteBoardCharger; ago: string | null }) {
  const { u } = useFigures();
  const live = useChargerLive(charger, null);
  const kwh = (v: number | null, digits = 1) => (v === null ? "—" : u.format(v, "kWh", "ev_energy_today_kwh", digits));
  const last = charger.last;
  return (
    <>
      <Facts
        items={[
          { label: live.charging ? "This charge" : "Last charge", value: live.charging ? kwh(live.chargeKwh, 2) : last ? kwh(last.kwh, 2) : "—" },
          { label: "Today", value: kwh(charger.todayKwh) },
          { label: "30 days", value: kwh(charger.kwh30, charger.kwh30 >= 100 ? 0 : 1) },
        ]}
      />
      {/* the last finished session */}
      <Facts
        items={[
          { label: "Duration", value: last ? span(last.durationS) : "—" },
          { label: "Peak power", value: last && last.peakKw !== null ? u.format(last.peakKw, "kW", "power_active_import_kw", 1) : "—" },
          { label: "Cost", value: last && last.cost !== null ? inr(last.cost) : "—" },
        ]}
      />
      <span className="mt-1.5 block truncate text-xs text-muted-foreground">
        {live.charging ? "Charging now" : last ? `Last session ${dayOf(last.startedAt)}, ${clockOf(last.startedAt)}` : "No session yet"}
        {ago ? ` · reading ${ago}` : ""}
      </span>
    </>
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
  const agoOf = (id: string) => {
    const iso = hub.states[id]?.lastReadAt ?? null;
    return iso && hub.clock > 0 ? agoText(hub.clock - Date.parse(iso)) : null;
  };
  return (
    <Widget className={className}>
      {/* (a phone has only the list) */}
      <div className="max-md:hidden">
        <Head icon={Server} tone={TONE.plain} title="Devices" note={summary} href="/dashboard/devices" />
      </div>

      {/* a phone: the devices as a list; pressing one goes to its page */}
      <ul className="-mx-2 -my-1 divide-y md:hidden">
        {rows.map((d) => {
          const Icon = DEVICE_ICON[d.kind];
          const charger = d.kind === "charger" ? chargers.find((c) => c.id === d.id) : undefined;
          const hasTab = tabs?.has(d.id) ?? false;
          const body = (
            <>
              <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", d.kind === "inverter" ? TONE.solar : d.kind === "charger" ? TONE.ev : TONE.plain)}>
                <Icon className="size-[18px]" />
              </span>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-sm font-medium text-foreground">{d.name}</span>
                {d.model ? <span className="block truncate text-xs text-muted-foreground">{d.model}</span> : null}
              </span>
              {charger ? <ChargerWord charger={charger} status={d.status} /> : <StatusWord status={d.status} />}
              {hasTab && <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />}
            </>
          );
          return (
            <li key={d.id}>
              {hasTab ? (
                <button type="button" onClick={() => tabs?.open(d.id)} aria-label={`Open ${d.name}`} className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left outline-none transition-colors active:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring">
                  {body}
                </button>
              ) : (
                <span className="flex items-center gap-3 px-2 py-2.5">{body}</span>
              )}
            </li>
          );
        })}
      </ul>

      {/* a tablet: the devices as icons with their state, and the whole tile opens the Devices page */}
      <span className="flex flex-1 flex-col max-md:hidden lg:hidden">
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

      {/* a wide screen: each device with its figures, its last reading and (a charger) its last session, as many as fit; pressing one opens its tab */}
      <ul ref={ref} className="-mx-2 mt-2 min-h-0 flex-1 divide-y overflow-hidden px-1 max-lg:hidden">
        {rows.slice(0, count).map((d) => {
          const Icon = DEVICE_ICON[d.kind];
          const charger = d.kind === "charger" ? chargers.find((c) => c.id === d.id) : undefined;
          const hasTab = tabs?.has(d.id) ?? false;
          const body = (
            <>
              <span className="flex items-center gap-3">
                <span className={cn("grid size-8 shrink-0 place-items-center rounded-xl", d.kind === "inverter" ? TONE.solar : d.kind === "charger" ? TONE.ev : TONE.plain)}>
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate text-sm font-medium text-foreground">{d.name}</span>
                  {d.model ? <span className="block truncate text-xs text-muted-foreground">{d.model}</span> : null}
                </span>
                {charger ? <ChargerWord charger={charger} status={d.status} /> : <StatusWord status={d.status} />}
              </span>
              {charger ? <ChargerFacts charger={charger} ago={agoOf(d.id)} /> : d.kind === "inverter" ? <InverterFacts device={d} ago={agoOf(d.id)} /> : <span className="mt-1.5 block truncate text-xs text-muted-foreground">{agoOf(d.id) ? `Last reading ${agoOf(d.id)}` : "No reading yet"}</span>}
            </>
          );
          return (
            <li key={d.id}>
              {hasTab ? (
                <button type="button" onClick={() => tabs?.open(d.id)} aria-label={`Open ${d.name}`} className="block w-full rounded-lg px-2 py-3 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring">
                  {body}
                </button>
              ) : (
                <span className="block px-2 py-3">{body}</span>
              )}
            </li>
          );
        })}
      </ul>
    </Widget>
  );
}

/** The customer's sites: the one being shown is ticked; pressing another shows that site's Overview (the same choice as the site switcher in the header). */
function SitesWidget({ sites, className }: { sites: SiteBoardSite[]; className?: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const { ref, count } = useFitRows(2);
  const choose = (id: string) =>
    startTransition(async () => {
      await selectSite(id);
      router.refresh();
    });
  return (
    <Widget className={className}>
      <Head icon={MapPin} tone={TONE.plain} title="Sites" note={`${sites.length} ${sites.length === 1 ? "site" : "sites"}`} arrow={false} />
      <ul ref={ref} className={cn("-mx-2 mt-2 min-h-0 flex-1 divide-y overflow-hidden px-1", pending && "opacity-60")}>
        {sites.slice(0, count).map((x) => (
          <li key={x.id}>
            <button
              type="button"
              onClick={() => (x.selected ? undefined : choose(x.id))}
              disabled={pending}
              aria-current={x.selected}
              aria-label={x.selected ? `${x.name}, showing` : `Show ${x.name}`}
              className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-sm font-medium text-foreground">{x.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {[x.place, `${x.deviceCount} ${x.deviceCount === 1 ? "device" : "devices"}`].filter(Boolean).join(" · ")}
                </span>
              </span>
              <Check className={cn("size-4 shrink-0 text-emerald-500", x.selected ? "opacity-100" : "opacity-0")} />
            </button>
          </li>
        ))}
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
      ? `${dayOf(last.startedAt)}, ${clockOf(last.startedAt)}`
      : live.offline
        ? "The charger is not answering"
        : "No charge yet";
  const fill = live.charging ? percent : live.offline ? null : lastPercent;
  const open = tabs?.has(charger.id) ? () => tabs.open(charger.id) : null;
  const elapsed = useElapsed(live.charging ? (charger.open?.startedAt ?? null) : null);

  return (
    <Widget className={className}>
      {/* the car: at the bottom right of a wide tile, beside the figure on a phone */}
      <Image
        src="/images/ev-car-nexon-v2.webp"
        alt=""
        width={1400}
        height={796}
        sizes="(max-width: 767px) 42vw, 24vw"
        className="pointer-events-none absolute right-3 h-auto select-none dark:brightness-125 dark:contrast-110 max-md:top-[3.75rem] max-md:w-[42%] md:bottom-3 md:w-[46%] md:max-w-[24rem]"
      />
      <span className="relative flex min-h-0 flex-1 flex-col">
        <Head icon={EvCharger} tone={TONE.ev} title={charger.name} note={note} arrow={open !== null} />
        <span className="mt-3 block max-w-[50%] max-md:flex max-md:min-h-[7rem] max-md:flex-col max-md:justify-center">
          <Figure value={figure.value} unit={figure.unit} large />
          <Sub>{sub}</Sub>
        </span>
        {/* a wide tile: the progress and today's energy under the figure */}
        <span className="mt-auto block max-w-[50%] pt-3 max-md:hidden">
          <span className="block h-2 overflow-hidden rounded-full bg-foreground/[0.08]" role="img" aria-label={fill === null ? "No charge to show" : `${Math.round(fill)}% of the charge`}>
            {fill !== null && fill > 0 && <span className={cn("block h-full rounded-full bg-emerald-500", live.charging && "motion-safe:animate-pulse")} style={{ width: `${Math.min(100, fill)}%` }} />}
          </span>
          <span className="mt-1.5 block truncate text-xs text-muted-foreground">Today {charger.todayKwh === null ? "—" : kwh(charger.todayKwh, 1)}</span>
        </span>
        {/* a phone: while it charges, the few figures that matter (the rest is on the charger's own page, which pressing the tile opens), then the control */}
        {live.charging && (
          <span className="block md:hidden">
            <Facts
              items={[
                { label: "Energy", value: live.chargeKwh === null ? "—" : kwh(live.chargeKwh, 2) },
                { label: "Duration", value: elapsed ?? "—" },
                { label: "Power", value: live.powerKw === null ? "—" : u.format(live.powerKw, "kW", "power_active_import_kw", 1) },
              ]}
            />
          </span>
        )}
        <EvTileControl charger={charger} charging={live.charging} offline={live.offline} className="md:hidden" />
      </span>
      {open && <button type="button" onClick={open} aria-label={`Open ${charger.name}`} className="absolute inset-0 cursor-pointer rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring" />}
    </Widget>
  );
}

/** The time since a charge began, in words, moved on every half minute (null when none runs). */
function useElapsed(startedAt: string | null): string | null {
  const [now, setNow] = React.useState<number | null>(null);
  React.useEffect(() => {
    if (!startedAt) return;
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, [startedAt]);
  if (!startedAt || now === null) return null;
  return span(Math.max(0, (now - Date.parse(startedAt)) / 1000));
}

/**
 * The charger's control inside its tile (a phone): before a charge the kWh to stop after (empty = no limit) beside the slide that starts it; while it runs
 * the slide that stops it. The same words and rules as the charger's own page. It sits above the tile's "open the charger" button, so using it does not
 * open the page.
 */
function EvTileControl({ charger, charging, offline, className }: { charger: SiteBoardCharger; charging: boolean; offline: boolean; className?: string }) {
  const { busy, waiting, error, notice, pending, start, stop } = useEvCharge({ chargerId: charger.id, sessionOpen: charger.open !== null, transactionId: charger.open?.transactionId ?? null });
  const [text, setText] = React.useState("");
  const typed = parseTarget(text);
  const empty = text.trim() === "";
  const bad = !empty && !typed.ok;
  const target = !empty && typed.ok ? typed.kwh : null;
  const on = charger.open !== null || charging;
  const stopping = busy === "stop";
  const starting = busy === "start" || waiting;
  const startDisabled = bad || starting || offline;
  const showField = !on && !starting && !offline;
  const slide = on
    ? stopping
      ? { label: "Stopping…", hint: "ending the charge" }
      : { label: "Slide to stop" }
    : starting
      ? { label: "Starting…", hint: "waiting for the charger" }
      : offline
        ? { label: "Charger offline", hint: "it cannot be started now" }
        : bad
          ? { label: "Check the limit", hint: "kWh as a number, or empty" }
          : { label: "Plugged in? Slide to start" };
  return (
    <span className={cn("relative z-10 mt-3 block", className)}>
      {error ? (
        <span role="alert" className="mb-2 block text-center text-xs text-destructive">
          {error}
        </span>
      ) : null}
      {notice ? (
        <span role="status" className="mb-2 block text-center text-xs text-amber-700 dark:text-amber-400">
          {notice}
        </span>
      ) : null}
      <span className="flex items-center gap-2.5">
        {showField && (
          <label className={cn("flex h-12 w-[6.75rem] shrink-0 items-center gap-1.5 rounded-2xl border bg-background px-3 text-sm tabular-nums", bad ? "border-destructive text-destructive" : "border-border focus-within:border-emerald-500")}>
            <input inputMode="decimal" value={text} onChange={(e) => setText(e.target.value)} placeholder="No limit" aria-label="Stop after this many kWh (empty for no limit)" className="min-w-0 flex-1 bg-transparent font-medium outline-none placeholder:font-normal placeholder:text-muted-foreground" />
            <span className="text-xs text-muted-foreground">kWh</span>
          </label>
        )}
        <SlideToConfirm
          className="min-w-0 flex-1"
          tone={on ? "stop" : "start"}
          label={slide.label}
          hint={slide.hint}
          busy={stopping || starting || pending}
          disabled={on ? false : startDisabled && !starting}
          ariaLabel={on ? "Slide to stop charging" : "Slide to start charging"}
          onConfirm={() => (on ? void stop() : void start(target))}
        />
      </span>
    </span>
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
 * The site's own Overview: every device together, as widgets. Solar now and today with the day's curve, the weather at the site, the devices (each with
 * its figures, its last reading and a charger's last session; pressing one opens its page), the customer's sites, the load, the grid, the battery (with
 * today's charging and discharging), the carbon dioxide avoided (with the part that went through the battery and into the car) and the charger with its
 * car. A widget is there only when the site has what it shows, and the tiles are laid out to fill a four-column grid whatever is there: the weather
 * widens (and shows the sunshine hour by hour) and the last small tile stretches when a cell would be left empty. On a wide screen the grid fits the
 * screen's height. On a phone the weather is the head of the page, as in a weather app (the place, the temperature large, the condition, high and low),
 * with the sunshine under it, then the devices and sites side by side, solar, load and grid, the battery, the charger and, last, the carbon dioxide. The
 * numbers are live (in place, no page refresh); the curves are today's 15-minute readings (one inverter).
 */
export function SiteOverviewBoard({
  siteId,
  siteName,
  place,
  location,
  savings,
  sites,
  devices,
  inverters,
  chargers,
  car,
  background,
}: {
  siteId: string;
  siteName: string;
  /** Where the site is, in a word (its city, else its name). */
  place: string | null;
  /** The site's saved position, for the map (null when none is saved). */
  location: { lat: number; lng: number } | null;
  /** What the solar and the car have saved since the start (null when it could not be worked out). */
  savings: SiteSavings | null;
  /** Every site of the customer. */
  sites: SiteBoardSite[];
  devices: SiteBoardDevice[];
  inverters: SiteBoardInverters | null;
  chargers: SiteBoardCharger[];
  car: CarProfile | null;
  /** The CSS of the person's own background (null for none): the tiles turn to frosted glass over it. */
  background: string | null;
}) {
  const weather = useSiteWeather(siteId);
  // the charger shown: the one that is charging, else the first
  const charger = chargers.find((c) => c.open !== null) ?? chargers[0] ?? null;
  const inv = inverters;

  // the small tiles in the order of a wide screen; `phone` is where each stands on a phone (see the order of the others below) and how wide it is there
  const smalls: { key: string; phone: string; render: (className: string) => React.ReactNode }[] = [];
  if (inv) {
    smalls.push({ key: "load", phone: "order-[6] min-h-40", render: (c) => <LoadWidget inv={inv} className={c} /> });
    if (inv.hasGrid) smalls.push({ key: "grid", phone: "order-[7] min-h-40", render: (c) => <GridWidget inv={inv} className={c} /> });
    if (inv.hasBattery) smalls.push({ key: "battery", phone: "order-[8] max-md:col-span-2 min-h-48", render: (c) => <BatteryWidget inv={inv} className={c} /> });
    smalls.push({ key: "co2", phone: "order-[12] max-md:col-span-2 min-h-52", render: (c) => <Co2Widget inv={inv} savings={savings} car={car} className={c} /> });
  } else if (charger) {
    smalls.push({ key: "month", phone: "order-[6] min-h-40", render: (c) => <EvMonthWidget charger={charger} className={c} /> });
  }
  smalls.push({ key: "sites", phone: "max-md:hidden min-h-44", render: (c) => <SitesWidget sites={sites} className={c} /> });

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
      {/* a phone: the weather as the head of the page, and the sunshine under it */}
      <WeatherHero state={weather} place={place} siteName={siteName} className="order-[1] col-span-2 md:hidden" />
      <SunshineTile state={weather} className="order-[2] col-span-2 md:hidden" />

      {inv && <SolarWidget inv={inv} className={cn("order-[5] col-span-2 min-h-56 md:order-none md:min-h-0", solarTall && "md:row-span-2")} />}
      {/* a tablet and wider: the weather as a tile */}
      <WeatherWidget state={weather} place={place} wide={weatherWide} className={cn("max-md:hidden md:min-h-0", weatherWide && "md:col-span-2")} />
      <DevicesWidget devices={devices} chargers={chargers} className={cn("order-[3] max-md:col-span-2 md:order-none md:col-start-4 md:row-span-2 md:min-h-0", weatherWide ? "md:row-start-2" : "md:row-start-1")} />
      {smalls.map((x, i) => (
        <React.Fragment key={x.key}>{x.render(cn(x.phone, "md:order-none md:min-h-0", i === smalls.length - 1 && lastSpan))}</React.Fragment>
      ))}
      {/* a phone: the site on a 3D map, and the cost and savings, above the carbon dioxide */}
      <SiteMapCard latitude={location?.lat ?? null} longitude={location?.lng ?? null} siteName={siteName} className="order-[10] col-span-2 h-72 md:hidden" />
      {inv && <SavingsWidget savings={savings} className="order-[11] col-span-2 min-h-56 md:hidden" />}
      {charger && <EvWidget charger={charger} car={car} className={cn("order-[9] col-span-2 min-h-52 md:order-none md:min-h-0", evBig && "md:row-span-2")} />}
    </div>
  );
}
