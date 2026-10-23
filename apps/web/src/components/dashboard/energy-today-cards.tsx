"use client";

import * as React from "react";
import { ArrowDownToLine, ArrowUpFromLine, BatteryCharging, Gauge, House, Plug, Sun } from "lucide-react";
import { areaPoints, deltaPct, recentPoints, RECENT_WINDOW_MS, peakOf, slotIndex, TODAY_COUNTER_KEYS as K } from "@/lib/energy-today";
import { istDayStart } from "@/lib/telemetry/combine";
import { useLiveNumbers } from "@/lib/telemetry/live-values";
import { useUnits } from "@/components/units-provider";
import { useSeriesRange, useTodaySeries } from "@/lib/telemetry/react";
import type { OverviewCardId } from "@/lib/overview-prefs";
import { FLOW } from "./flow-colors";
import { TodayAreaChart } from "./today-area-chart";
import { ChartArea, Figures, Legend, WidgetCard, type FigureData, type WidgetTone } from "./widget-ui";
import type { AreaPoint } from "@/lib/energy-today";

const DAY_MS = 86_400_000;
const GREEN: string = FLOW.producing;
const AMBER: string = FLOW.drawing;
const BLUE: string = FLOW.consuming;

/** Yesterday's counters at this time of day (the slot that contains "now minus 24 hours"), from the 15-minute rollups. */
function useYesterdayAtThisTime(deviceId: string, keys: string[], nowMs: number): Record<string, number | null> {
  const yStart = istDayStart(nowMs) - DAY_MS;
  const win = React.useMemo(() => ({ fromMs: yStart, toMs: yStart + DAY_MS }), [yStart]);
  const state = useSeriesRange(deviceId, keys, win, 15);
  const i = slotIndex(state.axis, nowMs - DAY_MS);
  const out: Record<string, number | null> = {};
  for (const k of keys) out[k] = state.status === "ready" && i !== null ? (state.byKey[k]?.[i]?.last ?? null) : null;
  return out;
}

interface StatOptions {
  icon: typeof Sun;
  tone: WidgetTone;
  title: string;
  href: string;
  figures: FigureData[];
  points: AreaPoint[];
  posColor: string;
  negColor?: string;
  posLabel: string;
  negLabel?: string;
  legend: { color: string; label: string }[];
}

/** Overview's "today" widgets, each opening its Monitoring tab: solar, load, grid, battery, self-powered, sent to and bought from the grid. `cards`
 *  says which to draw (each is a widget of its own on the board). Each is a rounded card with three figures (today's total, and two that put it in
 *  context), the last two hours' graph and a legend; a short widget keeps just the figures. The totals are the inverter's own day counters (live,
 *  in place); the graph is today's readings. */
