import { addDays } from "./period-math";
import { findDayGaps, type DayGap } from "@/lib/data-gaps";

/**
 * The days with no reading inside a period of daily figures: after the first day with a reading, up to the period's last day (up to yesterday
 * when the period runs into today, since today is still going). `rows` are the days that have a reading.
 */
export function daysWithoutReadings(rows: readonly { day: string }[], from: string, to: string, today: string): DayGap[] {
  const end = to >= today ? addDays(today, -1) : to;
  if (end < from) return [];
  return findDayGaps(rows.map((r) => r.day), from, end);
}
