"use client";

import { useState } from "react";
import { PARTNER_REGIONS } from "@/lib/partner-network";
import { TN_CITIES, TN_DISTRICTS, TN_SIZE, TN_VIEWBOX, type TnRegion } from "@/lib/tn-map";
import { cn } from "@/lib/utils";

// The three regions, in the order of PARTNER_REGIONS, each with its own tint (the same green family as the rest of the site).
const REGION_IDS: TnRegion[] = ["north", "west", "south"];
const TONE: Record<TnRegion, { fill: string; dot: string }> = {
  north: { fill: "fill-emerald-200 dark:fill-emerald-800", dot: "bg-emerald-300 dark:bg-emerald-700" },
  west: { fill: "fill-emerald-400 dark:fill-emerald-600", dot: "bg-emerald-500 dark:bg-emerald-500" },
  south: { fill: "fill-lime-200 dark:fill-lime-800", dot: "bg-lime-300 dark:bg-lime-700" },
};

/**
 * Tamil Nadu with its districts tinted by the three regions of the Partner Network, and the regions listed beside it. Pointing at (or tabbing to) a
 * region lights it on the map. A drawing for orientation: the page says applications are open statewide.
 */
export function PartnerMap() {
  const [active, setActive] = useState<TnRegion | null>(null);
  return (
    <div className="grid grid-cols-1 items-center gap-12 md:grid-cols-5 md:gap-14">
      <div className="mx-auto w-full max-w-[22rem] md:col-span-2 md:max-w-none">
        <svg viewBox={TN_VIEWBOX} width={TN_SIZE.width} height={TN_SIZE.height} role="img" aria-label="Map of Tamil Nadu in three regions: Chennai and the north, Western Tamil Nadu, and Central and the south" className="h-auto w-full">
          {TN_DISTRICTS.map((d) => (
            <path
              key={d.name}
              d={d.d}
              className={cn(
                "stroke-white stroke-[0.8] transition-opacity duration-200 dark:stroke-neutral-950",
                TONE[d.region].fill,
                active && active !== d.region ? "opacity-25" : "opacity-100",
              )}
            />
          ))}
          {TN_CITIES.map((c) => (
            <g key={c.name} className={cn("transition-opacity duration-200", active && active !== c.region ? "opacity-20" : "opacity-100")}>
              <circle cx={c.x} cy={c.y} r={3.2} className="fill-theme-primary stroke-white stroke-[1.2] dark:stroke-neutral-950" />
              <text x={c.x + (c.name === "Chennai" ? -7 : 7)} y={c.y + 4} textAnchor={c.name === "Chennai" ? "end" : "start"} className="fill-theme-primary stroke-white stroke-[3] text-[12px] font-semibold [paint-order:stroke] dark:stroke-neutral-950">
                {c.name}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <ul className="space-y-8 md:col-span-3" onMouseLeave={() => setActive(null)}>
        {PARTNER_REGIONS.map((r, i) => {
          const id = REGION_IDS[i];
          return (
            <li
              key={r.name}
              tabIndex={0}
              onMouseEnter={() => setActive(id)}
              onFocus={() => setActive(id)}
              onBlur={() => setActive(null)}
              className={cn("border-t border-theme-border pt-6 outline-none transition-opacity duration-200 focus-visible:ring-2 focus-visible:ring-emerald-500", active && active !== id && "opacity-50")}
            >
              <div className="flex items-center gap-3">
                <span className={cn("size-3 rounded-full", TONE[id].dot)} aria-hidden="true" />
                <h3 className="text-lg font-bold tracking-tight text-theme-primary sm:text-xl">{r.name}</h3>
              </div>
              <p className="mt-2 text-[15px] leading-relaxed text-theme-secondary sm:text-base">{r.places.join(", ")} and the districts around them.</p>
            </li>
          );
        })}
        <li className="border-t border-theme-border pt-6 text-sm leading-relaxed text-theme-muted">
          Applications are open across the whole state. The regions are how we plan the network; you choose your own district when you apply.
        </li>
      </ul>
    </div>
  );
}
