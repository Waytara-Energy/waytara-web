import "server-only";
import { createClient } from "@waytara/supabase/server";

/** Threshold for Maintenance's "connection may be down" indicator — much
 *  shorter than the offline-detection cron's 6-hour alert threshold
 *  (detect-alerts/route.ts), since this is a softer, informational signal
 *  ("might want to check"), not a customer-facing alert row. Deliberately
 *  distinct from a real fault: a stale sync means "we haven't heard from
 *  the connection," not "the inverter reported a problem." */
const STALE_AFTER_MINUTES = 30;

export interface LastSyncInfo {
  lastTs: string | null;
  minutesAgo: number | null;
  isStale: boolean;
}

/** One lightweight MAX(ts) query for the selected device — no persisted
 *  "last sync" column exists anywhere (confirmed: the offline cron
 *  computes its own version of this transiently, for a different,
 *  alert-worthy threshold). This is a separate, cheaper, page-local
 *  version of the same idea. */
export async function getLastSyncInfo(deviceId: string): Promise<LastSyncInfo> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("device_readings")
    .select("ts")
    .eq("device_id", deviceId)
    .order("ts", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data?.ts) {
    return { lastTs: null, minutesAgo: null, isStale: true };
  }

  const minutesAgo = Math.round((Date.now() - new Date(data.ts).getTime()) / 60000);
  return { lastTs: data.ts, minutesAgo, isStale: minutesAgo > STALE_AFTER_MINUTES };
}
