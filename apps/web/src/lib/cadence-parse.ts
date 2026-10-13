// What the cadence Apps Script returns for a "read", turned into per-metric series. Pure (no server imports) so the rules are tested.
//
//   { "ok": true, "keys": ["pv1_power_w", ...], "rows": [[epoch_seconds, v1, v2, ...], ...] }
//
// `keys` names the value columns (when it is missing the columns are taken to be the keys that were asked for, in order). A time is
// epoch seconds (a value above 1e11 is taken as milliseconds). A null / non-numeric cell is a reading that was not taken in that
// round and is skipped.

export type CadencePoint = [number, number]; // [epoch ms, value]
export type CadenceSeriesMap = Record<string, CadencePoint[]>;

export type ParsedCadence = { ok: true; series: CadenceSeriesMap } | { ok: false; error: string };

export function parseCadenceAnswer(json: unknown, wantKeys: string[]): ParsedCadence {
  if (!json || typeof json !== "object") return { ok: false, error: "The cadence service sent an unreadable answer." };
  const o = json as { ok?: unknown; error?: unknown; keys?: unknown; rows?: unknown };
  if (o.ok !== true) return { ok: false, error: typeof o.error === "string" && o.error ? o.error : "The cadence service refused the request." };
  if (!Array.isArray(o.rows)) return { ok: false, error: "The cadence service sent no rows." };
  const columns: string[] = Array.isArray(o.keys) && o.keys.every((k) => typeof k === "string") ? (o.keys as string[]) : wantKeys;
  const want = new Set(wantKeys);
  const series: CadenceSeriesMap = {};
  for (const k of wantKeys) series[k] = [];
  for (const row of o.rows) {
    if (!Array.isArray(row)) continue;
    const raw = Number(row[0]);
    if (!Number.isFinite(raw)) continue;
    const t = raw > 1e11 ? Math.round(raw) : Math.round(raw * 1000);
    for (let c = 0; c < columns.length; c++) {
      const key = columns[c];
      if (!want.has(key)) continue;
      const cell = row[c + 1];
      if (cell === null || cell === undefined || cell === "") continue;
      const v = Number(cell);
      if (Number.isFinite(v)) series[key].push([t, v]);
    }
  }
  for (const k of Object.keys(series)) {
    series[k].sort((a, b) => a[0] - b[0]);
    series[k] = series[k].filter((p, i, arr) => i === 0 || p[0] !== arr[i - 1][0]); // a retried upload never doubles a reading
  }
  return { ok: true, series };
}

/** Group the readings of one metric into `stepMs` bins (IST-aligned when `originMs` is an IST midnight): the average of each bin. */
export function averageIntoBins(points: CadencePoint[], stepMs: number, originMs: number): CadencePoint[] {
  if (stepMs <= 0) return points;
  const bins = new Map<number, { sum: number; n: number }>();
  for (const [t, v] of points) {
    const start = originMs + Math.floor((t - originMs) / stepMs) * stepMs;
    const b = bins.get(start) ?? { sum: 0, n: 0 };
    b.sum += v;
    b.n += 1;
    bins.set(start, b);
  }
  return [...bins.entries()].sort((a, b) => a[0] - b[0]).map(([start, b]) => [start, b.sum / b.n] as CadencePoint);
}

// ---------------------------------------------------------------- the day report at 1 / 5 minutes

export interface ReportBucketFigures {
  avg: number | null;
  pos: number | null;
  neg: number | null;
}

/**
 * The readings of each metric grouped into report buckets (minute-aligned, IST), in the shape the report builder already works
 * with: per bucket and metric the figure shown (avg), and for signed metrics (battery and grid power) the average of the positive and
 * of the negative part, so charge/discharge and import/export stay exact. `mode`: "avg" = the average of the readings in the bucket,
 * "last" = the reading at the end of the bucket (the value "at that time"). `covered` is the seconds the readings stand for.
 */
export function bucketCadenceForReport(
  series: CadenceSeriesMap,
  stepSeconds: (key: string) => number,
  bucketMinutes: number,
  mode: "avg" | "last",
  keyOf: (ms: number, bucketMinutes: number) => string
): { raw: Map<string, Record<string, ReportBucketFigures>>; covered: Map<string, Record<string, number>> } {
  const raw = new Map<string, Record<string, ReportBucketFigures>>();
  const covered = new Map<string, Record<string, number>>();
  for (const [key, points] of Object.entries(series)) {
    const bins = new Map<string, { sum: number; pos: number; neg: number; n: number; last: number }>();
    for (const [t, v] of points) {
      const b = keyOf(t, bucketMinutes);
      const x = bins.get(b) ?? { sum: 0, pos: 0, neg: 0, n: 0, last: v };
      x.sum += v;
      x.pos += Math.max(v, 0);
      x.neg += Math.max(-v, 0);
      x.n += 1;
      x.last = v; // points are in time order
      bins.set(b, x);
    }
    for (const [b, x] of bins) {
      const row = raw.get(b) ?? {};
      row[key] =
        mode === "last"
          ? { avg: x.last, pos: Math.max(x.last, 0), neg: Math.max(-x.last, 0) }
          : { avg: x.sum / x.n, pos: x.pos / x.n, neg: x.neg / x.n };
      raw.set(b, row);
      const c = covered.get(b) ?? {};
      c[key] = Math.min(bucketMinutes * 60, x.n * stepSeconds(key));
      covered.set(b, c);
    }
  }
  return { raw, covered };
}
