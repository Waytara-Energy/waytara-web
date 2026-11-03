"use client";

import * as React from "react";
import { Check, Play, PlugZap, Square, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

// Four small pictures of the product for the Our Approach cells. Each one answers the mouse (or a finger) and settles back to a
// resting state when the cursor leaves. The figures shown are illustrations, not live readings.

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Where the pointer is across an element, 0 to 1 on each axis, or null while it is away. */
function usePointerRatio() {
  const ref = React.useRef<HTMLDivElement>(null);
  const [ratio, setRatio] = React.useState<{ x: number; y: number } | null>(null);
  const move = React.useCallback((e: React.PointerEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r || r.width === 0 || r.height === 0) return;
    setRatio({ x: clamp01((e.clientX - r.left) / r.width), y: clamp01((e.clientY - r.top) / r.height) });
  }, []);
  const leave = React.useCallback(() => setRatio(null), []);
  return { ref, ratio, handlers: { onPointerMove: move, onPointerDown: move, onPointerLeave: leave } };
}

const STAGE = "relative flex h-[22rem] w-full touch-pan-y select-none items-center justify-center";
const WIDTH = "w-full max-w-[24rem]";

function MiniCard({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn(WIDTH, "relative rounded-xl border border-theme-border bg-theme-surface p-4 text-left shadow-[0_10px_28px_-14px_rgba(16,24,40,0.22)] dark:shadow-[0_10px_28px_-14px_rgba(0,0,0,0.7)]", className)}>{children}</div>
  );
}

