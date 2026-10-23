/** The period the Charging sessions page (and its CSV) looks at: today, the last 7 or 30 days, or two dates the person typed. Days are India days. Pure, so it is tested without a page. */

export type EvPeriodKey = "today" | "7d" | "30d" | "custom";

export interface EvPeriod {
  key: EvPeriodKey;
  /** first and last day, YYYY-MM-DD (India time), both included */
  from: string;
  to: string;
  /** the same period as moments: from the start of `from` up to (not including) the start of the day after `to` */
  fromIso: string;
  toIso: string;
  label: string;
}

const IST_MS = 19_800_000;
const DAY_MS = 86_400_000;
export const MAX_EV_PERIOD_DAYS = 366;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

const istDay = (ms: number): string => new Date(ms + IST_MS).toISOString().slice(0, 10);
const dayStartMs = (day: string): number => Date.parse(`${day}T00:00:00Z`) - IST_MS;
const addDays = (day: string, n: number): string => istDay(dayStartMs(day) + n * DAY_MS);
const isRealDay = (s: string | undefined): s is string => !!s && DAY.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;

const dayText = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

function make(key: EvPeriodKey, from: string, to: string, label: string): EvPeriod {
  return { key, from, to, fromIso: new Date(dayStartMs(from)).toISOString(), toIso: new Date(dayStartMs(addDays(to, 1))).toISOString(), label };
}

/** `period` is "today" (the default), "7d", "30d" or "custom" (with `from` and `to`). An unusable custom range falls back to today, never to an error. */
export function resolveEvPeriod(q: { period?: string; from?: string; to?: string }, nowMs: number): EvPeriod {
  const today = istDay(nowMs);
  if (q.period === "7d") return make("7d", addDays(today, -6), today, "Last 7 days");
  if (q.period === "30d") return make("30d", addDays(today, -29), today, "Last 30 days");
  if (q.period === "custom" && isRealDay(q.from) && isRealDay(q.to) && q.to >= q.from) {
    const days = Math.round((dayStartMs(q.to) - dayStartMs(q.from)) / DAY_MS) + 1;
    if (days <= MAX_EV_PERIOD_DAYS) return make("custom", q.from, q.to, q.from === q.to ? dayText(q.from) : `${dayText(q.from)} to ${dayText(q.to)}`);
  }
  return make("today", today, today, "Today");
}

/** The query string for a period (without the device), for the links and the CSV address. */
export function periodQuery(p: EvPeriod): string {
  return p.key === "custom" ? `period=custom&from=${p.from}&to=${p.to}` : `period=${p.key}`;
}
