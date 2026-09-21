// Shared "bucket today into N-minute intervals, in the viewer's own local
// time" logic — originally built for BarTrendChart, now also used by
// TemperatureHeatmap so the two can share one interval selection (see
// MainHubTrendGroup) and read the exact same bucket boundaries.

export const INTERVAL_OPTIONS = [
  { minutes: 15, label: "15 min" },
  { minutes: 30, label: "30 min" },
  { minutes: 60, label: "1 hour" },
  { minutes: 120, label: "2 hours" },
] as const;

export const DEFAULT_INTERVAL_MINUTES = 60;

export function todayMidnight(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Floors a reading's timestamp to an N-minute bucket via pure string
 *  arithmetic on the ISO string itself, not a round trip through `Date` —
 *  `Date#toISOString()` always renders in UTC, which would silently shift
 *  the displayed hour for a non-UTC viewer. */
export function bucketKeyFor(ts: string, bucketMinutes: number): string {
  const datePart = ts.slice(0, 10);
  const totalMinutes = Number(ts.slice(11, 13)) * 60 + Number(ts.slice(14, 16));
  const floored = totalMinutes - (totalMinutes % bucketMinutes);
  const hh = String(Math.floor(floored / 60)).padStart(2, "0");
  const mm = String(floored % 60).padStart(2, "0");
  return `${datePart}T${hh}:${mm}`;
}

export function localBucketDateString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Every bucket key for a full local day, 00:00 through the last bucket
 *  before the next midnight — the chart always shows all 24 hours' worth
 *  of x-axis space, not just whatever's happened so far. */
export function fullDayBucketKeys(bucketMinutes: number): string[] {
  const datePart = localBucketDateString(todayMidnight()).slice(0, 10);
  const totalBuckets = Math.ceil((24 * 60) / bucketMinutes);
  const keys: string[] = [];
  for (let i = 0; i < totalBuckets; i++) {
    const totalMinutes = i * bucketMinutes;
    const hh = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
    const mm = String(totalMinutes % 60).padStart(2, "0");
    keys.push(`${datePart}T${hh}:${mm}`);
  }
  return keys;
}

/** "2 PM" for an hour-aligned bucket, "2:15 PM" once the interval is finer
 *  than an hour and the bucket actually needs its own minute shown. */
export function formatBucketLabel(bucketKey: string, bucketMinutes: number): string {
  const hour = Number(bucketKey.slice(11, 13));
  const minute = bucketKey.slice(14, 16);
  const period = hour < 12 ? "AM" : "PM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return bucketMinutes >= 60 || minute === "00" ? `${displayHour} ${period}` : `${displayHour}:${minute} ${period}`;
}
