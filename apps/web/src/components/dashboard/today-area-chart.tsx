"use client";

import * as React from "react";
import { Area, AreaChart, ReferenceDot, ReferenceLine, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { axisTicks, type AreaPoint } from "@/lib/energy-today";

const HOUR_MS = 3_600_000;

/** A smooth filled line of today's readings: a gradient under the line, a marker on the newest point, a few quiet axis
 *  labels. A signed series (battery, grid) is one line that changes colour where it crosses zero. It fills the height
 *  of whatever holds it. */
export function TodayAreaChart({
  points,
  dayStart,
  posColor,
  negColor,
  posLabel,
  negLabel,
  unit = "kW",
}: {
  points: AreaPoint[];
  /** Start of the IST day (epoch ms). */
  dayStart: number;
  /** The line's colour (above zero, for a signed series). */
  posColor: string;
  /** Present for a signed series: the colour below zero. */
  negColor?: string;
  posLabel: string;
  negLabel?: string;
  unit?: string;
}) {
  const uid = React.useId().replace(/[^a-zA-Z0-9]/g, "");
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

  // The x axis runs from midnight to the newest reading (at least six hours), so the line fills the card.
  const end = Math.max(last?.t ?? dayStart, dayStart + 6 * HOUR_MS);
  const ticks = axisTicks(dayStart, end);

  return (
    <ChartContainer config={config} className="aspect-auto h-full w-full">
      <AreaChart data={points} margin={{ left: 0, right: 2, top: 6, bottom: 0 }}>
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
        <XAxis
          type="number"
          dataKey="t"
          domain={[dayStart, end]}
          ticks={ticks}
          tickFormatter={(t: number) => String(Math.round((t - dayStart) / HOUR_MS)).padStart(2, "0")}
          tickLine={false}
          axisLine={false}
          tickMargin={4}
          tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
        />
        <YAxis
          orientation="right"
          width={30}
          tickCount={3}
          tickLine={false}
          axisLine={false}
          domain={signed ? ["auto", "auto"] : [0, "auto"]}
          tickFormatter={(v: number) => (Math.abs(v) < 10 ? v.toFixed(1) : String(Math.round(v)))}
          tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
        />
        {signed && <ReferenceLine y={0} stroke="var(--border)" strokeDasharray="3 3" />}
        <ChartTooltip
          cursor={{ stroke: "var(--border)" }}
          content={({ active, payload }) => {
            const p = active ? (payload?.[0]?.payload as AreaPoint | undefined) : undefined;
            if (!p || p.v === null) return null;
            const label = signed && p.v < 0 ? negLabel : posLabel;
            const time = new Date(p.t + 19_800_000).toISOString().slice(11, 16);
            return (
              <div className="rounded-md border bg-background px-2 py-1 text-[11px] shadow-sm">
                <span className="text-muted-foreground">{time}</span> · {label}{" "}
                <span className="font-medium tabular-nums">
                  {Math.abs(p.v).toFixed(2)} {unit}
                </span>
              </div>
            );
          }}
        />
        <Area dataKey="v" type="monotone" stroke={`url(#${uid}-line)`} strokeWidth={2} fill={`url(#${uid}-fill)`} dot={false} isAnimationActive={false} connectNulls baseValue={0} />
        {last && <ReferenceDot x={last.t} y={last.v as number} r={4} fill="var(--card)" stroke={lastColor} strokeWidth={2} ifOverflow="visible" />}
      </AreaChart>
    </ChartContainer>
  );
}
