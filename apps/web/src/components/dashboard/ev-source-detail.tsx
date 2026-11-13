"use client";

import * as React from "react";
import type { SourceShare } from "@/lib/ev-sessions";
import { cn } from "@/lib/utils";
import { SOURCE } from "./ev-source";

const KEYS = ["solar", "battery", "grid"] as const;

/** Fine wavy lines (a water-like grain) laid over each column's colour. */
const GRAIN = `url("data:image/svg+xml,${encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='22' height='7'><path d='M0 3.5 Q5.5 0 11 3.5 T22 3.5' fill='none' stroke='white' stroke-opacity='0.5' stroke-width='0.9'/></svg>")}")`;

/**
 * The shape of a column: a smooth top edge between where it starts on the left and where it ends on the right (so the tops of the columns run on as one
 * skyline), in the column's own 0 to 1 units (for clip-path with objectBoundingBox). `left`, `mid` and `right` are how high the top is, 0 to 1.
 */
function topPath(left: number, mid: number, right: number): string {
  const y = (v: number) => (1 - v).toFixed(3);
  return `M0,${y(left)} C0.3,${y(mid)} 0.7,${y(mid)} 1,${y(right)} L1,1 L0,1 Z`;
}

/**
 * Where the energy of a charge came from, in detail (a wide screen): one column for each of solar, battery and grid, as wide as its share, with a soft
 * wavy top that runs on from one column to the next, a label with its icon at the foot, and its share (and energy) under it.
 */
export function EvSourceDetail({ shares, total, className }: { shares: SourceShare[] | null; total: string | null; className?: string }) {
  const uid = React.useId().replace(/[^a-zA-Z0-9]/g, "");
  const rows = KEYS.map((key) => {
    const s = shares?.find((x) => x.key === key);
    return { key, kwh: s?.kwh ?? null, pct: s?.pct ?? null };
  });
  const top = Math.max(1, ...rows.map((r) => r.pct ?? 0));
  // how high each column's top is at its middle: always some height (so an empty source is still a column), the largest share the highest
  const level = (pct: number | null) => 0.34 + 0.58 * ((pct ?? 0) / top);
  const mids = rows.map((r) => level(r.pct));
  // the tops meet halfway between two columns
  const edge = (i: number) => (i < 0 || i >= mids.length ? null : mids[i]);
  const joins = rows.map((_, i) => {
    const l = edge(i - 1);
    const r = edge(i + 1);
    return { left: l === null ? mids[i] : (l + mids[i]) / 2, right: r === null ? Math.max(0.2, mids[i] - 0.1) : (r + mids[i]) / 2 };
  });
  return (
    <div className={cn("flex min-h-0 w-full flex-col gap-3 rounded-2xl border border-border p-4", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs text-muted-foreground">Source of the energy</p>
        {total && <p className="text-xs tabular-nums text-muted-foreground">{total} delivered</p>}
      </div>
      <div className="flex min-h-[8rem] flex-1 gap-1.5" role="img" aria-label={shares ? rows.map((r) => `${r.key} ${Math.round(r.pct ?? 0)}%`).join(", ") : "Source not measured"}>
        {rows.map(({ key, kwh, pct }, i) => {
          const Icon = SOURCE[key].icon;
          const color = SOURCE[key].color;
          return (
            // as wide as its share (never narrower than its label's icon)
            <div key={key} className="flex min-w-[3.75rem] flex-col gap-2 [container-type:inline-size]" style={{ flexGrow: Math.max(pct ?? 0, 14), flexBasis: 0 }}>
              <svg width="0" height="0" className="absolute" aria-hidden="true">
                <clipPath id={`${uid}${key}`} clipPathUnits="objectBoundingBox">
                  <path d={topPath(joins[i].left, mids[i], joins[i].right)} />
                </clipPath>
              </svg>
              <div
                className="relative min-h-0 flex-1 rounded-b-[1.4rem] rounded-t-md"
                style={{
                  clipPath: `url(#${uid}${key})`,
                  background: `linear-gradient(to bottom, color-mix(in srgb, ${color} 78%, transparent), color-mix(in srgb, ${color} 26%, transparent))`,
                }}
              >
                {/* the grain of fine wavy lines */}
                <span aria-hidden="true" className="absolute inset-0 opacity-80" style={{ backgroundImage: GRAIN, backgroundSize: "22px 7px" }} />
                {/* the label, at the foot */}
                <span className="absolute bottom-2.5 left-2.5 flex max-w-[calc(100%-1.25rem)] items-center gap-1.5 rounded-full bg-background/80 p-1 pr-1 shadow-sm backdrop-blur-sm @[6.5rem]:pr-3">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full" style={{ backgroundColor: `color-mix(in srgb, ${color} 22%, transparent)`, color }}>
                    <Icon className="size-3.5" />
                  </span>
                  <span className="hidden truncate text-xs capitalize text-foreground @[6.5rem]:inline">{key}</span>
                </span>
              </div>
              <div className="leading-none">
                <p className="text-2xl font-light tabular-nums text-foreground">
                  {pct === null ? "—" : Math.round(pct)}
                  <span className="text-base text-muted-foreground">%</span>
                </p>
                <p className="mt-1 truncate text-[11px] tabular-nums text-muted-foreground">{kwh === null ? "—" : `${kwh.toFixed(2)} kWh`}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