export function EnergyTodayCards({
  inverterId,
  initial,
  pvKeys,
  cards,
}: {
  inverterId: string;
  initial: Record<string, number | null>;
  /** Accepted for the callers' shared props. */
  sync?: unknown;
  pvKeys: string[];
  /** The cards to draw, in order. */
  cards: OverviewCardId[];
}) {
  // numbers in the unit the person chose for energy and power (Application Settings > Units), else as the inverter reports them
  const u = useUnits();
  const kwhNumber = (v: number | null, key?: string) => (v === null ? "—" : u.format(v, "kWh", key, v >= 100 ? 0 : 1, false));
  const solarKeys = pvKeys.length > 0 ? pvKeys : ["inverter_output_power_w"];
  const counterKeys = [K.solar, K.load, K.charged, K.discharged, K.imported, K.exported];
  const powerKeys = [...solarKeys, "load_total_power_w", "battery_power_w", "grid_total_power_w"];

  const n = useLiveNumbers([inverterId], counterKeys, initial);
  const series = useTodaySeries(inverterId, powerKeys, 15);
  const yesterday = useYesterdayAtThisTime(inverterId, [K.solar, K.load], series.nowMs);
  // Early in the day the last two hours reach back before midnight, so yesterday's evening readings are read too (only then).
  const dayStart = istDayStart(series.nowMs);
  const earlyInDay = series.nowMs - dayStart < RECENT_WINDOW_MS;
  const yesterdayWindow = React.useMemo(() => ({ fromMs: dayStart - DAY_MS, toMs: dayStart }), [dayStart]);
  const evening = useSeriesRange(inverterId, earlyInDay ? powerKeys : [], yesterdayWindow, 15);

  // The curve of one or more power keys (summed), scaled to kW, oldest first: today's slots, with yesterday's in front of them when
  // the last two hours reach back across midnight.
  const curve = (keys: string[], sign: 1 | -1 = 1) => {
    const sumAt = (byKey: typeof series.byKey, i: number) => {
      let sum = 0;
      let any = false;
      for (const k of keys) {
        const v = byKey[k]?.[i]?.avg;
        if (v !== null && v !== undefined) {
          sum += v;
          any = true;
        }
      }
      return any ? sum * sign : null;
    };
    const axis = [...evening.axis, ...series.axis];
    const values = axis.map((_, i) => (i < evening.axis.length ? sumAt(evening.byKey, i) : sumAt(series.byKey, i - evening.axis.length)));
    return areaPoints(axis, values, series.nowMs, 0.001);
  };

  const solarCurve = curve(solarKeys);
  const loadCurve = curve(["load_total_power_w"]);
  const batteryCurve = curve(["battery_power_w"], -1); // the inverter reports discharging as positive; charging is drawn as the main colour
  const gridCurve = curve(["grid_total_power_w"]);

  // The three figures of a solar or load widget: today's total, today's peak, and the change against yesterday at this time.
  const versus = (today: number | null, yest: number | null, curveOf: ReturnType<typeof curve>, higherIsGood: boolean, totalKey: string, label: string): FigureData[] => {
    const d = deltaPct(today, yest);
    const peak = peakOf(curveOf.filter((p) => p.t >= dayStart)); // today's peak only
    return [
      { label, value: kwhNumber(today, totalKey), unit: u.unit("kWh", totalKey) },
      { label: "Peak", value: peak ? u.format(peak.v, "kW", null, 1, false) : "—", unit: peak ? u.unit("kW", null) : undefined },
      { label: "Than yesterday", value: d === null ? "—" : `${Math.abs(Math.round(d))}%`, trend: d === null ? null : { direction: d >= 0 ? "up" : "down", good: (d >= 0) === higherIsGood } },
    ];
  };

  const stored = n[K.charged] !== null && n[K.discharged] !== null ? n[K.charged]! - n[K.discharged]! : null;
  const exported = n[K.exported] !== null && n[K.imported] !== null ? n[K.exported]! - n[K.imported]! : null;
  const imported = n[K.imported];
  const load = n[K.load];
  const solarToday = n[K.solar];
  const monitoring = (tab: string) => `/dashboard/monitoring?device=${inverterId}#${tab}`;
  const kwhUnit = (key: string) => u.unit("kWh", key);
  const pct = (part: number | null, whole: number | null) => (part !== null && whole !== null && whole > 0 ? `${Math.round((part / whole) * 100)}` : "—");

  // How much of today's use did not come from the grid.
  const selfPowered = load !== null && load > 0 && imported !== null ? Math.min(100, Math.max(0, (1 - imported / load) * 100)) : null;

  const stat = (o: StatOptions) => (
    <WidgetCard icon={o.icon} tone={o.tone} title={o.title} href={o.href}>
      <Figures items={o.figures} />
      <ChartArea>
        <TodayAreaChart points={recentPoints(o.points, series.nowMs)} now={series.nowMs} posColor={o.posColor} negColor={o.negColor} posLabel={o.posLabel} negLabel={o.negLabel} />
      </ChartArea>
      <Legend items={o.legend} />
    </WidgetCard>
  );

  const flowLegend = [
    { color: AMBER, label: "Importing" },
    { color: BLUE, label: "Exporting" },
  ];

  const byId: Record<OverviewCardId, React.ReactNode> = {
    solar: stat({ icon: Sun, tone: "amber", title: "Solar generated", href: monitoring("solar"), figures: versus(solarToday, yesterday[K.solar], solarCurve, true, K.solar, "Today"), points: solarCurve, posColor: FLOW.producing, posLabel: "Solar", legend: [{ color: GREEN, label: "Solar power, last 2 hours" }] }),
    load: stat({ icon: House, tone: "blue", title: "Load consumption", href: monitoring("load"), figures: versus(load, yesterday[K.load], loadCurve, false, K.load, "Today"), points: loadCurve, posColor: FLOW.consuming, posLabel: "Load", legend: [{ color: BLUE, label: "Site power, last 2 hours" }] }),
    grid: stat({
      icon: Plug,
      tone: "sky",
      title: "Grid usage",
      href: monitoring("grid"),
      figures: [
        { label: exported !== null && exported < 0 ? "Net import" : "Net export", value: kwhNumber(exported === null ? null : Math.abs(exported), K.exported), unit: kwhUnit(K.exported), trend: exported === null ? null : { direction: exported >= 0 ? "up" : "down", good: exported >= 0 } },
        { label: "Sent out", value: kwhNumber(n[K.exported], K.exported), unit: kwhUnit(K.exported) },
        { label: "Bought in", value: kwhNumber(imported, K.imported), unit: kwhUnit(K.imported) },
      ],
      points: gridCurve,
      posColor: AMBER,
      negColor: BLUE,
      posLabel: "Importing",
      negLabel: "Exporting",
      legend: flowLegend,
    }),
    battery: stat({
      icon: BatteryCharging,
      tone: "green",
      title: "Battery usage",
      href: monitoring("battery"),
      figures: [
        { label: stored !== null && stored < 0 ? "Net used" : "Net stored", value: kwhNumber(stored === null ? null : Math.abs(stored), K.charged), unit: kwhUnit(K.charged), trend: stored === null ? null : { direction: stored >= 0 ? "up" : "down", good: stored >= 0 } },
        { label: "Charged", value: kwhNumber(n[K.charged], K.charged), unit: kwhUnit(K.charged) },
        { label: "Discharged", value: kwhNumber(n[K.discharged], K.discharged), unit: kwhUnit(K.discharged) },
      ],
      points: batteryCurve,
      posColor: GREEN,
      negColor: AMBER,
      posLabel: "Charging",
      negLabel: "Discharging",
      legend: [
        { color: GREEN, label: "Charging" },
        { color: AMBER, label: "Discharging" },
      ],
    }),
    selfpowered: stat({
      icon: Gauge,
      tone: "emerald",
      title: "Self-powered",
      href: monitoring("grid"),
      figures: [
        { label: "Not from the grid", value: selfPowered === null ? "—" : selfPowered.toFixed(0), unit: "%" },
        { label: "Bought", value: kwhNumber(imported, K.imported), unit: kwhUnit(K.imported) },
        { label: "Used", value: kwhNumber(load, K.load), unit: kwhUnit(K.load) },
      ],
      points: gridCurve,
      posColor: AMBER,
      negColor: BLUE,
      posLabel: "Importing",
      negLabel: "Exporting",
      legend: flowLegend,
    }),
    exported: stat({
      icon: ArrowUpFromLine,
      tone: "cyan",
      title: "Sent to the grid",
      href: monitoring("grid"),
      figures: [
        { label: "Today", value: kwhNumber(n[K.exported], K.exported), unit: kwhUnit(K.exported) },
        { label: "Of the solar made", value: pct(n[K.exported], solarToday), unit: "%" },
        { label: "Solar made", value: kwhNumber(solarToday, K.solar), unit: kwhUnit(K.solar) },
      ],
      points: gridCurve,
      posColor: AMBER,
      negColor: BLUE,
      posLabel: "Importing",
      negLabel: "Exporting",
      legend: flowLegend,
    }),
    imported: stat({
      icon: ArrowDownToLine,
      tone: "indigo",
      title: "Bought from the grid",
      href: monitoring("grid"),
      figures: [
        { label: "Today", value: kwhNumber(imported, K.imported), unit: kwhUnit(K.imported) },
        { label: "Of what you used", value: pct(imported, load), unit: "%" },
        { label: "Used", value: kwhNumber(load, K.load), unit: kwhUnit(K.load) },
      ],
      points: gridCurve,
      posColor: AMBER,
      negColor: BLUE,
      posLabel: "Importing",
      negLabel: "Exporting",
      legend: flowLegend,
    }),
  };

  return (
    <>
      {cards.map((id) => (
        <React.Fragment key={id}>{byId[id]}</React.Fragment>
      ))}
    </>
  );
}
