"use client";

import { BatteryCharging, Cpu, Home, Sun, Zap, type LucideIcon } from "lucide-react";
import { co2AvoidedKg } from "@/lib/environmental-impact";
import { DAY_KEYS, roundTripPct, selfConsumptionPct } from "@/lib/performance-metrics";
import { dailySeries, maxOf, sumOf } from "@/lib/performance-period";
import type { RangeWindow } from "@/lib/telemetry/ranges";
import { cn } from "@/lib/utils";
import { useDailyHistory } from "./perf-data";
import { RangeBar, LONG_PRESETS } from "./range-bar";

export type HeadlineSection = "inverter" | "solar" | "battery" | "load" | "grid";

// The icon and accent of each segment, the same as its tab on the Monitoring page.
const VISUALS: Record<HeadlineSection, { icon: LucideIcon; className: string }> = {
  inverter: { icon: Cpu, className: "bg-primary/15 text-primary" },
  solar: { icon: Sun, className: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  battery: { icon: BatteryCharging, className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  load: { icon: Home, className: "bg-sky-500/15 text-sky-600 dark:text-sky-400" },
  grid: { icon: Zap, className: "bg-violet-500/15 text-violet-600 dark:text-violet-400" },
};

const kwh = (v: number | null) => (v === null ? "—" : `${v.toFixed(1)} kWh`);
const signedKwh = (v: number | null) => (v === null ? "—" : `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)} kWh`);
const percent = (v: number | null) => (v === null ? "—" : `${v.toFixed(0)}%`);

interface Headline {
  label: string;
  value: string;
  good?: boolean;
  figures: { label: string; value: string }[];
}

/** The line above the Performance tabs, like the Monitoring tabs': the selected segment's own headline figure, a few more figures
 *  about that segment for the chosen period (worked out from the daily energy counters, not repeated in the tab's cards), and the
 *  one period picker for every tab at the right. */
export function PerformanceHeadline({
  deviceId,
  span,
  periodText,
  live,
  section,
}: {
  deviceId: string;
  span: RangeWindow;
  periodText: string;
  live: Record<string, number | null>;
  section: HeadlineSection;
}) {
  const history = useDailyHistory(deviceId, Object.values(DAY_KEYS), span);
  const days = (key: string) => dailySeries(history.days, history.counter(key), live[key], history.today).map((p) => p.value);
  const ready = !history.error;

  const pv = days(DAY_KEYS.pv);
  const ac = days(DAY_KEYS.acOut);
  const load = days(DAY_KEYS.load);
  const charged = days(DAY_KEYS.charged);
  const discharged = days(DAY_KEYS.discharged);
  const imported = days(DAY_KEYS.imported);
  const exported = days(DAY_KEYS.exported);
  const perDay = (v: number[]) => (v.length > 0 ? sumOf(v) / v.length : null);
  const pct = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : null);

  const headline: Headline = (() => {
    switch (section) {
      case "inverter":
        return {
          label: `Output per day · ${periodText}`,
          value: kwh(perDay(ac)),
          figures: [
            { label: "Best day", value: kwh(maxOf(ac)) },
            { label: "Days with output", value: ac.length > 0 ? `${ac.filter((v) => v > 0.05).length} of ${ac.length}` : "—" },
          ],
        };
      case "solar": {
        const produced = sumOf(pv);
        const used = sumOf(load);
        return {
          label: `Solar used on site · ${periodText}`,
          value: percent(selfConsumptionPct(produced, sumOf(exported))),
          good: true,
          figures: [
            { label: "Solar vs home use", value: percent(pct(produced, used)) },
            { label: "CO₂ avoided", value: pv.length > 0 ? `${co2AvoidedKg(produced).toFixed(1)} kg` : "—" },
          ],
        };
      }
      case "battery": {
        const net = sumOf(charged) - sumOf(discharged);
        return {
          label: `Net into the battery · ${periodText}`,
          value: charged.length > 0 ? signedKwh(net) : "—",
          good: net > 0,
          figures: [
            { label: "Round trip", value: percent(roundTripPct(sumOf(charged), sumOf(discharged))) },
            { label: "Charged per day", value: kwh(perDay(charged)) },
          ],
        };
      }
      case "load":
        return {
          label: `Used per day · ${periodText}`,
          value: kwh(perDay(load)),
          figures: [
            { label: "Grid dependence", value: percent(pct(sumOf(imported), sumOf(load))) },
            { label: "Busiest day", value: kwh(maxOf(load)) },
          ],
        };
      case "grid": {
        const per = perDay(exported) !== null && perDay(imported) !== null ? (perDay(exported) as number) - (perDay(imported) as number) : null;
        return {
          label: `Net per day · ${periodText}`,
          value: signedKwh(per),
          good: per !== null && per > 0,
          figures: [
            { label: "Bought per day", value: kwh(perDay(imported)) },
            { label: "Sold per day", value: kwh(perDay(exported)) },
          ],
        };
      }
    }
  })();

  const visual = VISUALS[section];
  const Icon = visual.icon;

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-4">
        <span className={cn("flex size-14 shrink-0 items-center justify-center rounded-full", visual.className)}>
          <Icon className="size-7" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-theme-muted">{headline.label}</p>
          <p className={cn("text-4xl font-semibold leading-tight tracking-tight", ready && headline.good ? "text-emerald-600 dark:text-emerald-400" : "text-theme-primary")}>
            {ready ? headline.value : "—"}
          </p>
        </div>
        <div className="hidden items-center gap-8 pl-6 md:flex">
          {headline.figures.map((f) => (
            <div key={f.label}>
              <p className="text-sm font-medium text-theme-muted">{f.label}</p>
              <p className="text-2xl font-semibold tracking-tight text-theme-primary">{ready ? f.value : "—"}</p>
            </div>
          ))}
        </div>
      </div>
      <RangeBar presets={LONG_PRESETS} />
    </div>
  );
}
