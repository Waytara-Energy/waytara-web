// The period a cadence download may cover. Pure, so the page (to say what is wrong before asking) and the backend (which enforces the
// same limits) agree. Days are India days (UTC+5:30, no daylight saving).

/** The history is kept for four weeks: today and the 27 days before it. */
export const CADENCE_RETENTION_DAYS = 28;
/** One file covers at most a week; several downloads cover the whole history. */
export const CADENCE_MAX_DAYS = 7;
/** Values per file. */
export const CADENCE_MAX_KEYS = 40;

const IST_MS = 19_800_000;
const DAY_MS = 86_400_000;

export const todayIst = (nowMs: number = Date.now()): string => new Date(nowMs + IST_MS).toISOString().slice(0, 10);

export function isDay(day: unknown): day is string {
  if (typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const d = new Date(`${day}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === day;
}

export const addDays = (day: string, n: number): string => new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
export const istDayStartMs = (day: string): number => Date.parse(`${day}T00:00:00Z`) - IST_MS;

/** The oldest day the history reaches back to. */
export const oldestDay = (nowMs: number = Date.now()): string => addDays(todayIst(nowMs), -(CADENCE_RETENTION_DAYS - 1));

export type PeriodPlan = { ok: true; fromMs: number; toMs: number; days: number; firstDay: string; lastDay: string } | { ok: false; error: string };

/** The first day and how many days, as a time range for the backend. A period that runs past now is cut at now. */
export function planPeriod(firstDay: string, days: number, nowMs: number = Date.now()): PeriodPlan {
  if (!isDay(firstDay)) return { ok: false, error: "Pick a valid first day." };
  if (!Number.isInteger(days) || days < 1 || days > CADENCE_MAX_DAYS) return { ok: false, error: `One file covers 1 to ${CADENCE_MAX_DAYS} days. Pick a day, 7 days, or a start day.` };
  const today = todayIst(nowMs);
  const oldest = oldestDay(nowMs);
  if (firstDay > today) return { ok: false, error: "That day has not happened yet." };
  if (firstDay < oldest) return { ok: false, error: `The readings are kept for ${CADENCE_RETENTION_DAYS} days; the oldest day is ${oldest}.` };
  const fromMs = istDayStartMs(firstDay);
  const toMs = Math.min(fromMs + days * DAY_MS, nowMs);
  const lastDay = addDays(firstDay, days - 1) > today ? today : addDays(firstDay, days - 1);
  return { ok: true, fromMs, toMs, days: Math.max(1, Math.round((istDayStartMs(lastDay) - fromMs) / DAY_MS) + 1), firstDay, lastDay };
}
