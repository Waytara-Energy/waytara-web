import * as React from "react";
import { CAR_BODY, CAR_BODY_INNER, CAR_BODY_OUTER, CAR_VIEWBOX, CAR_WHEELS, CAR_X0, CAR_X1 } from "@/components/sections/ev-car-art";
import { cn } from "@/lib/utils";

/** How far the fill sits in from the outline, like the padding inside the battery's body. */
const INSET = 11;
const SPAN = CAR_X1 - CAR_X0;

/**
 * The Overview's car: the same drawing as the landing page's Our Approach picture (outline, gap, one gradient from the tail to the nose),
 * on whatever is behind it (the gap is cut out of the fill, not painted, so a picture or gradient behind the page shows through).
 *   level  0-100: how far the body is filled, from the tail
 *   sweep  while a charge runs with no known end, the fill runs from the tail to the nose again and again instead of showing a level
 * The car is the user's artwork (sections/ev-car-art.ts), so a new drawing only has to replace that file's paths.
 */
export function EvCar({ level, sweep = false, className }: { level: number; sweep?: boolean; className?: string }) {
  const uid = React.useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <svg viewBox={CAR_VIEWBOX} aria-hidden="true" className={cn("block h-auto w-full overflow-visible", className)}>
      <defs>
        <clipPath id={`${uid}-clip`}>
          <path d={CAR_BODY_OUTER} />
        </clipPath>
        <mask id={`${uid}-mask`} maskUnits="userSpaceOnUse" x={CAR_X0 - 10} y="90" width={SPAN + 20} height="330">
          <rect x={CAR_X0 - 10} y="90" width={SPAN + 20} height="330" fill="white" />
          <path d={CAR_BODY_INNER} fill="none" stroke="black" strokeWidth={INSET * 2} strokeLinejoin="round" />
        </mask>
        <linearGradient id={`${uid}-grad`} gradientUnits="userSpaceOnUse" x1={CAR_X0} x2={CAR_X1} y1="0" y2="0">
          <stop offset="0%" stopColor="rgb(5 150 105)" />
          <stop offset="100%" stopColor="rgb(52 211 153)" />
        </linearGradient>
      </defs>
      <g clipPath={`url(#${uid}-clip)`}>
        <g mask={`url(#${uid}-mask)`}>
          <rect x={CAR_X0} y="100" width={SPAN} height="300" className="fill-black/[0.06] dark:fill-white/10" />
          {sweep ? (
            <rect x={CAR_X0} y="100" width={SPAN} height="300" fill={`url(#${uid}-grad)`} className="origin-left [transform-box:fill-box] motion-safe:animate-car-charge" />
          ) : (
            <rect x={CAR_X0} y="100" height="300" fill={`url(#${uid}-grad)`} style={{ width: (SPAN * Math.min(100, Math.max(0, level))) / 100, transition: "width 600ms ease-out" }} />
          )}
        </g>
      </g>
      <path d={CAR_BODY} className="fill-zinc-800 dark:fill-zinc-200" />
      {CAR_WHEELS.map((d) => (
        <path key={d} d={d} className="fill-zinc-800 dark:fill-zinc-200" />
      ))}
    </svg>
  );
}
