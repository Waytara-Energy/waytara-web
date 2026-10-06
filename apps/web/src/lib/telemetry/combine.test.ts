import { describe, expect, it } from "vitest";
import { binStart, combineBuckets, dayAxis, istDate, istDayStart, rowToBucket, toDisplay, upsertBucket, wireToBucket } from "./combine";
import type { Bucket, SeriesRow } from "./types";

const MIDNIGHT = Date.parse("2026-10-05T18:30:00Z"); // 2026-10-06 00:00 IST
const Q = 15 * 60_000;

const bucket = (i: number, avg: number, covered = 900, extra: Partial<Bucket> = {}): Bucket => ({
  t: MIDNIGHT + i * Q, wsum: avg * covered, covered, min: avg - 1, max: avg + 1, last: avg, pw: avg * covered, nw: 0, n: 90, ...extra,
});

describe("IST alignment", () => {
  it("bins start on the IST clock", () => {
    expect(binStart(MIDNIGHT + 3 * 3600_000 + 777, 120)).toBe(MIDNIGHT + 2 * 3600_000);
    expect(binStart(MIDNIGHT + 40 * 60_000, 30)).toBe(MIDNIGHT + 30 * 60_000);
    expect(binStart(MIDNIGHT + 5 * 3600_000, 1440)).toBe(MIDNIGHT);
    expect(binStart(MIDNIGHT - 1, 1440)).toBe(MIDNIGHT - 86_400_000);
  });

  it("finds the IST day and its date", () => {
    expect(istDayStart(MIDNIGHT + 5000)).toBe(MIDNIGHT);
    expect(istDate(MIDNIGHT + 5000)).toBe("2026-10-06");
    expect(istDate(MIDNIGHT - 5000)).toBe("2026-10-05");
  });

  it("builds a full-day axis", () => {
    expect(dayAxis(MIDNIGHT, 15)).toHaveLength(96);
    expect(dayAxis(MIDNIGHT, 120)).toHaveLength(12);
    expect(dayAxis(MIDNIGHT, 15)[95]).toBe(MIDNIGHT + 95 * Q);
  });
});

describe("combineBuckets (exact)", () => {
  const four = [10, 20, 30, 40].map((a, i) => bucket(i, a));

  it("30 minutes = two 15-minute buckets, time-weighted", () => {
    const r = combineBuckets(four, 30).map(toDisplay);
    expect(r.map((p) => p.avg)).toEqual([15, 35]);
    expect(r[0].min).toBe(9);
    expect(r[0].max).toBe(21);
    expect(r[1].last).toBe(40);
  });

  it("1 hour in one go equals combining in two steps", () => {
    const direct = combineBuckets(four, 60);
    const stepped = combineBuckets(combineBuckets(four, 30), 60);
    expect(direct).toEqual(stepped);
    expect(toDisplay(direct[0]).avg).toBe(25);
  });

  it("a partly covered bucket weighs by the seconds it actually covers", () => {
    const r = combineBuckets([bucket(0, 100, 900), bucket(1, 0, 100)], 30).map(toDisplay)[0];
    expect(r.avg).toBeCloseTo(90000 / 1000);
    expect(r.covered).toBe(1000);
  });

  it("an uncovered bin has no average (a gap, not zero)", () => {
    const empty = bucket(0, 0, 0, { wsum: 0, min: null, max: null, last: null, n: 0 });
    expect(toDisplay(combineBuckets([empty], 30)[0]).avg).toBeNull();
  });

  it("keeps the positive and negative parts for signed values", () => {
    const b: Bucket = { t: MIDNIGHT, wsum: 900, covered: 900, min: -2, max: 4, last: 4, pw: 1800, nw: 900, n: 90 };
    const p = toDisplay(combineBuckets([b, { ...b, t: MIDNIGHT + Q }], 30)[0]);
    expect([p.avg, p.posAvg, p.negAvg]).toEqual([1, 2, 1]);
  });

  it("'last' comes from the newest bucket even if the input is unordered", () => {
    const r = combineBuckets([bucket(1, 20), bucket(0, 10)], 30);
    expect(r[0].last).toBe(20);
  });
});

describe("conversions", () => {
  it("rebuilds the sums from the averages the database returns", () => {
    const row: SeriesRow = { bucket: "2026-10-05T18:30:00+00:00", key_name: "p", avg_value: 25, min_value: 5, max_value: 45, last_value: 42, pos_avg: 25, neg_avg: 0, covered_s: 3600, n_samples: 360 };
    const b = rowToBucket(row);
    expect([b.t, b.wsum, b.covered, b.pw, b.nw]).toEqual([MIDNIGHT, 90000, 3600, 90000, 0]);
    expect(toDisplay(b).avg).toBe(25);
  });

  it("reads an open bucket from a live message", () => {
    const b = wireToBucket({ b: "2026-10-05T18:30:00+00:00", w: 1000, c: 100, mn: 5, mx: 15, l: 12, n: 20 });
    expect([b.t, b.wsum, b.covered, b.min, b.max, b.last, b.pw, b.nw]).toEqual([MIDNIGHT, 1000, 100, 5, 15, 12, 1000, 0]);
    const signed = wireToBucket({ b: "2026-10-05T18:30:00+00:00", w: 900, c: 900, mn: -2, mx: 4, pw: 1800, nw: 900 });
    expect([signed.pw, signed.nw]).toEqual([1800, 900]);
  });
});

describe("upsertBucket", () => {
  it("replaces, inserts in order, or appends - without mutating the input", () => {
    const base = [bucket(0, 1), bucket(2, 3)];
    const frozen = [...base];
    expect(upsertBucket(base, bucket(2, 9))[1].wsum).toBe(9 * 900);
    expect(upsertBucket(base, bucket(1, 2)).map((b) => b.t)).toEqual([0, 1, 2].map((i) => MIDNIGHT + i * Q));
    expect(upsertBucket(base, bucket(5, 6))).toHaveLength(3);
    expect(base).toEqual(frozen);
  });
});
