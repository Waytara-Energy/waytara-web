"use client";

import * as React from "react";
import { areaPoints, deltaPct, fmtKwh, recentPoints, RECENT_WINDOW_MS, peakOf, slotIndex, TODAY_COUNTER_KEYS as K } from "@/lib/energy-today";
import { istDayStart } from "@/lib/telemetry/combine";
import { useLiveNumbers } from "@/lib/telemetry/live-values";
import { useSeriesRange, useTodaySeries } from "@/lib/telemetry/react";
import { TodayStatCard } from "./today-stat-card";
import { FLOW } from "./flow-colors";

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

const kwhNumber = (v: number | null) => (v === null ? "—" : v.toFixed(v >= 100 ? 0 : 1));
const istClock = (ms: number) => new Date(ms + 19_800_000).toISOString().slice(11, 16);

/** Overview's four "today" cards - solar generated, grid, load consumption, battery - each opening its Monitoring tab.
 *  The totals are the inverter's own day counters (live, in place); the dots are today's readings. */
export function EnergyTodayCards({
  inverterId,
  initial,
  pvKeys,
  which,
}: {
  inverterId: string;
  initial: Record<string, number | null>;
  /** Accepted for the callers' shared props. */
  sync?: unknown;
  pvKeys: string[];
  /** Left of the energy flow: solar and grid. Right: load and battery. */
  which: "left" | "right";
}) {
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

  // What sits under a total: the comparison with yesterday at this time when there is one, otherwise today's peak.
  const versus = (today: number | null, yest: number | null, curveOf: ReturnType<typeof curve>, higherIsGood: boolean) => {
    const d = deltaPct(today, yest);
    const peak = peakOf(curveOf.filter((p) => p.t >= dayStart)); // today's peak only
    const detail = d !== null ? `${Math.abs(Math.round(d))}% ${d >= 0 ? "more" : "less"} than yesterday` : peak ? `Peak ${peak.v.toFixed(1)} kW at ${istClock(peak.t)}` : "No readings yet";
    return { detail, trend: d === null ? null : { direction: d >= 0 ? ("up" as const) : ("down" as const), good: (d >= 0) === higherIsGood } };
  };

  const solar = versus(n[K.solar], yesterday[K.solar], solarCurve, true);
  const load = versus(n[K.load], yesterday[K.load], loadCurve, false);

  const stored = n[K.charged] !== null && n[K.discharged] !== null ? n[K.charged]! - n[K.discharged]! : null;
  const exported = n[K.exported] !== null && n[K.imported] !== null ? n[K.exported]! - n[K.imported]! : null;
  const monitoring = (tab: string) => `/dashboard/monitoring?device=${inverterId}#${tab}`;

  const solarCard = (
      <TodayStatCard
        title="Solar generated today"
        href={monitoring("solar")}
        value={kwhNumber(n[K.solar])}
        unit="kWh"
        trend={solar.trend}
        detail={solar.detail}
        points={recentPoints(solarCurve, series.nowMs)}
        now={series.nowMs}
        posColor={FLOW.producing}
        posLabel="Solar"
      />
  );

  const gridCard = (
      <TodayStatCard
        title="Grid usage today"
        href={monitoring("grid")}
        value={kwhNumber(exported === null ? null : Math.abs(exported))}
        unit="kWh"
        trend={exported === null ? null : { direction: exported >= 0 ? "up" : "down", good: exported >= 0 }}
        detail={`Net ${exported !== null && exported < 0 ? "import" : "export"} · ${fmtKwh(n[K.exported])} out, ${fmtKwh(n[K.imported])} in`}
        points={recentPoints(gridCurve, series.nowMs)}
        now={series.nowMs}
        posColor={AMBER}
        negColor={BLUE}
        posLabel="Importing"
        negLabel="Exporting"
      />
  );

  const loadCard = (
      <TodayStatCard
        title="Load consumption today"
        href={monitoring("load")}
        value={kwhNumber(n[K.load])}
        unit="kWh"
        trend={load.trend}
        detail={load.detail}
        points={recentPoints(loadCurve, series.nowMs)}
        now={series.nowMs}
        posColor={FLOW.consuming}
        posLabel="Load"
      />
  );

  const batteryCard = (
      <TodayStatCard
        title="Battery usage today"
        href={monitoring("battery")}
        value={kwhNumber(stored === null ? null : Math.abs(stored))}
        unit="kWh"
        trend={stored === null ? null : { direction: stored >= 0 ? "up" : "down", good: stored >= 0 }}
        detail={`Net ${stored !== null && stored < 0 ? "used" : "stored"} · ${fmtKwh(n[K.charged])} in, ${fmtKwh(n[K.discharged])} out`}
        points={recentPoints(batteryCurve, series.nowMs)}
        now={series.nowMs}
        posColor={GREEN}
        negColor={AMBER}
        posLabel="Charging"
        negLabel="Discharging"
      />
  );

  return which === "left" ? (
    <>
      {solarCard}
      {gridCard}
    </>
  ) : (
    <>
      {loadCard}
      {batteryCard}
    </>
  );
}
