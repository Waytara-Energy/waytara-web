"use client";

import * as React from "react";
import Image from "next/image";
import { Sun, BatteryCharging, PlugZap, Cpu } from "lucide-react";
import { cn } from "@/lib/utils";

// One real scene of the whole system (day and night photos). Everything laid over it is placed in the photo's own units
// (2000 x 1246), so pins, labels and the energy line stay on the right equipment at any width.
const W = 2000;
const H = 1246;
const pct = (v: number, of: number) => `${(v / of) * 100}%`;

interface Pin {
  /** Which of the four parts this belongs to (1 solar + inverter, 2 storage, 3 EV charging) */
  part: 1 | 2 | 3;
  label: string;
  icon: React.ElementType;
  x: number;
  y: number;
  /** Where the label sits next to the pin */
  side: "right" | "left" | "top" | "bottom";
}

const PINS: Pin[] = [
  { part: 1, label: "Solar panels", icon: Sun, x: 1000, y: 175, side: "top" },
  { part: 1, label: "Inverter", icon: Cpu, x: 156, y: 800, side: "top" },
  { part: 2, label: "Battery storage", icon: BatteryCharging, x: 415, y: 905, side: "top" },
  { part: 3, label: "EV charger", icon: PlugZap, x: 1378, y: 880, side: "left" },
];

// The energy line follows the real cables in the photo: down the roof gutter, along the wall to the inverter, to the batteries,
// then along the porch to the charger.
const FLOW = [
  "M1000 175 V292 H603 V688 H262 Q250 690 250 705 V770 H222",
  "M180 872 V946 H282",
  "M525 946 Q552 946 556 990 Q560 1008 590 1008 H1378 V905",
];

const SIDE: Record<Pin["side"], string> = {
  right: "left-full top-1/2 ml-2 -translate-y-1/2",
  left: "right-full top-1/2 mr-2 -translate-y-1/2",
  top: "bottom-full left-1/2 mb-2 -translate-x-1/2",
  bottom: "top-full left-1/2 mt-2 -translate-x-1/2",
};

function usePrefersReducedMotion() {
  const [reduce, setReduce] = React.useState(false);
  React.useEffect(() => {
    const q = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduce(q.matches);
    sync();
    q.addEventListener("change", sync);
    return () => q.removeEventListener("change", sync);
  }, []);
  return reduce;
}

/** The scene: the photo, the glowing energy line and the pins on the equipment. `active` is the part the visitor is pointing at (4, the dashboard, has no pin). */
export function SystemScene({ active }: { active: 1 | 2 | 3 | 4 | null }) {
  const reduce = usePrefersReducedMotion();
  const dim = active !== null;

  return (
    <div className="relative aspect-[2000/1246] w-full overflow-hidden rounded-2xl sm:rounded-3xl border border-theme-border bg-theme-surface shadow-xl shadow-emerald-900/5">
      <Image
        src="/images/hero-bg-light-v2.png"
        alt="A home with rooftop solar panels, an inverter and two batteries on the wall, and an electric car charging"
        fill
        sizes="(min-width: 1280px) 1180px, 100vw"
        className="object-cover dark:hidden"
      />
      <Image src="/images/hero-bg-dark-v2.png" alt="" fill sizes="(min-width: 1280px) 1180px, 100vw" className="hidden object-cover dark:block" />

      {/* soft light at the top and the foot so the labels read on any photo */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-black/25" />

      {/* the energy line */}
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true" className="pointer-events-none absolute inset-0 size-full">
        <defs>
          <filter id="flow-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="7" />
          </filter>
        </defs>
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          {FLOW.map((d) => (
            <g key={d}>
              <path d={d} stroke="#34d399" strokeOpacity={0.55} strokeWidth={14} filter="url(#flow-glow)" />
              <path d={d} stroke="white" strokeOpacity={0.85} strokeWidth={8} />
              <path d={d} stroke="#10b981" strokeWidth={4.5} />
              <path d={d} stroke="white" strokeWidth={3} strokeDasharray="2 34">
                {!reduce && <animate attributeName="stroke-dashoffset" from="36" to="0" dur="1.1s" repeatCount="indefinite" />}
              </path>
            </g>
          ))}
        </g>
      </svg>

      {/* pins */}
      {PINS.map((p) => {
        const Icon = p.icon;
        const on = active === p.part;
        return (
          <div
            key={p.label}
            className="absolute z-10"
            style={{ left: pct(p.x, W), top: pct(p.y, H) }}
          >
            <span className="relative block -translate-x-1/2 -translate-y-1/2">
              <span className={cn("absolute inset-0 rounded-full bg-emerald-400/60 motion-safe:animate-ping", on ? "opacity-100" : "opacity-60")} />
              <span
                className={cn(
                  "relative flex size-5 sm:size-7 items-center justify-center rounded-full border-2 border-white bg-emerald-600 text-[0.6rem] sm:text-xs font-bold text-white shadow-lg transition-transform duration-300",
                  on && "scale-125"
                )}
              >
                {p.part}
              </span>
              <span
                className={cn(
                  "absolute hidden sm:flex items-center gap-1.5 whitespace-nowrap rounded-full border border-white/70 bg-white/85 px-2.5 py-1 text-[0.7rem] lg:text-xs font-semibold text-slate-900 shadow-md backdrop-blur-md transition-all duration-300 dark:border-white/15 dark:bg-slate-900/75 dark:text-white",
                  SIDE[p.side],
                  dim && !on && "opacity-50"
                )}
              >
                <Icon className="size-3 lg:size-3.5 text-emerald-600 dark:text-emerald-400" />
                {p.label}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

