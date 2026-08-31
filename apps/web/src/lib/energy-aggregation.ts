export interface RawReading {
  device_id: string;
  value: number | null;
  ts: string;
}

export interface DailyPoint {
  date: string; // YYYY-MM-DD
  value: number;
}

/**
 * `daily_yield_kwh` is a running-for-the-day counter per device (resets
 * each morning, climbs through the day as the inverter reports) — so the
 * max value seen per device per calendar day is that day's total. Shared
 * by Performance, Analytics, and Reports so the three pages can never
 * silently disagree on what "today's yield" means.
 */
export function maxByDeviceDay(readings: RawReading[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of readings) {
    if (r.value == null) continue;
    const day = r.ts.slice(0, 10);
    const key = `${r.device_id}:${day}`;
    const current = map.get(key);
    if (current === undefined || r.value > current) map.set(key, r.value);
  }
  return map;
}

/** Collapses a `${deviceId}:${date}` -> value map into a per-day household
 *  total (summed across every device), sorted date-ascending. */
export function sumByDay(perDeviceDay: Map<string, number>): DailyPoint[] {
  const totals = new Map<string, number>();
  for (const [key, value] of perDeviceDay) {
    const day = key.split(":")[1];
    totals.set(day, (totals.get(day) ?? 0) + value);
  }
  return Array.from(totals.entries())
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Raw readings -> household daily totals in one step. */
export function aggregateDailyYield(readings: RawReading[]): DailyPoint[] {
  return sumByDay(maxByDeviceDay(readings));
}
