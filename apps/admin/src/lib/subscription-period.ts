// The period of a recorded subscription: it starts on a day in India and runs for whole months.

const IST = "+05:30";

/** The day `months` months after `day` (YYYY-MM-DD). A day that does not exist in that month (31 Jan + 1 month) becomes its last day. */
export function addMonthsToDay(day: string, months: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(d, lastDay));
  return first.toISOString().slice(0, 10);
}

/** The period as the database takes it: both ends at midnight India time. Null when the day is not a real date or the length is not 1 to 36 months. */
export function subscriptionPeriod(startDay: string, months: number): { start: string; end: string } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDay) || Number.isNaN(Date.parse(startDay))) return null;
  if (!Number.isInteger(months) || months < 1 || months > 36) return null;
  return { start: `${startDay}T00:00:00${IST}`, end: `${addMonthsToDay(startDay, months)}T00:00:00${IST}` };
}
