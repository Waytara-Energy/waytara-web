"use client";

import { useState } from "react";
import { PARTNER_REGIONS } from "@/lib/partner-network";
import { TN_CITIES, TN_DISTRICTS, TN_MARKERS, TN_SIZE, TN_VIEWBOX, type TnRegion } from "@/lib/tn-map";
import { cn } from "@/lib/utils";

// The three regions, in the order of PARTNER_REGIONS, each with its own tint (the same green family as the rest of the site).
const REGION_IDS: TnRegion[] = ["north", "west", "south"];
const TONE: Record<TnRegion, { fill: string; dot: string }> = {
  north: { fill: "fill-emerald-200 dark:fill-emerald-800", dot: "bg-emerald-300 dark:bg-emerald-700" },
  west: { fill: "fill-emerald-400 dark:fill-emerald-600", dot: "bg-emerald-500 dark:bg-emerald-500" },
  south: { fill: "fill-lime-200 dark:fill-lime-800", dot: "bg-lime-300 dark:bg-lime-700" },
};

// Where a city's name sits beside its dot (the default is to the right), so close cities do not print over each other.
const LABEL: Record<string, { a: "start" | "end"; dy: number }> = {
  Chennai: { a: "end", dy: 3.5 },
  Tiruchirappalli: { a: "end", dy: 3.5 },
  Tirunelveli: { a: "end", dy: 3.5 },
  Thoothukudi: { a: "start", dy: 10 },
  Madurai: { a: "end", dy: 3.5 },
  Erode: { a: "end", dy: 3.5 },
  Tiruppur: { a: "start", dy: -4 },
};
const CITY_NAMES = new Set(TN_CITIES.map((c) => c.name));
// Every district of a region, by name (the marker-only district included).
const DISTRICTS_OF = (id: TnRegion) => [...TN_DISTRICTS.filter((d) => d.region === id).map((d) => d.name), ...TN_MARKERS.filter((m) => m.region === id).map((m) => m.name)].sort();

/**
 * Tamil Nadu with every district outlined and named, tinted by the three regions of the Partner Network, the main cities marked, and each region's
 * districts listed beside it. Pointing at (or tabbing to) a region lights it on the map. A drawing for orientation; applications are open statewide.
 */
export function PartnerMap() {
  const [active, setActive] = useState<TnRegion | null>(null);
  const dim = (r: TnRegion) => (active && active !== r ? "opacity-25" : "opacity-100");
  return (
    <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-20">
      <div className="mx-auto w-full max-w-md lg:max-w-none">
        <svg viewBox={TN_VIEWBOX} width={TN_SIZE.width} height={TN_SIZE.height} role="img" aria-label="Map of Tamil Nadu showing every district in three regions" className="mx-auto h-auto w-full max-w-xl">
          {TN_DISTRICTS.map((d) => (
            <path key={d.name} d={d.d} className={cn("stroke-white stroke-[0.8] transition-opacity duration-200 dark:stroke-neutral-950", TONE[d.region].fill, dim(d.region))} />
          ))}
          {/* district names: too small to read on a phone, where the lists beside the map carry them */}
          <g className="max-md:hidden" aria-hidden="true">
            {TN_DISTRICTS.filter((d) => !CITY_NAMES.has(d.name)).map((d) => (
              <text key={d.name} x={d.lx} y={d.ly} textAnchor="middle" className={cn("fill-theme-secondary text-[7px] transition-opacity duration-200", dim(d.region))}>
                {d.name}
              </text>
            ))}
            {TN_MARKERS.map((m) => (
              <g key={m.name} className={cn("transition-opacity duration-200", dim(m.region))}>
                <circle cx={m.x} cy={m.y} r={1.6} className="fill-theme-secondary" />
                <text x={m.x + 4} y={m.y + 7} className="fill-theme-secondary text-[7px]">
                  {m.name}
                </text>
              </g>
            ))}
          </g>
          {TN_CITIES.map((c) => {
            const l = LABEL[c.name] ?? { a: "start", dy: 3.5 };
            return (
              <g key={c.name} className={cn("transition-opacity duration-200", dim(c.region))}>
                <circle cx={c.x} cy={c.y} r={3} className="fill-theme-primary stroke-white stroke-[1.2] dark:stroke-neutral-950" />
                <text
                  x={c.x + (l.a === "end" ? -6 : 6)}
                  y={c.y + l.dy}
                  textAnchor={l.a}
                  className="fill-theme-primary stroke-white stroke-[2.5] text-[9px] font-semibold [paint-order:stroke] dark:stroke-neutral-950"
                >
                  {c.name}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <ul className="space-y-8" onMouseLeave={() => setActive(null)}>
        {PARTNER_REGIONS.map((r, i) => {
          const id = REGION_IDS[i];
          const list = DISTRICTS_OF(id);
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
                <span className="text-sm text-theme-muted">{list.length} districts</span>
              </div>
              <p className="mt-2 text-[15px] leading-relaxed text-theme-secondary">{list.join(", ")}.</p>
            </li>
          );
        })}
        <li className="border-t border-theme-border pt-6 text-sm leading-relaxed text-theme-muted">
          We start with the main cities and grow outwards. You choose your own district when you apply.
        </li>
      </ul>
    </div>
  );
}
