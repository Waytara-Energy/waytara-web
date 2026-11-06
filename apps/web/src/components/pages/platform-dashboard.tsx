"use client";

import * as React from "react";
import { BatteryCharging, FileText, Home, LayoutDashboard, PiggyBank, Plug, Sun, Zap, EvCharger } from "lucide-react";
import { cn } from "@/lib/utils";
import { CAR_BODY, CAR_BODY_INNER, CAR_BODY_OUTER, CAR_VIEWBOX, CAR_WHEELS, CAR_X0, CAR_X1 } from "@/components/sections/ev-car-art";

/**
 * The customer dashboard on the Platform page: a home with solar, a battery, the grid and an EV charger, drawn as one calm window. The figures are a single
 * made-up afternoon (nothing comes from a customer or a device). Everything moves once the window scrolls into view: the numbers count up, the solar curve draws
 * itself, the energy flows along its lines, the battery ring and the car fill. Hover the solar chart to read it. The moving parts are CSS (see the wd-* keyframes
 * in globals.css) and stop for visitors who ask for less motion.
 */

const NOW_H = 14.25;
const CAR_PCT = 62;
const SESSION_KWH = 24;
const BATTERY_PCT = 82;
const CAR_INSET = 11;
const CAR_SPAN = CAR_X1 - CAR_X0;

// ------------------------------------------------------------------------------------------ the made-up day

const solarAt = (h: number) => (h < 6.5 || h > 19 ? 0 : 6.4 * Math.pow(Math.sin((Math.PI * (h - 6.5)) / 12.5), 2) * (0.97 + 0.03 * Math.sin(h * 6.3)));

const STEP = 0.25;
const DAY: { h: number; kw: number }[] = [];
for (let h = 6; h <= 19.0001; h += STEP) DAY.push({ h, kw: solarAt(h) });
const NOW_INDEX = DAY.findIndex((p) => p.h >= NOW_H);
const SOLAR_NOW = Math.round(solarAt(NOW_H) * 10) / 10;
const SOLAR_TODAY = Math.round(DAY.slice(0, NOW_INDEX + 1).reduce((s, p) => s + p.kw * STEP, 0) * 10) / 10;
const SAVED_TODAY = Math.round(SOLAR_TODAY * 9);
const CAR_KW = 4.0;
const HOME_KW = 1.2;
const BATTERY_KW = Math.max(0, Math.round((SOLAR_NOW - CAR_KW - HOME_KW) * 10) / 10);

