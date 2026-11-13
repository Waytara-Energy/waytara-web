"use client";

import * as React from "react";
import type { SourceShare } from "@/lib/ev-sessions";
import { cn } from "@/lib/utils";
import { FlowRise } from "./flow-fill";
import { SOURCE } from "./ev-source";

const KEYS = ["solar", "battery", "grid"] as const;

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
export function EvSourceDetail({ shares, total, charging = false, className }: { shares: SourceShare[] | null; total: string | null; charging?: boolean; className?: string }) {
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
            // as wide as its share (never narrower than its icon and figure need)
            <div key={key} className="flex min-w-[5.5rem] flex-col gap-2" style={{ flexGrow: Math.max(pct ?? 0, 14), flexBasis: 0 }}>
              <svg width="0" height="0" className="absolute" aria-hidden="true">
                <clipPath id={`${uid}${key}`} clipPathUnits="objectBoundingBox">
                  <path d={topPath(joins[i].left, mids[i], joins[i].right)} />
                </clipPath>
              </svg>
              <div
                className="relative min-h-0 flex-1 overflow-hidden rounded-b-[1.4rem] rounded-t-md [container-type:size]"
                style={{
                  clipPath: `url(#${uid}${key})`,
                  background: `linear-gradient(to bottom, color-mix(in srgb, ${color} 78%, transparent), color-mix(in srgb, ${color} 26%, transparent))`,
                }}
              >
                {/* particles rising from the foot to the top of the column (the dust of a Crystalized Ball) */}
                <FlowRise speed={charging ? 1.3 : 0.7} />
              </div>
              <div className="flex items-center gap-2.5">
                <span className="grid size-8 shrink-0 place-items-center rounded-xl" style={{ backgroundColor: `color-mix(in srgb, ${color} 20%, transparent)`, color }}>
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 leading-none">
                  <p className="text-2xl font-light tabular-nums text-foreground">
                    {pct === null ? "—" : Math.round(pct)}
                    <span className="text-base text-muted-foreground">%</span>
                  </p>
                  <p className="mt-1 truncate text-[11px] tabular-nums text-muted-foreground">{kwh === null ? "—" : `${kwh.toFixed(2)} kWh`}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
