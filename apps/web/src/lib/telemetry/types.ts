// Shapes shared by the telemetry data layer (rollup buckets, live ticks).

/** One bucket's exactly-combinable aggregates (see the rollup tables in the database):
 *  avg = wsum / covered. A 30 min / 1 h / 2 h / 1 day bucket is the sum of the smaller ones. */
export interface Bucket {
  /** Bucket start, epoch milliseconds. */
  t: number;
  /** Sum of (value x seconds the value was in effect). */
  wsum: number;
  /** Seconds covered by readings - offline gaps are not covered. */
  covered: number;
  min: number | null;
  max: number | null;
  last: number | null;
  /** Positive / negative parts of wsum (battery and grid power are signed). */
  pw: number;
  nw: number;
  /** Number of readings. */
  n: number;
}

/** What telemetry_series() returns for one (bucket, key). */
export interface SeriesRow {
  bucket: string;
  key_name: string;
  avg_value: number | null;
  min_value: number | null;
  max_value: number | null;
  last_value: number | null;
  pos_avg: number | null;
  neg_avg: number | null;
  covered_s: number | null;
  n_samples: number | null;
}

/** A bucket as the charts want it. */
export interface DisplayPoint {
  t: number;
  avg: number | null;
  min: number | null;
  max: number | null;
  last: number | null;
  /** Time-weighted average of the positive / negative parts (e.g. discharge / charge power). */
  posAvg: number | null;
  negAvg: number | null;
  covered: number;
}

/** The compact form of an open bucket inside a live message, as the agent sends it. */
export interface WireBucket {
  b: string;
  w: number;
  c: number;
  mn?: number | null;
  mx?: number | null;
  l?: number | null;
  pw?: number | null;
  nw?: number | null;
  n?: number;
}

/** The live message the database broadcasts once per agent upload. */
export interface TickPayload {
  ts: string;
  values?: Record<string, number | { v: number; u?: string | null }>;
  open?: Record<string, WireBucket>;
  /** Whether the device itself is answering the agent, and when it last did (the agent being alive is a separate thing). */
  agent?: { device_online: boolean | null; last_read_at: string | null };
}

export const IST_OFFSET_MS = 19_800_000; // UTC+05:30
export const BUCKET_MS = 15 * 60_000;
