// The period picker on the Downloads tab: a single day (with its date), the last 7 / 30 / 90 days, or up to 30 days from a day the
// customer picks. Pure, so the picker, the series report and its downloads agree on the dates.

import { addDays, daysInclusive } from "./period-math";

export type PeriodMode = "day" | "7d" | "30d" | "90d" | "custom";

export interface PeriodChoice {
  mode: PeriodMode;
  /** The day shown in "day" mode. */
  date: string;
  /** The first day of a custom window. */
  customStart: string;
}

export const PERIOD_MODES: { id: Exclude<PeriodMode, "custom">; label: string }[] = [
  { id: "day", label: "Day" },
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "90d", label: "90 days" },
];

export const CUSTOM_MAX_DAYS = 30;

export const defaultChoice = (today: string): PeriodChoice => ({ mode: "day", date: today, customStart: addDays(today, -6) });

/** The first day, the number of days and the last day this choice covers (never past `today`). */
export function resolveChoice(c: PeriodChoice, today: string): { start: string; days: number; end: string } {
  const start = c.mode === "day" ? c.date : c.mode === "7d" ? addDays(today, -6) : c.mode === "30d" ? addDays(today, -29) : c.mode === "90d" ? addDays(today, -89) : c.customStart;
  const days = c.mode === "day" ? 1 : c.mode === "custom" ? Math.min(CUSTOM_MAX_DAYS, daysInclusive(c.customStart, today)) : c.mode === "7d" ? 7 : c.mode === "30d" ? 30 : 90;
  return { start, days, end: addDays(start, days - 1) };
}

/** What the picker button says: "Today", "9 Oct 2026", "7 days", "From 8 Oct 2026". */
export function choiceLabel(c: PeriodChoice, today: string): string {
  const fmt = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  if (c.mode === "day") return c.date === today ? "Today" : fmt(c.date);
  if (c.mode === "custom") return `From ${fmt(c.customStart)}`;
  return PERIOD_MODES.find((m) => m.id === c.mode)?.label ?? "Day";
}