const clock = (h: number) => {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${hh % 12 === 0 ? 12 : hh % 12}:${String(mm).padStart(2, "0")} ${hh < 12 ? "AM" : "PM"}`;
};

// ------------------------------------------------------------------------------------------ motion helpers

/** True once the element has been on screen (and stays true). */
function useSeen<T extends HTMLElement>() {
  const ref = React.useRef<T>(null);
  const [seen, setSeen] = React.useState(false);
  React.useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      void Promise.resolve().then(() => setSeen(true));
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.25 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, seen] as const;
}

/** A number that counts up to its value when `go` turns true (straight to it for visitors who ask for less motion). */
function useCount(target: number, go: boolean, ms = 1600) {
  const [value, setValue] = React.useState(0);
  React.useEffect(() => {
    if (!go) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      void Promise.resolve().then(() => setValue(target));
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / ms);
      setValue(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, go, ms]);
  return value;
}

const CARD = "rounded-2xl border border-theme-border bg-theme-surface";
const LABEL = "text-[0.8rem] font-semibold text-theme-secondary";

// ------------------------------------------------------------------------------------------ the energy flow

const NODES = {
  solar: { x: 17.2, y: 22 },
  grid: { x: 82.8, y: 22 },
  home: { x: 50, y: 52 },
  battery: { x: 17.2, y: 82 },
  car: { x: 82.8, y: 82 },
};

function FlowNode({ at, icon: Icon, label, value, tone, big = false, pulse = false }: { at: { x: number; y: number }; icon: typeof Sun; label: string; value: string; tone: string; big?: boolean; pulse?: boolean }) {
  return (
    <div className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center" style={{ left: `${at.x}%`, top: `${at.y}%` }}>
      <span className={cn("relative flex items-center justify-center rounded-full border bg-theme-bg shadow-sm", big ? "size-[clamp(3.25rem,12cqw,5.25rem)]" : "size-[clamp(2.5rem,9cqw,4rem)]", tone)}>
        {pulse && <span aria-hidden="true" className="wd-pulse absolute inset-0 rounded-full border border-emerald-500/50" />}
        <Icon className={big ? "size-[45%]" : "size-[48%]"} strokeWidth={1.6} aria-hidden="true" />
      </span>
      <span className="mt-1.5 text-[clamp(0.8rem,1.9cqw,0.85rem)] font-semibold text-theme-primary">{label}</span>
      <span className="text-[clamp(0.74rem,1.8cqw,0.8rem)] tabular-nums text-theme-secondary">{value}</span>
    </div>
  );
}

function FlowCard({ seen }: { seen: boolean }) {
  const solar = useCount(SOLAR_NOW, seen);
  const car = useCount(CAR_KW, seen);
  const home = useCount(HOME_KW, seen);
  const battery = useCount(BATTERY_KW, seen);
  const line = (d: string, color: string, width: number, flowing: boolean) => (
    <g key={d}>
      <path d={d} fill="none" stroke={color} strokeOpacity={flowing ? 0.18 : 0.35} strokeWidth={width} strokeLinecap="round" />
      {flowing && seen && <path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeDasharray="2 18" className="wd-flow" />}
    </g>
  );
  return (
    <div className={cn(CARD, "p-5 sm:p-6")}>
      <div className="flex items-center justify-between gap-3">
        <p className={LABEL}>Right now</p>
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
          <span className="relative flex size-2">
            <span className="wd-ping absolute inline-flex size-full rounded-full bg-emerald-500/60" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
          </span>
          Live
        </span>
      </div>
      <div className="relative mt-3 aspect-[640/340] w-full [container-type:inline-size]">
        <svg viewBox="0 0 640 340" className="absolute inset-0 size-full" aria-hidden="true">
          {line("M110 75 C 110 150, 210 177, 320 177", "#10b981", 4, true)}
          {line("M320 177 C 440 177, 530 200, 530 279", "#10b981", 5, true)}
          {line("M320 177 C 210 177, 110 200, 110 279", "#10b981", 3, true)}
          {line("M530 75 C 530 150, 430 177, 320 177", "#94a3b8", 3, false)}
        </svg>
        <FlowNode at={NODES.solar} icon={Sun} label="Solar" value={`${solar.toFixed(1)} kW`} tone="border-emerald-500/50 text-emerald-600 dark:text-emerald-400" pulse />
        <FlowNode at={NODES.grid} icon={Zap} label="Grid" value="Not needed" tone="border-theme-border text-theme-muted" />
        <FlowNode at={NODES.home} icon={Home} label="Your home" value={`${home.toFixed(1)} kW`} tone="border-blue-500/50 text-blue-600 dark:text-blue-400" big />
        <FlowNode at={NODES.battery} icon={BatteryCharging} label="Battery" value={`+${battery.toFixed(1)} kW`} tone="border-emerald-500/50 text-emerald-600 dark:text-emerald-400" />
        <FlowNode at={NODES.car} icon={EvCharger} label="Your car" value={`${car.toFixed(1)} kW`} tone="border-emerald-500/50 text-emerald-600 dark:text-emerald-400" />
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------------------ today's solar curve

const CW = 400;
const CH = 150;
const maxKw = 6.8;
const px = (h: number) => ((h - 6) / 13) * CW;
const py = (kw: number) => CH - (kw / maxKw) * (CH - 10) - 2;

const smooth = (pts: { h: number; kw: number }[]) => pts.map((p, i) => `${i === 0 ? "M" : "L"}${px(p.h).toFixed(1)} ${py(p.kw).toFixed(1)}`).join(" ");
const PAST = DAY.slice(0, NOW_INDEX + 1);
const AHEAD = DAY.slice(NOW_INDEX);
const PAST_LINE = smooth(PAST);
const PAST_AREA = `${PAST_LINE} L${px(PAST[PAST.length - 1].h).toFixed(1)} ${CH} L${px(6)} ${CH} Z`;
const AHEAD_LINE = smooth(AHEAD);

function SolarCard({ seen }: { seen: boolean }) {
  const today = useCount(SOLAR_TODAY, seen);
  const [hover, setHover] = React.useState<number | null>(null);
  const uid = React.useId().replace(/[^a-zA-Z0-9]/g, "");
  const shown = hover === null ? PAST[PAST.length - 1] : PAST[hover];
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const h = 6 + ((e.clientX - r.left) / r.width) * 13;
    setHover(Math.max(0, Math.min(PAST.length - 1, Math.round((h - 6) / STEP))));
  };
  return (
    <div className={cn(CARD, "flex flex-col p-5 sm:p-6")}>
      <p className={LABEL}>Sunshine collected today</p>
      <p className="mt-2 flex items-baseline gap-1.5 tabular-nums">
        <span className="text-4xl font-bold leading-none tracking-tight text-theme-primary">{today.toFixed(1)}</span>
        <span className="text-sm text-theme-secondary">kWh</span>
      </p>
      <p className="mt-1 text-xs tabular-nums text-theme-muted">
        {shown.kw.toFixed(1)} kW at {clock(shown.h)}
      </p>
      <div className="relative mt-4 flex-1 cursor-crosshair touch-none" style={{ minHeight: 120 }} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${CW} ${CH}`} preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible" aria-hidden="true">
          <defs>
            <linearGradient id={`g${uid}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={f} x1="0" x2={CW} y1={CH * f} y2={CH * f} stroke="currentColor" strokeOpacity="0.08" vectorEffect="non-scaling-stroke" className="text-theme-primary" />
          ))}
          <g className={seen ? "wd-draw" : "wd-hidden"}>
            <path d={PAST_AREA} fill={`url(#g${uid})`} />
            <path d={PAST_LINE} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </g>
          <path d={AHEAD_LINE} fill="none" stroke="#10b981" strokeOpacity="0.45" strokeWidth="2" strokeDasharray="3 5" vectorEffect="non-scaling-stroke" className={seen ? "wd-fade" : "wd-hidden"} />
        </svg>
        {/* the marker: it sits on the newest reading, or follows the pointer */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-emerald-500 shadow dark:border-zinc-900"
          style={{ left: `${(px(shown.h) / CW) * 100}%`, top: `${(py(shown.kw) / CH) * 100}%`, opacity: seen ? 1 : 0, transition: "left 120ms, top 120ms, opacity 600ms 1.4s" }}
        />
      </div>
      <div className="mt-2 flex justify-between text-[0.68rem] tabular-nums text-theme-muted" aria-hidden="true">
        <span>6 AM</span>
        <span>12 PM</span>
        <span>7 PM</span>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------------------ battery, car, savings

function BatteryCard({ seen }: { seen: boolean }) {
  const pct = useCount(BATTERY_PCT, seen);
  const R = 46;
  const C = 2 * Math.PI * R;
  return (
    <div className={cn(CARD, "p-5 sm:p-6")}>
      <p className={LABEL}>Battery</p>
      <div className="mt-3 flex items-center gap-5">
        <div className="relative size-[7.5rem] shrink-0">
          <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden="true">
            <circle cx="60" cy="60" r={R} fill="none" stroke="currentColor" strokeOpacity="0.1" strokeWidth="10" className="text-theme-primary" />
            <circle
              cx="60"
              cy="60"
              r={R}
              fill="none"
              stroke="#10b981"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={seen ? C * (1 - BATTERY_PCT / 100) : C}
              className="wd-t"
              style={{ transition: "stroke-dashoffset 1.8s cubic-bezier(.2,.7,.2,1)" }}
            />
          </svg>
          <p className="absolute inset-0 flex items-center justify-center text-2xl font-bold tabular-nums text-theme-primary">
            {Math.round(pct)}
            <span className="text-sm font-medium text-theme-secondary">%</span>
          </p>
        </div>
        <div>
          <p className="text-base font-semibold text-theme-primary">Filling up from the sun</p>
          <p className="mt-1 text-sm leading-relaxed text-theme-secondary">Ready for this evening.</p>
        </div>
      </div>
    </div>
  );
}

/** The side-view EV the landing page uses, filled like a battery from the rear to the nose. */
function Car({ level }: { level: number }) {
  const uid = React.useId().replace(/:/g, "");
  const clipId = `wdcar-clip-${uid}`;
  const gradId = `wdcar-grad-${uid}`;
  return (
    <svg viewBox={CAR_VIEWBOX} className="block h-auto w-full overflow-visible" aria-hidden="true">
      <defs>
        <clipPath id={clipId}>
          <path d={CAR_BODY_OUTER} />
        </clipPath>
        <linearGradient id={gradId} gradientUnits="userSpaceOnUse" x1={CAR_X0} x2={CAR_X1} y1="0" y2="0">
          <stop offset="0%" stopColor="rgb(5 150 105)" />
          <stop offset="100%" stopColor="rgb(52 211 153)" />
        </linearGradient>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect x={CAR_X0} y="100" width={CAR_SPAN} height="300" className="fill-black/[0.06] dark:fill-white/10" />
        <rect
          x={CAR_X0}
          y="100"
          width={CAR_SPAN}
          height="300"
          fill={`url(#${gradId})`}
          className="wd-t"
          style={{ transformBox: "fill-box", transformOrigin: "left center", transform: `scaleX(${level})`, transition: "transform 2s cubic-bezier(.2,.7,.2,1)" }}
        />
      </g>
      <path d={CAR_BODY_INNER} fill="none" strokeWidth={CAR_INSET * 2} strokeLinejoin="round" style={{ stroke: "var(--background)" }} />
      <path d={CAR_BODY} className="fill-zinc-800 dark:fill-zinc-200" />
      {CAR_WHEELS.map((d) => (
        <path key={d} d={d} className="fill-zinc-800 dark:fill-zinc-200" />
      ))}
    </svg>
  );
}

function CarCard({ seen }: { seen: boolean }) {
  const pct = useCount(CAR_PCT, seen);
  const kwh = (pct / 100) * SESSION_KWH;
  return (
    <div className={cn(CARD, "p-5 sm:p-6")}>
      <p className={LABEL}>Your car</p>
      <div className="mt-3 flex items-baseline justify-between gap-3">
        <p className="text-3xl font-bold leading-none tabular-nums tracking-tight text-theme-primary">
          {Math.round(pct)}
          <span className="ml-0.5 text-base font-medium text-theme-secondary">%</span>
        </p>
        <p className="text-xs tabular-nums text-theme-secondary">{kwh.toFixed(1)} kWh this session</p>
      </div>
      <div className="mt-5 px-1">
        <Car level={seen ? CAR_PCT / 100 : 0} />
      </div>
      <p className="mt-4 flex items-center gap-2 text-sm text-theme-secondary">
        <Plug className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
        Charging on sunshine, {CAR_KW.toFixed(1)} kW
      </p>
    </div>
  );
}

const WEEK = [0.55, 0.8, 0.68, 0.95, 0.6, 0.85, 0.72];

function SavingsCard({ seen }: { seen: boolean }) {
  const saved = useCount(SAVED_TODAY, seen);
  const month = useCount(4860, seen);
  return (
    <div className={cn(CARD, "p-5 sm:p-6")}>
      <p className={LABEL}>You saved today</p>
      <p className="mt-2 text-4xl font-bold leading-none tabular-nums tracking-tight text-theme-primary">
        <span className="text-2xl font-semibold text-theme-secondary">₹</span>
        {Math.round(saved).toLocaleString("en-IN")}
      </p>
      <p className="mt-1.5 text-xs tabular-nums text-theme-muted">₹{Math.round(month).toLocaleString("en-IN")} this month</p>
      <div className="mt-5 flex h-16 items-end gap-2" aria-hidden="true">
        {WEEK.map((v, i) => (
          <span
            key={i}
            className={cn("wd-t flex-1 rounded-t-md", i === WEEK.length - 1 ? "bg-emerald-500" : "bg-emerald-500/30")}
            style={{ height: `${v * 100}%`, transformOrigin: "bottom", transform: seen ? "scaleY(1)" : "scaleY(0)", transition: `transform 900ms cubic-bezier(.2,.7,.2,1) ${300 + i * 90}ms` }}
          />
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[0.65rem] text-theme-muted" aria-hidden="true">
        <span>Last 7 days</span>
        <span>Today</span>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------------------ the window

const NAV = [LayoutDashboard, Sun, BatteryCharging, EvCharger, PiggyBank, FileText];

export function PlatformDashboard() {
  const [ref, seen] = useSeen<HTMLDivElement>();
  return (
    <div
      ref={ref}
      role="img"
      aria-label="The WayTara dashboard for a home: solar, battery, grid and an EV charger in one place, with the solar curve for today, the battery level, the car charging and what you saved."
      className="overflow-hidden rounded-[1.75rem] border border-theme-border bg-theme-bg shadow-[0_30px_80px_-30px_rgba(0,0,0,0.35)]"
    >
      {/* the title bar */}
      <div className="flex items-center justify-between gap-4 border-b border-theme-border px-5 py-3.5">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold tracking-tight text-theme-primary">WayTara</span>
          <span className="hidden h-4 w-px bg-theme-border sm:block" />
          <span className="hidden items-center gap-1.5 text-sm text-theme-secondary sm:inline-flex">
            <Home className="size-4" aria-hidden="true" />
            Home, Chennai
          </span>
        </div>
        <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">All devices online</span>
      </div>

      <div className="flex">
        <nav aria-hidden="true" className="hidden w-16 shrink-0 flex-col items-center gap-2 border-r border-theme-border py-5 md:flex">
          {NAV.map((Icon, i) => (
            <span key={i} className={cn("flex size-10 items-center justify-center rounded-xl", i === 0 ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "text-theme-muted")}>
              <Icon className="size-5" strokeWidth={1.6} />
            </span>
          ))}
        </nav>

        <div className="min-w-0 flex-1 p-5 sm:p-7">
          <p className="text-sm text-theme-muted">Good afternoon</p>
          <h3 className="mt-1 text-[clamp(1.4rem,2.4vw,2rem)] font-bold leading-tight tracking-tight text-theme-primary">Your car is charging on sunshine.</h3>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <FlowCard seen={seen} />
            </div>
            <div className="lg:col-span-5">
              <SolarCard seen={seen} />
            </div>
            <div className="lg:col-span-4">
              <BatteryCard seen={seen} />
            </div>
            <div className="lg:col-span-4">
              <CarCard seen={seen} />
            </div>
            <div className="lg:col-span-4">
              <SavingsCard seen={seen} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
