"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { FLOW } from "./flow-colors";
import type { CurvePoint } from "@/lib/ev-sessions";

const ist = (t: number) => new Date(t).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

const POWER_CONFIG = { kw: { label: "Power (kW)", color: FLOW.consuming } } satisfies ChartConfig;
const SPLIT_CONFIG = {
  solar: { label: "Solar (kW)", color: FLOW.producing },
  battery: { label: "Battery (kW)", color: FLOW.drawing },
  grid: { label: "Grid (kW)", color: FLOW.idle },
} satisfies ChartConfig;

const axis = { tickLine: false, axisLine: false, tick: { fontSize: 10, fill: "var(--muted-foreground)" } } as const;

/** The charging power over the session and, when the site's readings were available, the same power split by source. */
export function EvSessionCharts({ points }: { points: CurvePoint[] }) {
  if (points.length < 2) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Charging power</CardTitle>
          <CardDescription>The curve appears once the charger has reported a few readings.</CardDescription>
        </CardHeader>
      </Card>
    );
  }
  const hasSplit = points.some((p) => p.solar !== null);
  const domain: [number, number] = [points[0].t, points[points.length - 1].t];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Charging power</CardTitle>
          <CardDescription>What the charger delivered to the car, reading by reading</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={POWER_CONFIG} className="aspect-auto h-56 w-full">
            <AreaChart data={points} margin={{ left: 4, right: 8, top: 8 }}>
              <defs>
                <linearGradient id="ev-power" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-kw)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--color-kw)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis type="number" dataKey="t" domain={domain} tickFormatter={ist} scale="time" tickCount={5} {...axis} />
              <YAxis width={32} tickFormatter={(v: number) => String(v)} {...axis} />
              <ChartTooltip content={<ChartTooltipContent labelFormatter={(_, p) => (p?.[0]?.payload ? ist((p[0].payload as CurvePoint).t) : "")} />} />
              <Area dataKey="kw" type="monotone" stroke="var(--color-kw)" strokeWidth={1.75} fill="url(#ev-power)" dot={false} isAnimationActive={false} />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>
      {hasSplit ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Where the power came from</CardTitle>
            <CardDescription>Solar first, then the battery, then the grid — an estimate from the inverter&apos;s readings</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={SPLIT_CONFIG} className="aspect-auto h-56 w-full">
              <AreaChart data={points} margin={{ left: 4, right: 8, top: 8 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis type="number" dataKey="t" domain={domain} tickFormatter={ist} scale="time" tickCount={5} {...axis} />
                <YAxis width={32} {...axis} />
                <ChartTooltip content={<ChartTooltipContent labelFormatter={(_, p) => (p?.[0]?.payload ? ist((p[0].payload as CurvePoint).t) : "")} />} />
                <Area dataKey="grid" stackId="s" type="monotone" stroke="var(--color-grid)" fill="var(--color-grid)" fillOpacity={0.45} dot={false} isAnimationActive={false} connectNulls />
                <Area dataKey="battery" stackId="s" type="monotone" stroke="var(--color-battery)" fill="var(--color-battery)" fillOpacity={0.45} dot={false} isAnimationActive={false} connectNulls />
                <Area dataKey="solar" stackId="s" type="monotone" stroke="var(--color-solar)" fill="var(--color-solar)" fillOpacity={0.45} dot={false} isAnimationActive={false} connectNulls />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
