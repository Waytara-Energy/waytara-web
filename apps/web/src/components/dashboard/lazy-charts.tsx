"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Code-split, deferred versions of the three recharts-backed chart
 * components — PerformanceChart, LiveMetricChart, DivergingBarChart.
 * recharts is a genuinely heavy dependency (cartesian/state/component
 * chunks), and importing these components the normal way bundles all of
 * it into the page's initial JS regardless of whether the customer ever
 * scrolls to the chart. `next/dynamic` with `ssr: false` instead: (1)
 * splits each chart into its own chunk, fetched only when the component
 * actually renders, and (2) skips server-rendering it entirely, so the
 * rest of the page (which usually has real data ready immediately, e.g.
 * Overview's flow diagram, stat tiles) doesn't wait on it.
 *
 * `ssr: false` only works from a Client Component boundary — every
 * dashboard page importing these is itself a Server Component, hence
 * this wrapper file rather than calling `dynamic()` inline in each page.
 */

function ChartSkeleton() {
  return <Skeleton className="h-[220px] w-full rounded-lg" />;
}

export const PerformanceChart = dynamic(() => import("./performance-chart").then((m) => m.PerformanceChart), {
  ssr: false,
  loading: ChartSkeleton,
});

export const LiveMetricChart = dynamic(() => import("./live-metric-chart").then((m) => m.LiveMetricChart), {
  ssr: false,
  loading: ChartSkeleton,
});

export const DivergingBarChart = dynamic(() => import("./diverging-bar-chart").then((m) => m.DivergingBarChart), {
  ssr: false,
  loading: ChartSkeleton,
});
