"use client";

import * as React from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { useSeriesUnit } from "@/components/units-provider";
import type { TodayPoint } from "@/lib/ev-tab";
import { FLOW } from "./flow-colors";

const ist = (t: number) => new Date(t).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
const axis = { tickLine: false, axisLine: false, tick: { fontSize: 10, fill: "var(--muted-foreground)" } } as const;

/**
 * Today's charging power on the charger's Monitoring tab: one curve across the day (it stops between charges), stacked by where the power came from
 * (solar first, then battery, then grid) when the site's readings were there, a plain power curve otherwise. The summary under the title says the
 * energy, the peak and the number of charges.
 */
export function EvTodayChart({ points: raw, summary }: { points: TodayPoint[]; summary: string }) {
  const su = useSeriesUnit("kW");
  const unit = su.unit || "kW";
  const points = React.useMemo(() => {
    const m = (v: number | null) => (v === null ? null : su.converted ? su.map(v) : v);
    return raw.map((p) => ({ t: p.t, kw: m(p.kw), solar: m(p.solar), battery: m(p.battery), grid: m(p.grid) }));
  }, [raw, su]);
  const config = {
    kw: { label: `Power (${unit})`, color: FLOW.consuming },
    solar: { label: `Solar (${unit})`, color: FLOW.producing },
    battery: { label: `Battery (${unit})`, color: FLOW.drawing },
    grid: { label: `Grid (${unit})`, color: FLOW.idle },
  } satisfies ChartConfig;

  if (points.filter((p) => p.kw !== null).length < 2) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Power today</CardTitle>
          <CardDescription>{summary || "No charge today yet. The curve appears once a charge has started."}</CardDescription>
        </CardHeader>
      </Card>
    );
  }
  const hasSplit = points.some((p) => p.solar !== null);
  const domain: [number, number] = [points[0].t, points[points.length - 1].t];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Power today</CardTitle>
        <CardDescription>{summary}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="aspect-auto h-56 w-full">
          <AreaChart data={points} margin={{ left: 4, right: 8, top: 8 }}>
            <defs>
              <linearGradient id="ev-today-power" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-kw)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--color-kw)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis type="number" dataKey="t" domain={domain} tickFormatter={ist} scale="time" tickCount={6} {...axis} />
            <YAxis width={32} {...axis} />
            <ChartTooltip content={<ChartTooltipContent labelFormatter={(_, p) => (p?.[0]?.payload ? ist((p[0].payload as { t: number }).t) : "")} />} />
            {hasSplit ? (
              <>
                <Area dataKey="grid" stackId="s" type="monotone" stroke="var(--color-grid)" fill="var(--color-grid)" fillOpacity={0.45} dot={false} isAnimationActive={false} />
                <Area dataKey="battery" stackId="s" type="monotone" stroke="var(--color-battery)" fill="var(--color-battery)" fillOpacity={0.45} dot={false} isAnimationActive={false} />
                <Area dataKey="solar" stackId="s" type="monotone" stroke="var(--color-solar)" fill="var(--color-solar)" fillOpacity={0.45} dot={false} isAnimationActive={false} />
              </>
            ) : (
              <Area dataKey="kw" type="monotone" stroke="var(--color-kw)" strokeWidth={1.75} fill="url(#ev-today-power)" dot={false} isAnimationActive={false} />
            )}
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
