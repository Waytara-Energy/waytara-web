"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface DailyPoint {
  date: string; // YYYY-MM-DD
  value: number;
}

type Granularity = "daily" | "weekly" | "monthly";

const GRANULARITY_LABELS: Record<Granularity, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

function isoWeekKey(date: Date): string {
  // Monday-anchored week bucket, labeled by that Monday's date.
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // 0 = Monday
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}

function monthKey(date: Date): string {
  return date.toISOString().slice(0, 7); // YYYY-MM
}

function aggregate(daily: DailyPoint[], granularity: Granularity, mode: "sum" | "last"): DailyPoint[] {
  if (granularity === "daily") return daily;

  const buckets = new Map<string, number>();
  for (const point of daily) {
    const date = new Date(point.date + "T00:00:00Z");
    const key = granularity === "weekly" ? isoWeekKey(date) : monthKey(date);
    if (mode === "sum") {
      buckets.set(key, (buckets.get(key) ?? 0) + point.value);
    } else {
      // "last" — for a running/cumulative series, a bucket's value is
      // its most recent point, not a sum (points arrive date-ascending).
      buckets.set(key, point.value);
    }
  }
  return Array.from(buckets.entries())
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function formatLabel(date: string, granularity: Granularity): string {
  const d = new Date(date + "T00:00:00Z");
  if (granularity === "monthly") {
    return d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
  }
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

const CHART_WIDTH = 640;
const CHART_HEIGHT = 220;
const PADDING = { top: 16, right: 16, bottom: 28, left: 44 };

export function PerformanceChart({
  daily,
  unit = "kWh",
  aggregationMode = "sum",
  valueFormat = "unit",
  totalLabel = "Total this period",
}: {
  daily: DailyPoint[];
  unit?: string;
  /** "sum" buckets weekly/monthly by adding daily values (default — energy
   *  yield). "last" takes the bucket's most recent value instead, for a
   *  running/cumulative series (e.g. cumulative savings to date) where
   *  summing would double-count. */
  aggregationMode?: "sum" | "last";
  /** "unit" -> `${value} ${unit}` (default). "inr" -> ₹-formatted, no
   *  decimals. A named enum, not a formatter function, so this component
   *  stays passable from a Server Component (functions can't cross the
   *  RSC boundary as props). */
  valueFormat?: "unit" | "inr";
  /** Overrides the "Total this period" summary label — for a cumulative
   *  series the period total isn't a sum, it's the latest value. */
  totalLabel?: string;
}) {
  const [granularity, setGranularity] = React.useState<Granularity>("daily");
  const [showTable, setShowTable] = React.useState(false);
  const [hoverIndex, setHoverIndex] = React.useState<number | null>(null);
  const svgRef = React.useRef<SVGSVGElement>(null);

  const points = React.useMemo(
    () => aggregate(daily, granularity, aggregationMode),
    [daily, granularity, aggregationMode]
  );
  const fmt =
    valueFormat === "inr"
      ? (v: number) => `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
      : (v: number) => `${v.toFixed(1)} ${unit}`;

  const plotWidth = CHART_WIDTH - PADDING.left - PADDING.right;
  const plotHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom;
  const maxValue = Math.max(1, ...points.map((p) => p.value));

  const xFor = (i: number) =>
    points.length <= 1 ? PADDING.left + plotWidth / 2 : PADDING.left + (i / (points.length - 1)) * plotWidth;
  const yFor = (v: number) => PADDING.top + plotHeight - (v / maxValue) * plotHeight;

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(p.value)}`).join(" ");
  const areaPath =
    points.length > 0
      ? `${linePath} L ${xFor(points.length - 1)} ${PADDING.top + plotHeight} L ${xFor(0)} ${PADDING.top + plotHeight} Z`
      : "";

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(maxValue * f));

  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (points.length === 0 || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = CHART_WIDTH / rect.width;
    const x = (e.clientX - rect.left) * scaleX;
    let closest = 0;
    let closestDist = Infinity;
    points.forEach((_, i) => {
      const dist = Math.abs(xFor(i) - x);
      if (dist < closestDist) {
        closestDist = dist;
        closest = i;
      }
    });
    setHoverIndex(closest);
  }

  const total =
    aggregationMode === "sum"
      ? points.reduce((sum, p) => sum + p.value, 0)
      : (points[points.length - 1]?.value ?? 0);
  const hovered = hoverIndex !== null ? points[hoverIndex] : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg border border-theme-border p-1">
          {(Object.keys(GRANULARITY_LABELS) as Granularity[]).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => {
                setGranularity(g);
                setHoverIndex(null);
              }}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                granularity === g
                  ? "bg-theme-surface-hover text-theme-highlight"
                  : "text-theme-muted hover:text-theme-primary"
              )}
            >
              {GRANULARITY_LABELS[g]}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          className="text-xs font-medium text-theme-muted hover:text-theme-primary hover:underline"
        >
          {showTable ? "Show chart" : "Show table"}
        </button>
      </div>

      <p className="text-sm text-theme-muted">
        {totalLabel}: <span className="font-medium text-theme-primary">{fmt(total)}</span>
      </p>

      {points.length === 0 ? (
        <p className="text-sm text-theme-muted">No readings yet.</p>
      ) : showTable ? (
        <div className="overflow-x-auto rounded-lg border border-theme-border">
          <table className="w-full text-sm">
            <thead className="bg-theme-surface text-left text-xs uppercase tracking-wide text-theme-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Period</th>
                <th className="px-3 py-2 font-medium">Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme-border">
              {points.map((p) => (
                <tr key={p.date}>
                  <td className="px-3 py-2 text-theme-primary">{formatLabel(p.date, granularity)}</td>
                  <td className="px-3 py-2 tabular-nums text-theme-secondary">{fmt(p.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative rounded-lg border border-theme-border bg-theme-surface p-2">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
            className="w-full"
            onPointerMove={handlePointerMove}
            onPointerLeave={() => setHoverIndex(null)}
            role="img"
            aria-label={`${GRANULARITY_LABELS[granularity]} energy yield trend`}
          >
            {/* gridlines — hairline, recessive */}
            {yTicks.map((tick, i) => {
              const y = yFor(tick);
              return (
                <g key={i}>
                  <line
                    x1={PADDING.left}
                    x2={CHART_WIDTH - PADDING.right}
                    y1={y}
                    y2={y}
                    stroke="var(--border)"
                    strokeWidth={1}
                  />
                  <text x={PADDING.left - 8} y={y + 3} textAnchor="end" className="fill-theme-muted text-[9px]">
                    {tick.toLocaleString("en-IN")}
                  </text>
                </g>
              );
            })}

            {/* area fill — ~10% opacity wash */}
            {areaPath && <path d={areaPath} fill="var(--highlight)" opacity={0.1} />}

            {/* line — 2px, round join/cap */}
            <path d={linePath} fill="none" stroke="var(--highlight)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

            {/* crosshair + hovered point */}
            {hovered && hoverIndex !== null && (
              <g>
                <line
                  x1={xFor(hoverIndex)}
                  x2={xFor(hoverIndex)}
                  y1={PADDING.top}
                  y2={PADDING.top + plotHeight}
                  stroke="var(--border-active)"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />
                <circle
                  cx={xFor(hoverIndex)}
                  cy={yFor(hovered.value)}
                  r={4}
                  fill="var(--highlight)"
                  stroke="var(--surface)"
                  strokeWidth={2}
                />
              </g>
            )}

            {/* x-axis labels: first, last, and hovered */}
            <text x={xFor(0)} y={CHART_HEIGHT - 8} textAnchor="start" className="fill-theme-muted text-[9px]">
              {formatLabel(points[0].date, granularity)}
            </text>
            {points.length > 1 && (
              <text
                x={xFor(points.length - 1)}
                y={CHART_HEIGHT - 8}
                textAnchor="end"
                className="fill-theme-muted text-[9px]"
              >
                {formatLabel(points[points.length - 1].date, granularity)}
              </text>
            )}
          </svg>

          {hovered && hoverIndex !== null && (
            <div
              className="pointer-events-none absolute rounded-md border border-theme-border bg-theme-bg px-2.5 py-1.5 text-xs shadow-md"
              style={{
                left: `${(xFor(hoverIndex) / CHART_WIDTH) * 100}%`,
                top: 8,
                transform: "translateX(-50%)",
              }}
            >
              <p className="font-semibold text-theme-primary">{fmt(hovered.value)}</p>
              <p className="text-theme-muted">{formatLabel(hovered.date, granularity)}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
