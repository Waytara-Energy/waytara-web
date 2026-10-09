// When a saved report is generated and e-mailed: every day, every week on a weekday, or every month on a date, at a time of day in
// India time (UTC+5:30, no daylight saving). Pure, so the screen, the saving action and the scheduled job agree.

export type ScheduleKind = "none" | "daily" | "weekly" | "monthly";

export interface Schedule {
  kind: ScheduleKind;
  /** "HH:MM", India time. */
  time: string;
  /** 0 = Sunday ... 6 = Saturday (weekly). */
  dow?: number | null;
  /** 1-28, or 0 for the last day of the month (monthly). */
  dom?: number | null;
}

const IST_MS = 19_800_000;
const DAY_MS = 86_400_000;
export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const isTime = (t: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);

/** The next moment after `after` this schedule fires, or null for "none" / a schedule that is incomplete. */
export function nextRunAt(s: Schedule, after: Date): Date | null {
  if (s.kind === "none" || !isTime(s.time)) return null;
  if (s.kind === "weekly" && (s.dow === null || s.dow === undefined)) return null;
  if (s.kind === "monthly" && (s.dom === null || s.dom === undefined)) return null;
  const [h, m] = s.time.split(":").map(Number);
  const nowIst = after.getTime() + IST_MS;
  const dayStartIst = Math.floor(nowIst / DAY_MS) * DAY_MS;
  for (let i = 0; i <= 62; i++) {
    const dayIst = dayStartIst + i * DAY_MS;
    const d = new Date(dayIst);
    const matches =
      s.kind === "daily" ||
      (s.kind === "weekly" && d.getUTCDay() === s.dow) ||
      (s.kind === "monthly" && (s.dom === 0 ? new Date(dayIst + DAY_MS).getUTCDate() === 1 : d.getUTCDate() === s.dom));
    if (!matches) continue;
    const at = dayIst + (h * 60 + m) * 60_000;
    if (at > nowIst) return new Date(at - IST_MS);
  }
  return null;
}

const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"}`;

export function describeSchedule(s: Schedule): string {
  if (s.kind === "none") return "Not scheduled";
  if (s.kind === "daily") return `Every day at ${s.time}`;
  if (s.kind === "weekly") return `Every ${WEEKDAYS[s.dow ?? 1]} at ${s.time}`;
  return `Every month on ${s.dom === 0 ? "the last day" : `the ${ordinal(s.dom ?? 1)}`} at ${s.time}`;
}
