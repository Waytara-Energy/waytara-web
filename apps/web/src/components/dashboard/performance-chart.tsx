"use client";

import * as React from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

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

const chartConfig = {
  value: { label: "Value", color: "var(--chart-1)" },
} satisfies ChartConfig;

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

  const points = React.useMemo(
    () => aggregate(daily, granularity, aggregationMode),
    [daily, granularity, aggregationMode]
  );
  const fmt =
    valueFormat === "inr"
      ? (v: number) => `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
      : (v: number) => `${v.toFixed(1)} ${unit}`;

  const total =
    aggregationMode === "sum"
      ? points.reduce((sum, p) => sum + p.value, 0)
      : (points[points.length - 1]?.value ?? 0);

  const chartData = points.map((p) => ({ label: formatLabel(p.date, granularity), value: p.value }));

  return (
    <div className="space-y-3">
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={granularity}
        onValueChange={(v) => v && setGranularity(v as Granularity)}
      >
        {(Object.keys(GRANULARITY_LABELS) as Granularity[]).map((g) => (
          <ToggleGroupItem key={g} value={g}>
            {GRANULARITY_LABELS[g]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <p className="text-sm text-muted-foreground">
        {totalLabel}: <span className="font-medium text-foreground">{fmt(total)}</span>
      </p>

      {points.length === 0 ? (
        <p className="text-sm text-muted-foreground">No readings yet.</p>
      ) : (
        <Tabs defaultValue="chart">
          <TabsList className="h-8 p-0.5">
            <TabsTrigger value="chart" className="px-3 py-1 text-xs">
              Chart
            </TabsTrigger>
            <TabsTrigger value="table" className="px-3 py-1 text-xs">
              Table
            </TabsTrigger>
          </TabsList>

          <TabsContent value="chart">
            <ChartContainer config={chartConfig} className="aspect-auto h-[220px] w-full">
              <AreaChart data={chartData} margin={{ left: 4, right: 4, top: 8 }}>
                <defs>
                  <linearGradient id="performanceFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-value)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--color-value)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  width={44}
                  tickFormatter={(v: number) =>
                    valueFormat === "inr" ? `₹${(v / 1000).toFixed(0)}k` : v.toLocaleString("en-IN")
                  }
                />
                <ChartTooltip
                  content={<ChartTooltipContent indicator="line" formatter={(value) => fmt(Number(value))} />}
                />
                <Area
                  dataKey="value"
                  type="monotone"
                  fill="url(#performanceFill)"
                  stroke="var(--color-value)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          </TabsContent>

          <TabsContent value="table">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {points.map((p) => (
                  <TableRow key={p.date}>
                    <TableCell className="text-foreground">{formatLabel(p.date, granularity)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{fmt(p.value)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
