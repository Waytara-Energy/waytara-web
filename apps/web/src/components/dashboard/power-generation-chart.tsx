"use client";

import { BarTrendChart } from "./bar-trend-chart";

// Same solar=yellow/load=blue convention every other bar graph in the app
// uses (see Monitoring's Main Hub Power Flows chart) — chart-3 and chart-2
// resolve to those colors (see globals.css), not chart-1/chart-4. Key names
// match the current equipment_templates/equipment_metrics vocabulary —
// "inverter_power_w"/"load_power_w" were the old instrument_catalog names
// and no device has ever written a row under them, which silently left
// this one chart on Overview stuck on "No data yet" even once every other
// Solar/Load card on the same page had real data.
const SERIES = [
  { key: "inverter_output_power_w", label: "Generation", color: "var(--chart-3)" },
  { key: "load_total_power_w", label: "Consumption", color: "var(--chart-2)" },
];

/** "Power Generation & Consumption — Today" — Overview's own instance of
 *  BarTrendChart's grouped bar pattern (interval picker, yesterday-grey
 *  reference bars, trend + totals footer). See bar-trend-chart.tsx for the
 *  shared mechanics; this file only fixes the two series/labels/colors
 *  Overview has always shown. */
export function PowerGenerationChart({ deviceId }: { deviceId: string }) {
  return <BarTrendChart deviceId={deviceId} title="Power Generation & Consumption" series={SERIES} unit="kW" footerMode="sum" footerUnit="kWh" />;
}
