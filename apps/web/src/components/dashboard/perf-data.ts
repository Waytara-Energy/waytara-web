"use client";

import * as React from "react";
import { istDate, istDayStart } from "@/lib/telemetry/combine";
import { useSeriesRange, useTodaySeries } from "@/lib/telemetry/react";
import { dayCounterValues, sumOf } from "@/lib/performance-period";
import { DAY_MS, type RangePreset, type RangeWindow } from "@/lib/telemetry/ranges";

const PRESET_TEXT: Record<Exclude<RangePreset, "custom">, string> = { today: "today", "7d": "7 days", "30d": "30 days", "90d": "90 days", "1y": "1 year", "2y": "2 years" };

/** The chosen period in words, for headings and tile labels ("7 days", "1 year", "3 Oct - 12 Oct"). */
export function periodText(preset: RangePreset, w: RangeWindow): string {
  if (preset !== "custom") return PRESET_TEXT[preset];
  const fmt = (ms: number) => new Date(ms + 19_800_000).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
  const last = w.toMs - DAY_MS;
  return last <= w.fromMs ? fmt(w.fromMs) : `${fmt(w.fromMs)} - ${fmt(last)}`;
}

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
 *  the energy of a power metric (its average x the seconds it covered). A window of a single day (Today) is read from the
 *  last week's daily values and cut to that day, because one day alone is served in 15-minute slots, not as a daily value. */
export function useDailyHistory(deviceId: string, keys: string[], w: RangeWindow) {
  const [todayIso] = React.useState(() => istDate(Date.now()));
  const fetchWindow = React.useMemo<RangeWindow>(() => (w.toMs - w.fromMs < 2 * DAY_MS ? { fromMs: w.toMs - 7 * DAY_MS, toMs: w.toMs } : w), [w]);
  const state = useSeriesRange(deviceId, keys, fetchWindow, 1440);

  return React.useMemo(() => {
    const keep = state.axis.map((t) => t >= w.fromMs && t < w.toMs);
    const only = <T,>(values: T[]): T[] => values.filter((_, i) => keep[i]);
    const days = only(state.axis.map((t) => istDate(t)));
    const counter = (key: string): (number | null)[] => only(dayCounterValues((state.byKey[key] ?? []).map((p) => ({ max: p ? p.max : null, last: p ? p.last : null }))));
    const powerEnergyKwh = (key: string): (number | null)[] => only((state.byKey[key] ?? []).map((p) => (p && p.avg !== null ? (p.avg * p.covered) / 3_600_000 : null)));
    const average = (key: string): (number | null)[] => only((state.byKey[key] ?? []).map((p) => (p ? p.avg : null)));
    const maximum = (key: string): (number | null)[] => only((state.byKey[key] ?? []).map((p) => (p ? p.max : null)));
    return { days, counter, powerEnergyKwh, average, maximum, today: todayIso, loading: state.status === "loading", error: state.error, retry: state.retry };
  }, [state, w, todayIso]);
}

/** Time series over the chosen period at the interval the window allows (15 minutes for a day, hourly for a week, 2-hourly for a
 *  month, daily beyond), with the average, highest and lowest value of each slot. */
export function usePeriodSeries(deviceId: string, keys: string[], w: RangeWindow) {
  const state = useSeriesRange(deviceId, keys, w, null);
  return React.useMemo(() => {
    const pick = (key: string, f: (p: { avg: number | null; min: number | null; max: number | null }) => number | null): (number | null)[] => (state.byKey[key] ?? []).map((p) => (p ? f(p) : null));
    return {
      axis: state.axis,
      minutes: state.minutes,
      nowMs: state.nowMs,
      avg: (key: string) => pick(key, (p) => p.avg),
      max: (key: string) => pick(key, (p) => p.max),
      min: (key: string) => pick(key, (p) => p.min),
      /** kWh from a power series in W: each slot's average x the seconds it covered. */
      energyKwh: (key: string) => sumOf((state.byKey[key] ?? []).map((p) => (p && p.avg !== null ? (p.avg * p.covered) / 3_600_000 : null))),
      loading: state.status === "loading",
      error: state.error,
      retry: state.retry,
    };
  }, [state]);
}

/** "dd Mon" for a YYYY-MM-DD day ("dd Mon yy" when `withYear`, for charts that span more than a year). */
export function dayLabel(day: string, withYear = false): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", ...(withYear ? { year: "2-digit" as const } : {}), timeZone: "UTC" });
}

/** A chart of this many daily bars is long enough to need the year in its labels. */
export const LONG_SPAN_DAYS = 300;
