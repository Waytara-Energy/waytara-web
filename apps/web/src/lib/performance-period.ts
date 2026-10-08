// Figures for the period chosen on the Performance page (today, 7 days ... a custom window), worked out from the day-by-day
// counters and the time series of the window. Pure functions, so the rules are tested.

export type Series = (number | null)[];

const ISTOFFSET_MS = 19_800_000;

export const maxOf = (values: Series): number | null => values.reduce<number | null>((m, v) => (v === null || v === undefined ? m : m === null || v > m ? v : m), null);
export const minOf = (values: Series): number | null => values.reduce<number | null>((m, v) => (v === null || v === undefined ? m : m === null || v < m ? v : m), null);
export const sumOf = (values: Series): number => values.reduce<number>((s, v) => s + (v ?? 0), 0);

/** The highest positive value and when (the axis entry) it happened. */
export function peakAt(axis: number[], values: Series): { v: number; t: number } | null {
  let best: { v: number; t: number } | null = null;
  values.forEach((v, i) => {
    if (v !== null && v !== undefined && v > 0 && axis[i] !== undefined && (best === null || v > best.v)) best = { v, t: axis[i] };
  });
  return best;
}

/** The day's value of a "kWh so far today" counter, from the highest and the last reading of each IST day (oldest first).
 *  The highest reading is the day's total - except in the first minutes after midnight, when the inverter has not yet reset the
 *  counter and still reports yesterday's total: then the day's highest reading is yesterday's figure again, and the last
 *  reading is the right one. */
export function dayCounterValues(days: { max: number | null; last: number | null }[]): Series {
  let previousMax: number | null = null;
  return days.map((d) => {
    let value = d.max;
    if (value !== null && d.last !== null && previousMax !== null && Math.abs(value - previousMax) <= 0.05 && d.last < value - 0.05) value = d.last;
    if (d.max !== null) previousMax = d.max;
    return value;
  });
}

/** One value per day from a daily counter ("kWh so far today"). Today's value is the live reading when there is one - it is the
 *  inverter's own figure, and never behind or ahead of it. */
export function dailySeries(days: string[], values: Series, liveToday?: number | null, todayIso?: string): { date: string; value: number }[] {
  return days.flatMap((d, i) => {
    let v = values[i];
    if (todayIso !== undefined && d === todayIso && typeof liveToday === "number" && Number.isFinite(liveToday)) v = liveToday;
    return v !== null && v !== undefined ? [{ date: d, value: v }] : [];
  });
}

/** The average of a power series between two hours of the (IST) day, across every day in the window - for the standby draw in
 *  the small hours. Null when the series is too coarse to have a slot inside those hours. */
export function averageAtHours(axis: number[], values: Series, fromHour: number, toHour: number): number | null {
  let total = 0;
  let n = 0;
  axis.forEach((t, i) => {
    const v = values[i];
    if (v === null || v === undefined) return;
    const hour = new Date(t + ISTOFFSET_MS).getUTCHours();
    if (hour >= fromHour && hour < toHour) {
      total += v;
      n += 1;
    }
  });
  return n > 0 ? total / n : null;
}

/** Conversion efficiency over a period: AC energy out / DC energy in, over the slots where both are known and the inverter
 *  is working. Both series are in the same unit and slot. */
export function periodEfficiency(ac: Series, dc: Series, minDc = 0.3, minAc = 0.1): { pct: number | null; perSlot: Series } {
  let acSum = 0;
  let dcSum = 0;
  const perSlot = ac.map((a, i) => {
    const d = dc[i];
    if (a === null || a === undefined || d === null || d === undefined || d < minDc || a < minAc) return null;
    const e = (a / d) * 100;
    if (e > 105) return null;
    acSum += a;
    dcSum += d;
    return Math.min(100, e);
  });
  return { pct: dcSum > 0 ? Math.min(100, (acSum / dcSum) * 100) : null, perSlot };
}
