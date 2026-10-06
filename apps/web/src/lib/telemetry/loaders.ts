import type { createClient as createBrowserClient } from "@waytara/supabase/client";
import { wireToBucket } from "./combine";
import type { LatestValue } from "./store";
import type { Bucket } from "./types";

type Sb = ReturnType<typeof createBrowserClient>;

/** The newest value of every metric of a device (equipment_latest: one row per metric, ~130 rows). */
export async function loadLatest(sb: Sb, deviceId: string): Promise<Record<string, LatestValue>> {
  const { data, error } = await sb.from("equipment_latest").select("key_name, value, unit, ts").eq("equipment_id", deviceId);
  if (error) throw new Error(error.message);
  const out: Record<string, LatestValue> = {};
  for (const r of data ?? []) {
    if (r.value === null) continue;
    out[r.key_name] = { value: Number(r.value), ts: new Date(r.ts).getTime(), unit: r.unit };
  }
  return out;
}

/** The running figures of the unfinished 15-minute bucket for the given metrics. */
export async function loadOpen(sb: Sb, deviceId: string, keys: string[]): Promise<Record<string, Bucket>> {
  const { data, error } = await sb
    .from("equipment_open_bucket")
    .select("key_name, bucket, wsum, covered_s, min_value, max_value, last_value, pos_wsum, neg_wsum, n_samples")
    .eq("equipment_id", deviceId)
    .in("key_name", keys);
  if (error) throw new Error(error.message);
  const out: Record<string, Bucket> = {};
  for (const r of data ?? []) {
    out[r.key_name] = wireToBucket({
      b: r.bucket,
      w: r.wsum,
      c: r.covered_s,
      mn: r.min_value,
      mx: r.max_value,
      l: r.last_value,
      pw: r.pos_wsum,
      nw: r.neg_wsum,
      n: r.n_samples,
    });
  }
  return out;
}
