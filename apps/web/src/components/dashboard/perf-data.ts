"use client";

import * as React from "react";
import { istDate, istDayStart } from "@/lib/telemetry/combine";
import { useSeriesRange, useTodaySeries } from "@/lib/telemetry/react";
import { DAY_MS, windowFor, type RangePreset, type RangeWindow } from "@/lib/telemetry/ranges";

export type HistoryPreset = Extract<RangePreset, "7d" | "30d" | "90d">;

/** Multiplies a curve (0.001 turns W into kW). */
export function scaleCurve(values: (number | null)[], factor: number): (number | null)[] {
  return values.map((v) => (v === null || v === undefined ? null : v * factor));
}

/** The 15-minute curves of today and yesterday for some metrics, on one shared 96-slot axis. Values are the slot
 *  averages in the metric's own unit. */
export function useDayCurves(deviceId: string, keys: string[]) {
  const today = useTodaySeries(deviceId, keys, 15);
  const [yesterdayWindow] = React.useState<RangeWindow>(() => {
    const start = istDayStart(Date.now());
    return { fromMs: start - DAY_MS, toMs: start };
  });
  const yesterday = useSeriesRange(deviceId, keys, yesterdayWindow, 15);
  const keysSig = keys.join("|");

  return React.useMemo(() => {
    const pick = (state: { byKey: Record<string, ({ avg: number | null } | null)[]> }, key: string): (number | null)[] =>
      (state.byKey[key] ?? []).map((p) => (p && p.avg !== null ? p.avg : null));
    const curves = (state: { byKey: Record<string, ({ avg: number | null } | null)[]> }) => Object.fromEntries(keys.map((k) => [k, pick(state, k)]));
    return {
      axis: today.axis,
      dayStart: today.axis[0] ?? 0,
      nowMs: today.nowMs,
      today: curves(today),
      yesterday: curves(yesterday),
      loading: today.status === "loading" || yesterday.status === "loading",
      error: today.error ?? yesterday.error,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today, yesterday, keysSig]);
}

/** Today's curve with the future cut off (the line stops at "now"). */
export function untilNow(values: (number | null)[], axis: number[], nowMs: number): (number | null)[] {
  return values.map((v, i) => (axis[i] !== undefined && axis[i] > nowMs ? null : v));
}

/** One value per day over a history window: a counter's highest reading of the day (for "today so far" kWh counters), or
 *  the energy of a power metric (its average x the seconds it covered). */
export function useDailyHistory(deviceId: string, keys: string[], preset: HistoryPreset) {
  const [nowMs] = React.useState(() => Date.now());
  const window = React.useMemo(() => windowFor(preset, nowMs), [preset, nowMs]);
  const state = useSeriesRange(deviceId, keys, window, 1440);

  return React.useMemo(() => {
    const days = state.axis.map((t) => istDate(t));
    const counter = (key: string): (number | null)[] => (state.byKey[key] ?? []).map((p) => (p && p.max !== null ? p.max : null));
    const powerEnergyKwh = (key: string): (number | null)[] => (state.byKey[key] ?? []).map((p) => (p && p.avg !== null ? (p.avg * p.covered) / 3_600_000 : null));
    const average = (key: string): (number | null)[] => (state.byKey[key] ?? []).map((p) => (p ? p.avg : null));
    const maximum = (key: string): (number | null)[] => (state.byKey[key] ?? []).map((p) => (p ? p.max : null));
    return { days, counter, powerEnergyKwh, average, maximum, loading: state.status === "loading", error: state.error, retry: state.retry };
  }, [state]);
}

/** "dd Mon" for a YYYY-MM-DD day. */
export function dayLabel(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
}

export const HISTORY_OPTIONS: { id: HistoryPreset; label: string }[] = [
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "90d", label: "90 days" },
];
