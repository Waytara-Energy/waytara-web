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
  /** How often the agent says it uploads (seconds), when it has said. */
  intervalS: number | null;
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
  // The agent's heartbeat is the real "last heard from the device": it is written on every upload, even when no
  // value changed. Older data (before the heartbeat existed) falls back to the newest reading.
  const { data: beat } = await supabase.from("equipment_heartbeat").select("last_seen, upload_interval_s").eq("equipment_id", deviceId).maybeSingle();
  let lastTs: string | null = beat?.last_seen ?? null;
  if (!lastTs) {
    const { data } = await supabase
      .from("equipment_latest")
      .select("ts")
      .eq("equipment_id", deviceId)
      .order("ts", { ascending: false })
      .limit(1)
      .maybeSingle();
    lastTs = data?.ts ?? null;
  }

  if (!lastTs) {
    return { lastTs: null, intervalS: null, minutesAgo: null, isStale: true };
  }

  const minutesAgo = Math.round((Date.now() - new Date(lastTs).getTime()) / 60000);
  return { lastTs, intervalS: beat?.upload_interval_s ?? null, minutesAgo, isStale: minutesAgo > STALE_AFTER_MINUTES };
}
