"use client";

import * as React from "react";
import { Area, AreaChart, Bar, BarChart, Cell, ReferenceDot, ReferenceLine, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { recentAxis, type AreaPoint } from "@/lib/energy-today";
import { useChartStyle } from "./chart-style";
import { CHART_CURSOR } from "./chart-cursor";

const IST_MS = 19_800_000;
const clock = (t: number) => new Date(t + IST_MS).toISOString().slice(11, 16);

/** The last two hours of readings on an Overview card: a smooth line with a gradient under it (or bars, when chosen in Application Settings),
 *  a marker on the newest point, a few quiet time labels and no value axis. A signed series (battery, grid) changes colour where it
 *  crosses zero. It fills the height of whatever holds it. `points` are the last two hours' 15-minute slots; `now` is the time the graph
 *  ends at. */
export function TodayAreaChart({
  points,
  now,
  posColor,
  negColor,
  posLabel,
  negLabel,
  unit = "kW",
}: {
  points: AreaPoint[];
  /** The newest moment (epoch ms): the right end of the graph. */
  now: number;
  /** The line's colour (above zero, for a signed series). */
  posColor: string;
  /** Present for a signed series: the colour below zero. */
  negColor?: string;
  posLabel: string;
  negLabel?: string;
  unit?: string;
}) {
  const uid = React.useId().replace(/[^a-zA-Z0-9]/g, "");
  const style = useChartStyle();
  const asBars = style === "bar";
  const signed = negColor !== undefined;
  const config = { v: { label: posLabel, color: posColor } } satisfies ChartConfig;

  const values = points.map((p) => p.v).filter((v): v is number => v !== null);
  const max = values.length ? Math.max(...values) : 0;
  const min = values.length ? Math.min(...values) : 0;
  // Where zero sits between the top (0) and the bottom (1) of the line, for the two-colour gradient.
  const zeroAt = signed && max > 0 && min < 0 ? max / (max - min) : null;
  const colorAbove = signed && max <= 0 ? negColor : posColor;

  // The newest point with a value, marked on the line.
  let last: AreaPoint | null = null;
  for (let i = points.length - 1; i >= 0 && !last; i--) if (points[i].v !== null) last = points[i];
  const lastColor = last && signed && (last.v as number) < 0 ? negColor : posColor;

  const axis = recentAxis(points, now);
  const tickLabel = (t: number) => (t === axis.end ? "now" : clock(t));
  const tooltip = (
    <ChartTooltip
      cursor={asBars ? false : CHART_CURSOR}
      content={({ active, payload }) => {
        const p = active ? (payload?.[0]?.payload as AreaPoint | undefined) : undefined;
        if (!p || p.v === null) return null;
        const label = signed && p.v < 0 ? negLabel : posLabel;
        return (
          <div className="rounded-md border bg-background px-2 py-1 text-[11px] shadow-sm">
            <span className="text-muted-foreground">{clock(p.t)}</span> · {label}{" "}
            <span className="font-medium tabular-nums">
              {Math.abs(p.v).toFixed(2)} {unit}
            </span>
          </div>
        );
      }}
    />
  );
  const xAxis = (
    <XAxis
      type="number"
      dataKey="t"
      domain={[axis.start, axis.end]}
      ticks={axis.ticks}
      tickFormatter={tickLabel}
      tickLine={false}
      axisLine={false}
      tickMargin={4}
      tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
    />
  );
  const margin = { left: 8, right: 8, top: 6, bottom: 0 };
  const yDomain: [number | "auto", number | "auto"] = signed ? ["auto", "auto"] : [0, "auto"];

  return (
    <ChartContainer config={config} className="aspect-auto h-full w-full">
      {asBars ? (
        <BarChart data={points} margin={margin}>
          {xAxis}
          <YAxis hide domain={signed ? ["auto", "auto"] : [0, "auto"]} />
          {signed && <ReferenceLine y={0} stroke="var(--border)" strokeDasharray="3 3" />}
          {tooltip}
          <Bar dataKey="v" radius={3} isAnimationActive={false} maxBarSize={28}>
            {points.map((p) => (
              <Cell key={p.t} fill={signed && (p.v ?? 0) < 0 ? negColor : posColor} />
            ))}
          </Bar>
        </BarChart>
      ) : (
        <AreaChart data={points} margin={margin}>
          <defs>
            {/* line: the colour above zero, the other colour below it */}
            <linearGradient id={`${uid}-line`} x1="0" y1="0" x2="0" y2="1">
              <stop offset={0} stopColor={colorAbove} />
              <stop offset={zeroAt ?? 1} stopColor={colorAbove} />
              {zeroAt !== null && <stop offset={zeroAt} stopColor={negColor} />}
              <stop offset={1} stopColor={zeroAt !== null ? negColor : colorAbove} />
            </linearGradient>
            <linearGradient id={`${uid}-fill`} x1="0" y1="0" x2="0" y2="1">
              <stop offset={0} stopColor={colorAbove} stopOpacity={0.3} />
              <stop offset={zeroAt ?? 1} stopColor={colorAbove} stopOpacity={zeroAt !== null ? 0.04 : 0.02} />
              {zeroAt !== null && <stop offset={zeroAt} stopColor={negColor} stopOpacity={0.04} />}
              <stop offset={1} stopColor={zeroAt !== null ? negColor : colorAbove} stopOpacity={zeroAt !== null ? 0.3 : 0.02} />
            </linearGradient>
          </defs>
          {xAxis}
          <YAxis hide domain={yDomain} />
          {signed && <ReferenceLine y={0} stroke="var(--border)" strokeDasharray="3 3" />}
          {tooltip}
          <Area dataKey="v" type="monotone" stroke={`url(#${uid}-line)`} strokeWidth={2} fill={`url(#${uid}-fill)`} dot={false} isAnimationActive={false} connectNulls baseValue={0} />
          {last && <ReferenceDot x={last.t} y={last.v as number} r={4} fill="var(--card)" stroke={lastColor} strokeWidth={2} ifOverflow="visible" />}
        </AreaChart>
      )}
    </ChartContainer>
  );
}
