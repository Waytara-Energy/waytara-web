import type { createClient as createBrowserClient } from "@waytara/supabase/client";
import type { createClient as createServerClient } from "@waytara/supabase/server";

// `import type` only - fully erased at compile time, so referencing the server factory's return type here doesn't
// pull `server-only` into a "use client" bundle. Both factories wrap the same SupabaseClient<Database, "waytara">.
type AnySupabaseClient = ReturnType<typeof createBrowserClient> | Awaited<ReturnType<typeof createServerClient>>;

import { dayCounterValues } from "@/lib/performance-period";

export interface DeviceReadingRow {
  key_name: string;
  value: number | null;
  ts: string;
}

export interface SeriesRowOut {
  key_name: string;
  bucket: string;
  avg_value: number | null;
  min_value: number | null;
  max_value: number | null;
  last_value: number | null;
  pos_avg: number | null;
  neg_avg: number | null;
  covered_s: number | null;
}

/** Buckets of `minutes` (15, 30, 60, 120 or 1440) for several metrics over a window, from the rollup tables via
 *  telemetry_series. PostgREST returns at most 1,000 rows per request, so this pages through the result. The
 *  database refuses more than 750 points per metric - choose the interval to fit the window. */
export async function fetchSeriesRows(
  supabase: AnySupabaseClient,
  deviceId: string,
  keys: string[],
  fromIso: string,
  toIso: string,
  minutes: number
): Promise<SeriesRowOut[]> {
  const PAGE_SIZE = 1000;
  const MAX_PAGES = 30;
  const rows: SeriesRowOut[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const { data, error } = await supabase
      .rpc("telemetry_series", { p_equipment_id: deviceId, p_keys: keys, p_from: fromIso, p_to: toIso, p_interval_minutes: minutes })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    rows.push(...(data as unknown as SeriesRowOut[]));
    if (data.length < PAGE_SIZE) break;
  }
  return rows;
}

/** Long-range history (Analytics, Performance, report exports: 30-365 days): one reading per day per key - the
 *  day's total (the value of a cumulative "today" energy register at its peak) - read from the daily rollup.
 *  `ts` is the IST day's start. Today's figure includes the unfinished bucket, so it is current to the last
 *  agent upload. */
export async function fetchDailyMaxReadings(
  supabase: AnySupabaseClient,
  deviceId: string,
  keys: string[],
  gte: string,
  lt?: string
): Promise<DeviceReadingRow[]> {
  const to = lt ?? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const rows = await fetchSeriesRows(supabase, deviceId, keys, gte, to, 1440);
  // Per key, oldest day first, with the day-after-reset correction (see dayCounterValues).
  const out: DeviceReadingRow[] = [];
  for (const key of keys) {
    const mine = rows.filter((r) => r.key_name === key).sort((a, b) => a.bucket.localeCompare(b.bucket));
    const values = dayCounterValues(mine.map((r) => ({ max: r.max_value, last: r.last_value })));
    mine.forEach((r, i) => {
      if (values[i] !== null) out.push({ key_name: key, value: values[i], ts: r.bucket });
    });
  }
  return out;
}
