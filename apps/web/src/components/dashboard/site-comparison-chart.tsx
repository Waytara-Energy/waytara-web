"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

export interface SitePoint {
  siteId: string;
  label: string;
  value: number;
}

const chartConfig = {
  value: { label: "Yield", color: "var(--chart-1)" },
} satisfies ChartConfig;

/**
 * Cross-site magnitude comparison — bars, one hue (sequential job: these
 * are the same metric across different entities, not distinct series), no
 * legend needed.
 */
export function SiteComparisonChart({ sites, unit = "kWh" }: { sites: SitePoint[]; unit?: string }) {
  if (sites.length === 0) return null;

  const chartData = sites.map((s) => ({
    label: s.label.length > 14 ? `${s.label.slice(0, 13)}…` : s.label,
    value: Number(s.value.toFixed(1)),
  }));

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-[200px] w-full">
      <BarChart data={chartData} margin={{ left: 4, right: 4, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis tickLine={false} axisLine={false} tickMargin={8} width={40} />
        <ChartTooltip
          content={<ChartTooltipContent indicator="line" formatter={(value) => `${value} ${unit}`} />}
        />
        <Bar dataKey="value" fill="var(--color-value)" radius={4} />
      </BarChart>
    </ChartContainer>
  );
}
