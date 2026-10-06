// Which range the user picked, what the database can serve for it, and what the chart should default to.
// Pure functions - the rules live here, and are tested, instead of being scattered through the screens.

import { istDayStart } from "./combine";

export type RangePreset = "today" | "7d" | "30d" | "90d" | "custom";

export const DAY_MS = 86_400_000;
/** At most this many days in a custom window. */
export const CUSTOM_MAX_DAYS = 30;
/** 15-minute buckets are kept for 8 days; older data exists as hourly and daily rollups only. */
export const FINE_RETENTION_MS = 8 * DAY_MS;
/** The database refuses more points than this per metric in one call. */
export const MAX_POINTS = 750;

export interface RangeWindow {
  fromMs: number;
  /** Exclusive. */
  toMs: number;
}

/** The window for a preset. "7 days" means today and the six days before it (IST days). */
export function windowFor(preset: RangePreset, nowMs: number, customStart?: string | null): RangeWindow {
  const today = istDayStart(nowMs);
  switch (preset) {
    case "today":
      return { fromMs: today, toMs: today + DAY_MS };
    case "7d":
      return { fromMs: today - 6 * DAY_MS, toMs: today + DAY_MS };
    case "30d":
      return { fromMs: today - 29 * DAY_MS, toMs: today + DAY_MS };
    case "90d":
      return { fromMs: today - 89 * DAY_MS, toMs: today + DAY_MS };
    case "custom": {
      const start = customStart ? istDayStart(new Date(`${customStart}T12:00:00+05:30`).getTime()) : today;
      return { fromMs: start, toMs: Math.min(start + CUSTOM_MAX_DAYS * DAY_MS, today + DAY_MS) };
    }
  }
}

export interface RangePlan {
  /** The interval fetched from the database (the others are combined from it in the browser). */
  base: number;
  /** The intervals the picker offers. */
  options: number[];
  default: number;
}

const ALL_INTERVALS = [15, 30, 60, 120, 1440];

/** What can be served for a window, given the retention of the fine data and the point cap. */
export function planRange(w: RangeWindow, nowMs: number): RangePlan {
  const minutes = (w.toMs - w.fromMs) / 60_000;
  const fineAvailable = w.fromMs >= nowMs - FINE_RETENTION_MS;
  const options = ALL_INTERVALS.filter((i) => (i >= 60 || fineAvailable) && minutes / i <= MAX_POINTS && minutes / i >= 2);
  if (options.length === 0) options.push(1440);
  // The default for a span: a day shows 15 minutes, a week 1 hour, a month 2 hours, longer a day per point
  // (or the nearest the data allows).
  const days = minutes / 1440;
  const wanted = days <= 1 ? 15 : days <= 8 ? 60 : days <= 31 ? 120 : 1440;
  const preferred = options.reduce((best, i) => (Math.abs(i - wanted) < Math.abs(best - wanted) ? i : best), options[0]);
  // Fetch the finest interval that is still within the cap and the data tier, so every coarser view is a local combine.
  const base = options[0];
  return { base, options, default: preferred };
}

/** Is `day` (YYYY-MM-DD) a valid first day for a custom window: not before the first reading, not in the future. */
export function isValidCustomStart(day: string, firstDay: string | null, today: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  if (firstDay && day < firstDay) return false;
  return day <= today;
}
