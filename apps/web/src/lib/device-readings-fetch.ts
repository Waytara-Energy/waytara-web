import type { createClient as createBrowserClient } from "@waytara/supabase/client";
import type { createClient as createServerClient } from "@waytara/supabase/server";

// `import type` only — fully erased at compile time (no runtime reference,
// not even a require call), so referencing the server factory's return
// type here doesn't pull `server-only` into a "use client" bundle. Both
// factories wrap the same `SupabaseClient<Database, "waytara">` shape, just
// with different cookie plumbing, so their query-builder types line up —
// this lets Server Components reuse the same safe pagination this function
// already gives Client Components, instead of a second copy of it.
type AnySupabaseClient = ReturnType<typeof createBrowserClient> | Awaited<ReturnType<typeof createServerClient>>;

export interface DeviceReadingRow {
  key_name: string;
  value: number | null;
  ts: string;
}

/** Pages through `equipment_telemetry` via `.range()` until a page comes back
 *  short of PAGE_SIZE — PostgREST caps a single request at its project's
 *  own max-rows setting (1000 here) no matter what `.limit()` the client
 *  asks for, so a plain single-request fetch for a busy sinceMidnight day
 *  (a couple readings/minute easily clears 1000 rows) silently truncates
 *  partway through the day instead of erroring, which is what caused
 *  LiveMetricChart's compareYesterday feature to render nothing past
 *  mid-morning until this was found. Bounded by MAX_ROWS so a single
 *  device can't page forever. */
export async function fetchAllDeviceReadings(
  supabase: AnySupabaseClient,
  deviceId: string,
  keys: string[],
  gte: string,
  lt?: string
): Promise<DeviceReadingRow[]> {
  const PAGE_SIZE = 1000;
  const MAX_ROWS = 20000;
  const rows: DeviceReadingRow[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
    let query = supabase
      .from("equipment_telemetry")
      .select("key_name, value, ts")
      .eq("equipment_id", deviceId)
      .in("key_name", keys)
      .eq("is_test", false)
      .gte("ts", gte)
      .order("ts", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (lt) query = query.lt("ts", lt);
    const { data: page } = await query;
    if (!page || page.length === 0) break;
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

/** Long-range history (Analytics, Performance, report exports: 30–365 days):
 *  one reading per day per key — the day's MAXIMUM — read from the hourly
 *  rollup (`telemetry_daily`) instead of paging through raw rows.
 *
 *  Why: every long-range consumer ends in "max seen per day" of a cumulative
 *  daily-energy register (aggregateDailyYield / maxByDeviceDay), and raw
 *  history is both enormous (~17k readings/day for one key) and eventually
 *  purged. fetchAllDeviceReadings is capped at 20,000 rows, which is about
 *  one day of one key, so a 90-day window used to be computed from only the
 *  first day or two. The returned shape matches fetchAllDeviceReadings
 *  (`ts` is the IST day's start, `value` its max), so callers are unchanged.
 *
 *  Freshness: the rollup is refreshed every 10 minutes by pg_cron, so
 *  today's figure can lag by up to that. Use fetchAllDeviceReadings for
 *  intraday charts. */
export async function fetchDailyMaxReadings(
  supabase: AnySupabaseClient,
  deviceId: string,
  keys: string[],
  gte: string,
  lt?: string
): Promise<DeviceReadingRow[]> {
  const PAGE_SIZE = 1000; // PostgREST's per-request row cap
  const MAX_PAGES = 20;
  const to = lt ?? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const rows: DeviceReadingRow[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const { data } = await supabase
      .rpc("telemetry_daily", { p_equipment_id: deviceId, p_keys: keys, p_from: gte, p_to: to })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (!data || data.length === 0) break;
    for (const r of data) {
      // max_value is null only if every sample in the day was null; skip those days.
      if ((r.max_value as number | null) === null) continue;
      rows.push({ key_name: r.key_name, value: r.max_value, ts: r.day });
    }
    if (data.length < PAGE_SIZE) break;
  }
  return rows;
}
