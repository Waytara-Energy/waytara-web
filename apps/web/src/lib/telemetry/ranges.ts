// Which range the user picked, what the database can serve for it, and what the chart should default to.
// Pure functions - the rules live here, and are tested, instead of being scattered through the screens.

import { istDayStart } from "./combine";

export type RangePreset = "today" | "7d" | "30d" | "90d" | "1y" | "2y" | "custom";

export const DAY_MS = 86_400_000;
/** At most this many days in a custom window (first and last day included). */
export const CUSTOM_MAX_DAYS = 90;
/** A custom window saved before it had an end day ran this many days from its start. */
const LEGACY_CUSTOM_DAYS = 30;
/** 15-minute buckets are kept for 8 days; older data exists as hourly and daily rollups only. */
export const FINE_RETENTION_MS = 8 * DAY_MS;
/** The database refuses more points than this per metric in one call. */
export const MAX_POINTS = 750;

export interface RangeWindow {
  fromMs: number;
  /** Exclusive. */
  toMs: number;
}

/** The window for a preset. "7 days" means today and the six days before it (IST days); "1 year" is 365 days and "2 years" 730
 *  days, both ending today (730 daily points is within the 750-point cap). */
export function windowFor(preset: RangePreset, nowMs: number, customStart?: string | null, customEnd?: string | null): RangeWindow {
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
    case "1y":
      return { fromMs: today - 364 * DAY_MS, toMs: today + DAY_MS };
    case "2y":
      return { fromMs: today - 729 * DAY_MS, toMs: today + DAY_MS };
    case "custom": {
      // From the first day to the end of the last day chosen (a single day when both are the same), at most 90 days, never past today.
      // A window saved without an end day keeps its old length.
      const start = Math.min(customStart ? istDayStart(new Date(`${customStart}T12:00:00+05:30`).getTime()) : today, today);
      const asked = customEnd ? istDayStart(new Date(`${customEnd}T12:00:00+05:30`).getTime()) : start + (LEGACY_CUSTOM_DAYS - 1) * DAY_MS;
      const last = Math.min(Math.max(asked, start), start + (CUSTOM_MAX_DAYS - 1) * DAY_MS, today);
      return { fromMs: start, toMs: last + DAY_MS };
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

/** The two days a person tapped, as a range that is allowed: the earlier first, nothing before the first reading or after today, and no more
 *  than `maxDays` days (the last day is pulled back to fit). Days are YYYY-MM-DD, which sort as text. */
export function normalizeRange(a: string, b: string, today: string, firstDay: string | null, maxDays = CUSTOM_MAX_DAYS): { start: string; end: string } {
  let [start, end] = a <= b ? [a, b] : [b, a];
  if (firstDay && start < firstDay) start = firstDay;
  if (end > today) end = today;
  if (start > end) start = end;
  const limit = new Date(Date.parse(`${start}T00:00:00Z`) + (maxDays - 1) * DAY_MS).toISOString().slice(0, 10);
  if (end > limit) end = limit;
  return { start, end };
}

/** A range in words for a picker button: "9 Oct 2026" for one day, "9 - 20 Oct 2026" within a month, "28 Sep - 3 Oct 2026" across months, with the
 *  year on both ends when they differ. */
export function rangeLabel(start: string, end: string): string {
  const part = (day: string, o: Intl.DateTimeFormatOptions) => new Date(`${day}T00:00:00Z`).toLocaleDateString("en-IN", { ...o, timeZone: "UTC" });
  if (start >= end) return part(start, { day: "numeric", month: "short", year: "numeric" });
  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  const sameMonth = sameYear && start.slice(5, 7) === end.slice(5, 7);
  if (sameMonth) return `${part(start, { day: "numeric" })} - ${part(end, { day: "numeric", month: "short", year: "numeric" })}`;
  if (sameYear) return `${part(start, { day: "numeric", month: "short" })} - ${part(end, { day: "numeric", month: "short", year: "numeric" })}`;
  return `${part(start, { day: "numeric", month: "short", year: "numeric" })} - ${part(end, { day: "numeric", month: "short", year: "numeric" })}`;
}

/** Is `day` (YYYY-MM-DD) a valid first day for a custom window: not before the first reading, not in the future. */
export function isValidCustomStart(day: string, firstDay: string | null, today: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  if (firstDay && day < firstDay) return false;
  return day <= today;
}
