import type { createClient } from "@waytara/supabase/client";

type SupabaseBrowserClient = ReturnType<typeof createClient>;

export interface DeviceReadingRow {
  instrument_key: string;
  value: number | null;
  ts: string;
}

/** Pages through `device_readings` via `.range()` until a page comes back
 *  short of PAGE_SIZE — PostgREST caps a single request at its project's
 *  own max-rows setting (1000 here) no matter what `.limit()` the client
 *  asks for, so a plain single-request fetch for a busy sinceMidnight day
 *  (a couple readings/minute easily clears 1000 rows) silently truncates
 *  partway through the day instead of erroring, which is what caused
 *  LiveMetricChart's compareYesterday feature to render nothing past
 *  mid-morning until this was found. Bounded by MAX_ROWS so a single
 *  device can't page forever. */
export async function fetchAllDeviceReadings(
  supabase: SupabaseBrowserClient,
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
      .from("device_readings")
      .select("instrument_key, value, ts")
      .eq("device_id", deviceId)
      .in("instrument_key", keys)
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
