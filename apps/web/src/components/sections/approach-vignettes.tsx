"use client";

import * as React from "react";
import { BatteryCharging, PlugZap } from "lucide-react";
import { cn } from "@/lib/utils";

// Four small pictures of the product for the Our Approach columns. Each one answers the mouse (or a finger): the cursor's
// position across the picture drives it, and it settles back to a resting state when the cursor leaves. The figures shown are
// illustrations, not live readings.

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

const STAGE = "relative flex h-60 w-full touch-pan-y select-none items-center justify-center";

function MiniCard({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("relative w-full max-w-[14.5rem] rounded-xl text-left border border-theme-border bg-theme-surface p-4 shadow-[0_10px_28px_-14px_rgba(16,24,40,0.22)] dark:shadow-[0_10px_28px_-14px_rgba(0,0,0,0.7)]", className)}>{children}</div>;
}

/** A small badge that overlaps the bottom edge of a card, like the reference. */
function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-theme-border bg-theme-surface px-3 py-1 text-xs font-medium text-theme-primary shadow-sm", className)}>
      <span className="size-1.5 rounded-full bg-emerald-500" />
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------------------------- inverter: a day of solar

const SOLAR_KW = [0.2, 0.9, 2.1, 3.6, 4.9, 5.8, 6.2, 5.9, 5.0, 3.7, 2.2, 0.9, 0.2]; // 6 am to 6 pm
const CHART_W = 220;
const CHART_H = 84;
const CHART_MAX = 7;
const POINTS = SOLAR_KW.map((v, i) => ({ x: (i / (SOLAR_KW.length - 1)) * CHART_W, y: CHART_H - 4 - (v / CHART_MAX) * (CHART_H - 12) }));
const LINE = POINTS.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
const AREA = `0,${CHART_H} ${LINE} ${CHART_W},${CHART_H}`;
const PEAK = SOLAR_KW.indexOf(Math.max(...SOLAR_KW));

const hourLabel = (i: number) => {
  const h = 6 + i;
  return h < 12 ? `${h} am` : h === 12 ? "12 pm" : `${h - 12} pm`;
};