/** A small rounded badge with a coloured dot. */
function Badge({ children, tone = "ok", className }: { children: React.ReactNode; tone?: "ok" | "warn"; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-theme-border bg-theme-surface px-3 py-1 text-xs font-medium text-theme-primary shadow-sm", className)}>
      <span className={cn("size-1.5 rounded-full", tone === "ok" ? "bg-emerald-500" : "bg-amber-500")} />
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------------------------- inverter: a day of solar, as bars

const SOLAR_KW = [0.2, 0.9, 2.1, 3.6, 4.9, 5.8, 6.2, 5.9, 5.0, 3.7, 2.2, 0.9, 0.2]; // 6 am to 6 pm
const SOLAR_MAX = 7;
const PEAK = SOLAR_KW.indexOf(Math.max(...SOLAR_KW));

const hourLabel = (i: number) => {
  const h = 6 + i;
  return h < 12 ? `${h} am` : h === 12 ? "12 pm" : `${h - 12} pm`;
};

export function InverterVignette() {
  const { ref, ratio, handlers } = usePointerRatio();
  const idx = ratio ? Math.min(SOLAR_KW.length - 1, Math.floor(ratio.x * SOLAR_KW.length)) : PEAK;

  return (
    <div ref={ref} aria-hidden="true" className={STAGE} {...handlers}>
      <div className={WIDTH}>
        <div className="flex items-end justify-between">
          <div>
            <p className="flex items-center gap-1.5 text-xs text-theme-secondary">
              <Sun className="size-3.5 text-amber-500" />
              Solar generation
            </p>
            <p className="mt-1 text-3xl font-semibold tracking-tight text-theme-primary tabular-nums">
              {SOLAR_KW[idx].toFixed(1)} <span className="text-base font-medium text-theme-secondary">kW</span>
            </p>
          </div>
          <span className="rounded-full border border-theme-border bg-theme-surface px-2.5 py-0.5 text-xs font-medium text-theme-primary shadow-sm tabular-nums">{hourLabel(idx)}</span>
        </div>

        <div className="relative mt-6 h-40">
          {[0, 0.33, 0.66].map((g) => (
            <span key={g} className="absolute inset-x-0 h-px bg-black/[0.06] dark:bg-white/10" style={{ top: `${g * 100}%` }} />
          ))}
          <div className="absolute inset-0 flex items-end gap-1.5 border-b border-theme-border">
            {SOLAR_KW.map((kw, i) => (
              <div key={i} className="flex h-full flex-1 items-end">
                <div
                  className={cn("w-full rounded-t-md bg-gradient-to-t from-orange-500 to-amber-300 transition-opacity duration-150", i === idx ? "opacity-100" : "opacity-35")}
                  style={{ height: `${Math.max(3, (kw / SOLAR_MAX) * 100)}%` }}
                />
              </div>
            ))}
          </div>
        </div>
        <div className="mt-2 flex justify-between text-[11px] text-theme-muted">
          <span>6 am</span>
          <span>12 pm</span>
          <span>6 pm</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------- battery: the battery itself

const CELLS = 5;

export function BatteryVignette() {
  const { ref, ratio, handlers } = usePointerRatio();
  const pct = ratio ? Math.round(ratio.x * 100) : 82;
  const tone = pct >= 40 ? "bg-emerald-500" : pct >= 20 ? "bg-amber-500" : "bg-rose-500";

  return (
    <div ref={ref} aria-hidden="true" className={STAGE} {...handlers}>
      <div className="flex flex-col items-center">
        <p className="text-3xl font-semibold tracking-tight text-theme-primary tabular-nums">{pct}%</p>
        <p className="mt-1 text-xs text-theme-secondary">Charge level</p>

        <div className="relative mt-7 h-28 w-64 rounded-2xl border-[5px] border-zinc-800 p-1.5 dark:border-zinc-300">
          <span className="absolute -right-[15px] top-1/2 h-10 w-[9px] -translate-y-1/2 rounded-r-md bg-zinc-800 dark:bg-zinc-300" />
          <div className="flex h-full gap-1.5">
            {Array.from({ length: CELLS }, (_, i) => {
              const fill = clamp01((pct - (i * 100) / CELLS) / (100 / CELLS));
              return (
                <div key={i} className="h-full flex-1 overflow-hidden rounded-md bg-black/[0.06] dark:bg-white/10">
                  <div className={cn("h-full transition-[width,background-color] duration-150 ease-out", tone)} style={{ width: `${fill * 100}%` }} />
                </div>
              );
            })}
          </div>
        </div>

        <Badge tone={pct >= 20 ? "ok" : "warn"} className="mt-7">
          {pct >= 20 ? "Backup ready" : "Charge soon"}
        </Badge>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------- EV charger: this session and past ones

const PAST_SESSIONS = [
  { when: "Yesterday", kwh: "18.4 kWh", time: "2 h 10 m" },
  { when: "Monday", kwh: "12.1 kWh", time: "1 h 25 m" },
  { when: "Sunday", kwh: "22.0 kWh", time: "2 h 40 m" },
];
const SESSION_KWH = 24;

export function EvChargerVignette() {
  const { ref, ratio, handlers } = usePointerRatio();
  // null while charging; the level it was stopped at otherwise
  const [stoppedAt, setStoppedAt] = React.useState<number | null>(null);
  const live = ratio ? Math.round(ratio.x * 100) : 62;
  const pct = stoppedAt ?? live;
  const stopped = stoppedAt !== null;

  return (
    <div ref={ref} aria-hidden="true" className={STAGE} {...handlers}>
      <MiniCard>
        <div className="flex items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <PlugZap className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-theme-primary">EV charger</p>
            <p className="text-[11px] text-theme-secondary">Current session</p>
          </div>
          <Badge tone={stopped ? "warn" : "ok"}>{stopped ? "Stopped" : "Charging from solar"}</Badge>
        </div>

        <div className="mt-4 flex items-baseline justify-between">
          <span className="text-2xl font-semibold tracking-tight text-theme-primary tabular-nums">{pct}%</span>
          <span className="text-xs text-theme-secondary tabular-nums">{((pct / 100) * SESSION_KWH).toFixed(1)} kWh</span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/10">
          <div className={cn("h-full rounded-full transition-[width,background-color] duration-150 ease-out", stopped ? "bg-amber-500" : "bg-emerald-500")} style={{ width: `${pct}%` }} />
        </div>

        <button
          type="button"
          tabIndex={-1}
          onClick={() => setStoppedAt(stopped ? null : pct)}
          className={cn(
            "mt-3 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border text-xs font-medium transition-colors",
            stopped
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-300"
              : "border-rose-500/30 bg-rose-500/[0.07] text-rose-700 hover:bg-rose-500/[0.12] dark:text-rose-300",
          )}
        >
          {stopped ? <Play className="size-3.5" /> : <Square className="size-3.5" />}
          {stopped ? "Resume charging" : "Stop charging"}
        </button>

        <p className="mt-4 text-[11px] font-medium uppercase tracking-wide text-theme-muted">Past sessions</p>
        <ul className="mt-1.5 divide-y divide-theme-border">
          {PAST_SESSIONS.map((s) => (
            <li key={s.when} className="flex items-center justify-between py-1.5 text-xs">
              <span className="flex items-center gap-2 text-theme-primary">
                <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                {s.when}
              </span>
              <span className="tabular-nums text-theme-secondary">
                {s.kwh} · {s.time}
              </span>
            </li>
          ))}
        </ul>
      </MiniCard>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------- dashboard: one app, many sites

interface Device {
  name: string;
  online: boolean;
}
interface Site {
  name: string;
  devices: Device[];
}

const SITES: Site[] = [
  {
    name: "Home",
    devices: [
      { name: "Solar inverter", online: true },
      { name: "Battery", online: true },
      { name: "EV charger", online: true },
    ],
  },
  {
    name: "Office",
    devices: [
      { name: "Solar inverter", online: true },
      { name: "Battery", online: true },
      { name: "Grid meter", online: true },
      { name: "EV charger", online: true },
    ],
  },
  {
    name: "Warehouse",
    devices: [
      { name: "Solar inverter", online: true },
      { name: "Battery", online: true },
      { name: "EV charger", online: false },
      { name: "Grid meter", online: true },
    ],
  },
];
const inactiveCount = (site: Site) => site.devices.filter((d) => !d.online).length;
const REST = SITES.length - 1; // rests on the site with an inactive device, so it shows at a glance

export function DashboardVignette() {
  const [sel, setSel] = React.useState(REST);
  const site = SITES[sel];
  const inactive = inactiveCount(site);

  return (
    <div aria-hidden="true" className={STAGE} onPointerLeave={() => setSel(REST)}>
      <MiniCard className="mb-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-theme-primary">Your sites</p>
          <span className="text-[11px] text-theme-secondary">{SITES.length} sites</span>
        </div>

        <div className="mt-3 grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            {SITES.map((s, i) => {
              const off = inactiveCount(s);
              return (
                <div
                  key={s.name}
                  onPointerEnter={() => setSel(i)}
                  onPointerDown={() => setSel(i)}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-xs transition-colors duration-150",
                    sel === i ? "border-emerald-500/50 bg-emerald-500/10" : "border-theme-border",
                  )}
                >
                  <p className="font-medium text-theme-primary">{s.name}</p>
                  <p className={cn("mt-0.5 text-[11px]", off ? "text-amber-600 dark:text-amber-400" : "text-theme-secondary")}>{off ? `${off} inactive` : "All online"}</p>
                </div>
              );
            })}
          </div>

          <div className="rounded-lg border border-theme-border px-3 py-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-theme-muted">{site.name}</p>
            <ul className="mt-1.5 space-y-1.5">
              {site.devices.map((d) => (
                <li key={d.name} className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className={cn("size-1.5 shrink-0 rounded-full", d.online ? "bg-emerald-500" : "bg-rose-500")} />
                    <span className={cn("truncate", d.online ? "text-theme-primary" : "text-theme-secondary")}>{d.name}</span>
                  </span>
                  <span className={cn("shrink-0", d.online ? "text-theme-secondary" : "font-medium text-rose-600 dark:text-rose-400")}>{d.online ? "Online" : "Inactive"}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-6" />
        <Badge tone={inactive ? "warn" : "ok"} className="absolute -bottom-3 left-1/2 -translate-x-1/2">
          {inactive ? `${inactive} device inactive, one app` : "All devices online, one app"}
        </Badge>
      </MiniCard>
    </div>
  );
}
