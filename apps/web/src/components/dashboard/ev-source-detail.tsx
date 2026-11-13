"use client";

import * as React from "react";
import type { SourceShare } from "@/lib/ev-sessions";
import { cn } from "@/lib/utils";
import { SOURCE } from "./ev-source";

/** One finished charge, for the small bars under the ring: when, how much and where it came from. */
export interface RecentCharge {
  id: string;
  when: string;
  kwh: number;
  shares: SourceShare[] | null;
}

const KEYS = ["solar", "battery", "grid"] as const;

/** A ring split into the sources of the energy, with the total (or any short text) in its middle. */
function Ring({ shares, centre, sub }: { shares: SourceShare[] | null; centre: string; sub: string }) {
  const R = 38;
  const C = 2 * Math.PI * R;
  const parts = (shares ?? []).filter((s) => s.pct > 0);
  // a hair of space between the pieces, so the colours do not touch
  const gap = parts.length > 1 ? 2.2 : 0;
  // where each piece starts, in percent of the ring
  const starts = parts.map((_, i) => parts.slice(0, i).reduce((a, s) => a + s.pct, 0));
  return (
    <div className="relative size-[6.5rem] shrink-0">
      <svg viewBox="0 0 100 100" className="size-full -rotate-90" role="img" aria-label={shares ? parts.map((s) => `${s.label} ${Math.round(s.pct)}%`).join(", ") : "Source not measured"}>
        <circle cx="50" cy="50" r={R} fill="none" stroke="currentColor" strokeWidth="11" className="text-foreground/[0.07]" />
        {parts.map((s, i) => {
          const len = Math.max(0, (s.pct / 100) * C - gap);
          return (
            <circle
              key={s.key}
              cx="50"
              cy="50"
              r={R}
              fill="none"
              stroke={SOURCE[s.key].color}
              strokeWidth="11"
              strokeLinecap="butt"
              strokeDasharray={`${len} ${C - len}`}
              strokeDashoffset={-(starts[i] / 100) * C}
              className="transition-[stroke-dasharray,stroke-dashoffset] duration-700"
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div className="leading-tight">
          <p className="text-base font-semibold tabular-nums text-foreground">{centre}</p>
          <p className="text-[11px] text-muted-foreground">{sub}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Where the energy of a charge came from, in detail (a wide screen): a ring split into solar, battery and grid with the amount in its middle, each source
 * with its energy and share, and, when there is room (no charge is running), the last few charges as small stacked bars in the same colours.
 */
export function EvSourceDetail({ shares, total, recent, showRecent, className }: { shares: SourceShare[] | null; total: string | null; recent: RecentCharge[]; showRecent: boolean; className?: string }) {
  const rows = KEYS.map((key) => {
    const s = shares?.find((x) => x.key === key);
    return { key, kwh: s?.kwh ?? null, pct: s?.pct ?? null };
  });
  const unknown = shares?.find((x) => x.key === "unattributed");
  const max = Math.max(0.1, ...recent.map((r) => r.kwh));
  // "0.97 kWh" -> the number in the ring and its unit under it
  const [totalNumber, ...unit] = (total ?? "—").split(" ");
  const totalUnit = unit.join(" ") || "delivered";
  return (
    <div className={cn("flex min-h-0 w-full flex-col gap-2.5 rounded-2xl border border-border p-4", className)}>
      <p className="text-xs text-muted-foreground">Source of the energy</p>
      <div className="flex items-center gap-5">
        <Ring shares={shares} centre={totalNumber} sub={totalUnit} />
        <ul className="grid min-w-0 flex-1 gap-2">
          {rows.map(({ key, kwh, pct }) => {
            const Icon = SOURCE[key].icon;
            return (
              <li key={key} className="flex min-w-0 items-center gap-2.5">
                <span className="grid size-7 shrink-0 place-items-center rounded-lg" style={{ backgroundColor: `color-mix(in srgb, ${SOURCE[key].color} 18%, transparent)`, color: SOURCE[key].color }}>
                  <Icon className="size-3.5" />
                </span>
                <span className="min-w-0 flex-1 text-xs capitalize text-muted-foreground">{key}</span>
                <span className="text-xs tabular-nums text-muted-foreground">{kwh === null ? "—" : `${kwh.toFixed(2)} kWh`}</span>
                <span className="w-10 text-right text-sm font-semibold tabular-nums text-foreground">{pct === null ? "—" : `${Math.round(pct)}%`}</span>
              </li>
            );
          })}
          {unknown && unknown.pct >= 1 && (
            <li className="flex min-w-0 items-center gap-2.5">
              <span className="grid size-7 shrink-0 place-items-center">
                <span className="size-2.5 rounded-full bg-foreground/15" />
              </span>
              <span className="min-w-0 flex-1 text-xs text-muted-foreground">Not measured</span>
              <span className="text-xs tabular-nums text-muted-foreground">{unknown.kwh.toFixed(2)} kWh</span>
              <span className="w-10 text-right text-sm font-semibold tabular-nums text-muted-foreground">{Math.round(unknown.pct)}%</span>
            </li>
          )}
        </ul>
      </div>

      {showRecent && recent.length > 0 && (
        <div className="flex min-h-0 flex-1 flex-col gap-1.5 border-t border-border pt-2.5">
          <p className="text-xs text-muted-foreground">Last charges</p>
          <div className="flex min-h-[3.5rem] flex-1 items-end gap-2">
            {recent.map((r) => {
              const parts = r.shares?.filter((s) => s.pct > 0) ?? [];
              return (
                <div key={r.id} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
                  <div
                    className="flex w-full max-w-9 flex-col-reverse overflow-hidden rounded-md bg-foreground/10"
                    style={{ height: `calc(${(r.kwh / max) * 100}% - 1rem)`, minHeight: "0.625rem" }}
                    title={`${r.when}: ${r.kwh.toFixed(2)} kWh${parts.length ? ` · ${parts.map((s) => `${s.label} ${Math.round(s.pct)}%`).join(", ")}` : ""}`}
                  >
                    {parts.map((s) => (
                      <span key={s.key} style={{ height: `${s.pct}%`, backgroundColor: SOURCE[s.key].color }} />
                    ))}
                  </div>
                  <span className="w-full truncate text-center text-[10px] text-muted-foreground">{r.when}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
