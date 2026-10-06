import { BUCKET_MS, IST_OFFSET_MS, type Bucket, type DisplayPoint, type SeriesRow, type WireBucket } from "./types";

/** Start of the IST-aligned bin of `minutes` that contains time `t` (epoch ms). Bins nest: 15 -> 30 -> 60 -> 120 -> 1440. */
export function binStart(t: number, minutes: number): number {
  const size = minutes * 60_000;
  return Math.floor((t + IST_OFFSET_MS) / size) * size - IST_OFFSET_MS;
}

export function rowToBucket(row: SeriesRow): Bucket {
  const covered = row.covered_s ?? 0;
  return {
    t: new Date(row.bucket).getTime(),
    wsum: (row.avg_value ?? 0) * covered,
    covered,
    min: row.min_value,
    max: row.max_value,
    last: row.last_value,
    pw: (row.pos_avg ?? 0) * covered,
    nw: (row.neg_avg ?? 0) * covered,
    n: row.n_samples ?? 0,
  };
}

export function wireToBucket(w: WireBucket): Bucket {
  const wsum = w.w;
  const hasSplit = w.pw !== undefined && w.pw !== null;
  return {
    t: new Date(w.b).getTime(),
    wsum,
    covered: w.c,
    min: w.mn ?? null,
    max: w.mx ?? null,
    last: w.l ?? null,
    // No split sent means "no negatives": the positive part is the whole sum.
    pw: hasSplit ? (w.pw as number) : Math.max(wsum, 0),
    nw: hasSplit ? (w.nw ?? 0) : 0,
    n: w.n ?? 0,
  };
}

function mergeInto(acc: Bucket, b: Bucket): void {
  acc.wsum += b.wsum;
  acc.covered += b.covered;
  acc.pw += b.pw;
  acc.nw += b.nw;
  acc.n += b.n;
  if (b.min !== null) acc.min = acc.min === null ? b.min : Math.min(acc.min, b.min);
  if (b.max !== null) acc.max = acc.max === null ? b.max : Math.max(acc.max, b.max);
}

/** Combine finer buckets into `minutes`-wide ones. Exact: sum of weighted sums over sum of seconds. */
export function combineBuckets(buckets: readonly Bucket[], minutes: number): Bucket[] {
  const out = new Map<number, Bucket>();
  const lastT = new Map<number, number>();
  for (const b of buckets) {
    const start = binStart(b.t, minutes);
    let acc = out.get(start);
    if (!acc) {
      acc = { t: start, wsum: 0, covered: 0, min: null, max: null, last: null, pw: 0, nw: 0, n: 0 };
      out.set(start, acc);
    }
    mergeInto(acc, b);
    if (b.last !== null && b.t >= (lastT.get(start) ?? -Infinity)) {
      acc.last = b.last;
      lastT.set(start, b.t);
    }
  }
  return [...out.values()].sort((a, b) => a.t - b.t);
}

export function toDisplay(b: Bucket): DisplayPoint {
  const c = b.covered;
  return {
    t: b.t,
    avg: c > 0 ? b.wsum / c : null,
    min: b.min,
    max: b.max,
    last: b.last,
    posAvg: c > 0 ? b.pw / c : null,
    negAvg: c > 0 ? b.nw / c : null,
    covered: c,
  };
}

/** Put (or replace) one bucket in a time-sorted list, returning a new list. */
export function upsertBucket(list: readonly Bucket[], b: Bucket): Bucket[] {
  const i = list.findIndex((x) => x.t >= b.t);
  if (i === -1) return [...list, b];
  if (list[i].t === b.t) return [...list.slice(0, i), b, ...list.slice(i + 1)];
  return [...list.slice(0, i), b, ...list.slice(i)];
}

/** Every bin start of an IST day at `minutes`, e.g. 96 of them for 15. `dayStartMs` is that day's IST midnight. */
export function dayAxis(dayStartMs: number, minutes: number): number[] {
  const size = minutes * 60_000;
  return Array.from({ length: Math.round((24 * 60) / minutes) }, (_, i) => dayStartMs + i * size);
}

/** IST midnight (epoch ms) of the IST day containing `t`. */
export function istDayStart(t: number): number {
  return binStart(t, 1440);
}

/** "YYYY-MM-DD" of the IST day containing `t`. */
export function istDate(t: number): string {
  return new Date(t + IST_OFFSET_MS).toISOString().slice(0, 10);
}

export { BUCKET_MS };

/** "YYYY-MM-DDTHH:mm" of a bin start on the IST clock - the category key the charts use on their time axis. */
export function istSlotKey(t: number): string {
  return new Date(t + IST_OFFSET_MS).toISOString().slice(0, 16);
}
