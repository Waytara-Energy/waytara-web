"use client";

import { Bar, BarChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from "recharts";
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

export interface DivergingPoint {
  date: string; // YYYY-MM-DD
  positive: number;
  negative: number;
}

function formatLabel(date: string): string {
  return new Date(date + "T00:00:00Z").toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/** Two-series polarity comparison (battery charge vs discharge, grid
 *  import vs export) — a diverging bar chart, not two overlaid lines:
 *  each day's positive series climbs above the zero line, negative below
 *  it, so the shape of the comparison is legible at a glance. Colors
 *  follow the same favorable/drawing convention as the Overview flow
 *  diagram (green = charging/exporting, amber = discharging/importing),
 *  not the app's categorical palette — they encode direction here too. */
export function DivergingBarChart({
  data,
  positiveLabel,
  negativeLabel,
  unit = "kWh",
  positiveColor = "#10b981",
  negativeColor = "#f59e0b",
}: {
  data: DivergingPoint[];
  positiveLabel: string;
  negativeLabel: string;
  unit?: string;
  positiveColor?: string;
  negativeColor?: string;
}) {
  const chartData = data.map((d) => ({
    label: formatLabel(d.date),
    positive: d.positive,
    negative: -d.negative,
  }));

  const chartConfig = {
    positive: { label: positiveLabel, color: positiveColor },
    negative: { label: negativeLabel, color: negativeColor },
  } satisfies ChartConfig;

  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No readings yet.</p>;
  }

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-[220px] w-full">
      <BarChart data={chartData} margin={{ left: 4, right: 4, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          width={44}
          tickFormatter={(v: number) => Math.abs(v).toLocaleString("en-IN")}
        />
        <ReferenceLine y={0} stroke="var(--border)" />
        <ChartTooltip
          content={<ChartTooltipContent formatter={(value) => `${Math.abs(Number(value)).toFixed(1)} ${unit}`} />}
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="positive" fill="var(--color-positive)" radius={[3, 3, 0, 0]} />
        <Bar dataKey="negative" fill="var(--color-negative)" radius={[0, 0, 3, 3]} />
      </BarChart>
    </ChartContainer>
  );
}