export function InverterVignette() {
  const { ref, ratio, handlers } = usePointerRatio();
  const idx = ratio ? Math.round(ratio.x * (SOLAR_KW.length - 1)) : PEAK;
  const p = POINTS[idx];
  const tipLeft = Math.min(86, Math.max(14, (p.x / CHART_W) * 100));

  return (
    <div ref={ref} aria-hidden="true" className={STAGE} {...handlers}>
      <div className="w-full max-w-[15rem]">
        <p className="text-center text-3xl font-semibold tracking-tight text-theme-primary tabular-nums">{SOLAR_KW[idx].toFixed(1)} kW</p>
        <p className="mt-0.5 text-center text-xs text-theme-secondary">Solar generation</p>

        <div className="relative mt-8">
          <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="block h-auto w-full overflow-visible">
            <defs>
              <linearGradient id="vig-solar-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="rgb(16 185 129)" stopOpacity="0.22" />
                <stop offset="100%" stopColor="rgb(16 185 129)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0.25, 0.5, 0.75].map((g) => (
              <line key={g} x1="0" x2={CHART_W} y1={CHART_H * g} y2={CHART_H * g} stroke="currentColor" strokeOpacity="0.08" className="text-theme-primary" />
            ))}
            <polygon points={AREA} fill="url(#vig-solar-fill)" />
            <polyline points={LINE} fill="none" stroke="rgb(16 185 129)" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
            <g style={{ transform: `translate(${p.x}px, 0)`, transition: "transform 150ms ease-out" }}>
              <line x1="0" x2="0" y1="0" y2={CHART_H} stroke="rgb(16 185 129)" strokeOpacity="0.35" strokeDasharray="3 3" />
            </g>
            <g style={{ transform: `translate(${p.x}px, ${p.y}px)`, transition: "transform 150ms ease-out" }}>
              <circle r="7" fill="rgb(16 185 129)" fillOpacity="0.18" />
              <circle r="3.5" fill="rgb(16 185 129)" stroke="white" strokeWidth="1.5" />
            </g>
          </svg>
          <span
            className="absolute -translate-x-1/2 -translate-y-[calc(100%+12px)] whitespace-nowrap rounded-full border border-theme-border bg-theme-surface px-2.5 py-0.5 text-xs font-medium text-theme-primary shadow-sm transition-[left,top] duration-150 ease-out"
            style={{ left: `${tipLeft}%`, top: `${(p.y / CHART_H) * 100}%` }}
          >
            {hourLabel(idx)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------- battery: a ring that fills

const RING_R = 46;
const RING_C = 2 * Math.PI * RING_R;

export function BatteryVignette() {
  const { ref, ratio, handlers } = usePointerRatio();
  const pct = ratio ? Math.round(ratio.x * 100) : 82;

  return (
    <div ref={ref} aria-hidden="true" className={STAGE} {...handlers}>
      <div className="flex flex-col items-center">
        <div className="relative size-40">
          <span className="absolute inset-4 rounded-full bg-emerald-400/20 blur-2xl dark:bg-emerald-500/15" />
          <svg viewBox="0 0 120 120" className="relative size-full -rotate-90">
            <circle cx="60" cy="60" r={RING_R} fill="none" stroke="rgb(16 185 129)" strokeOpacity="0.15" strokeWidth="7" />
            <circle
              cx="60"
              cy="60"
              r={RING_R}
              fill="none"
              stroke="rgb(16 185 129)"
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={`${(RING_C * pct) / 100} ${RING_C}`}
              style={{ transition: "stroke-dasharray 180ms ease-out" }}
            />
          </svg>
          <div className="absolute inset-[18px] flex flex-col items-center justify-center rounded-full border border-theme-border bg-theme-surface shadow-[0_8px_20px_-10px_rgba(16,24,40,0.3)]">
            <BatteryCharging className="size-4 text-emerald-600 dark:text-emerald-400" />
            <span className="mt-1 text-2xl font-semibold leading-none tracking-tight text-theme-primary tabular-nums">{pct}%</span>
            <span className="mt-1 text-[11px] text-theme-secondary">Charge</span>
          </div>
        </div>
        <Badge className="mt-4">{pct >= 20 ? "Backup ready" : "Charge soon"}</Badge>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------- EV charger: a session

export function EvChargerVignette() {
  const { ref, ratio, handlers } = usePointerRatio();
  const pct = ratio ? Math.round(ratio.x * 100) : 62;

  return (
    <div ref={ref} aria-hidden="true" className={STAGE} {...handlers}>
      <MiniCard className="mb-4">
        <div className="flex items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <PlugZap className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-theme-primary">EV charger</p>
            <span className="mt-1 block h-1.5 w-16 rounded-full bg-black/[0.06] dark:bg-white/10" />
          </div>
          <span className="text-sm font-semibold text-theme-primary tabular-nums">{pct}%</span>
        </div>

        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/10">
          <div className="h-full rounded-full bg-emerald-500 transition-[width] duration-150 ease-out" style={{ width: `${pct}%` }} />
        </div>

        <div className="mt-4 space-y-2">
          <span className="block h-1.5 w-full rounded-full bg-black/[0.05] dark:bg-white/[0.07]" />
          <span className="block h-1.5 w-2/3 rounded-full bg-black/[0.05] dark:bg-white/[0.07]" />
        </div>
        <div className="mt-6" />
        <Badge className="absolute -bottom-3 left-1/2 -translate-x-1/2">{pct >= 100 ? "Fully charged" : "Charging from solar"}</Badge>
      </MiniCard>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------- dashboard: one app, many sites

const SITES = [
  { name: "Home", devices: 3 },
  { name: "Office", devices: 4 },
  { name: "Warehouse", devices: 6 },
];

export function DashboardVignette() {
  const [sel, setSel] = React.useState(0);

  return (
    <div aria-hidden="true" className={STAGE} onPointerLeave={() => setSel(0)}>
      <MiniCard className="mb-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-theme-primary">Your sites</p>
          <span className="h-1.5 w-10 rounded-full bg-black/[0.06] dark:bg-white/10" />
        </div>
        <div className="mt-3 space-y-2">
          {SITES.map((site, i) => (
            <div
              key={site.name}
              onPointerEnter={() => setSel(i)}
              onPointerDown={() => setSel(i)}
              className={cn(
                "flex items-center justify-between rounded-lg border px-3 py-2 text-xs transition-colors duration-150",
                sel === i ? "border-emerald-500/50 bg-emerald-500/10 text-theme-primary" : "border-theme-border text-theme-secondary",
              )}
            >
              <span className="flex items-center gap-2 font-medium">
                <span className={cn("size-1.5 rounded-full transition-colors", sel === i ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-600")} />
                {site.name}
              </span>
              <span className="tabular-nums">{site.devices} devices</span>
            </div>
          ))}
        </div>
        <div className="mt-6" />
        <Badge className="absolute -bottom-3 left-1/2 -translate-x-1/2">{SITES[sel].devices} devices, one app</Badge>
      </MiniCard>
    </div>
  );
}
