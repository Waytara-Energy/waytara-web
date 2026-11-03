"use client";

import * as React from "react";
import { Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { CAR_BODY, CAR_BODY_INNER, CAR_BODY_OUTER, CAR_VIEWBOX, CAR_WHEELS, CAR_X0, CAR_X1 } from "./ev-car-art";

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

/** A number that eases towards its target, so a level fills and drains smoothly instead of jumping. */
function useTween(target: number, ms = 700) {
  const [value, setValue] = React.useState(target);
  const current = React.useRef(target);
  React.useEffect(() => {
    const from = current.current;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const k = clamp01((now - start) / ms);
      const next = from + (target - from) * (1 - Math.pow(1 - k, 3));
      current.current = next;
      setValue(next);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return value;
}

const STAGE = "relative flex h-[22rem] w-full touch-pan-y select-none items-center justify-center";
const WIDTH = "w-full max-w-[30rem]";

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

// ---------------------------------------------------------------------------------------------- batteries: one full, one low

const BATTERY_CELLS = 5;
const FULL_LEVEL = 100;
const LOW_LEVEL = 15;

/** An upright battery whose cells fill from the bottom; amber when low and red when nearly empty. */
function VerticalBattery({ level }: { level: number }) {
  const pct = Math.round(level);
  const tone = pct >= 40 ? "bg-emerald-500" : pct >= 20 ? "bg-amber-500" : "bg-rose-500";

  return (
    <div className="flex flex-col items-center">
      <p className="text-2xl font-semibold tracking-tight text-theme-primary tabular-nums">{pct}%</p>
      <div className="relative mt-6 h-52 w-28 rounded-2xl border-[5px] border-zinc-800 p-1.5 dark:border-zinc-300">
        <span className="absolute -top-[15px] left-1/2 h-[9px] w-12 -translate-x-1/2 rounded-t-md bg-zinc-800 dark:bg-zinc-300" />
        <div className="flex h-full flex-col-reverse gap-1.5">
          {Array.from({ length: BATTERY_CELLS }, (_, i) => {
            const fill = clamp01((level - (i * 100) / BATTERY_CELLS) / (100 / BATTERY_CELLS));
            return (
              <div key={i} className="flex flex-1 flex-col justify-end overflow-hidden rounded-md bg-black/[0.06] dark:bg-white/10">
                <div className={tone} style={{ height: `${fill * 100}%` }} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function BatteryVignette() {
  const { ref, ratio, handlers } = usePointerRatio();
  // the second one rests low and fills while the pointer is over the picture
  const low = useTween(ratio ? FULL_LEVEL : LOW_LEVEL);

  return (
    <div ref={ref} aria-hidden="true" className={STAGE} {...handlers}>
      <div className="flex w-full items-start justify-evenly">
        <VerticalBattery level={FULL_LEVEL} />
        <VerticalBattery level={low} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------- EV charger: the car is the battery

const SESSION_KWH = 24;
const CAR_SEGMENTS = 10;
const CAR_GAP = 22;
/** How far the cells sit in from the outline, like the padding inside the battery's body. */
const CAR_INSET = 11;
const CAR_SPAN = CAR_X1 - CAR_X0;
const CAR_SEG_W = CAR_SPAN / CAR_SEGMENTS;

/** The EV drawing with its body filled like the battery: ten cells with gaps, set in from the outline, lit up to the charge level. */
function Car({ level }: { level: number }) {
  const clipId = `car-clip-${React.useId().replace(/:/g, "")}`;
  const cells = Array.from({ length: CAR_SEGMENTS }, (_, i) => ({
    i,
    x: CAR_X0 + i * CAR_SEG_W + CAR_GAP / 2,
    w: CAR_SEG_W - CAR_GAP,
    fill: clamp01((level - i * (100 / CAR_SEGMENTS)) / (100 / CAR_SEGMENTS)),
  }));

  return (
    <svg viewBox={CAR_VIEWBOX} className="block h-auto w-full overflow-visible">
      <defs>
        <clipPath id={clipId}>
          <path d={CAR_BODY_OUTER} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        {cells.map((c) => (
          <g key={c.i}>
            <rect x={c.x} y="100" width={c.w} height="300" className="fill-black/[0.06] dark:fill-white/10" />
            <rect x={c.x} y="100" height="300" className="fill-emerald-500" style={{ width: c.w * c.fill }} />
          </g>
        ))}
      </g>
      {/* the gap between the outline and the cells, in the page's own colour */}
      <path d={CAR_BODY_INNER} fill="none" strokeWidth={CAR_INSET * 2} strokeLinejoin="round" style={{ stroke: "var(--background)" }} />
      <path d={CAR_BODY} className="fill-zinc-800 dark:fill-zinc-200" />
      {CAR_WHEELS.map((d) => (
        <path key={d} d={d} className="fill-zinc-800 dark:fill-zinc-200" />
      ))}
    </svg>
  );
}

export function EvChargerVignette() {
  const { ref, ratio, handlers } = usePointerRatio();
  // rests at its level; fills while the pointer is over it
  const level = useTween(ratio ? 100 : 62);
  const pct = Math.round(level);

  return (
    <div ref={ref} aria-hidden="true" className={STAGE} {...handlers}>
      <div className={cn(WIDTH, "flex flex-col items-center")}>
        <p className="text-4xl font-semibold leading-none tracking-tight text-theme-primary tabular-nums">
          {pct}
          <span className="ml-0.5 align-top text-base font-medium text-theme-secondary">%</span>
        </p>
        <p className="mt-1.5 text-xs text-theme-secondary tabular-nums">{((level / 100) * SESSION_KWH).toFixed(1)} kWh this session</p>

        <div className="relative mt-8 w-full">
          <Car level={level} />
          <span aria-hidden="true" className="pointer-events-none absolute -bottom-2 left-1/2 h-3 w-4/5 -translate-x-1/2 rounded-full bg-black/15 blur-md dark:bg-black/60" />
        </div>
      </div>
    </div>
  );
}
