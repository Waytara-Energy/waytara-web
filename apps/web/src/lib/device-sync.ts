import "server-only";
import { createClient } from "@waytara/supabase/server";
import type { DeviceSyncInit } from "./device-sync-types";

/** Threshold for Maintenance's "connection may be down" indicator — much
 *  shorter than the offline-detection cron's 6-hour alert threshold
 *  (detect-alerts/route.ts), since this is a softer, informational signal
 *  ("might want to check"), not a customer-facing alert row. Deliberately
 *  distinct from a real fault: a stale sync means "we haven't heard from
 *  the connection," not "the inverter reported a problem." */
const STALE_AFTER_MINUTES = 30;

export interface LastSyncInfo extends DeviceSyncInit {
  minutesAgo: number | null;
  isStale: boolean;
}

/** The selected device's connection: when it last ANSWERED (not merely when the agent last uploaded), whether the agent
 *  says it is answering, and when the agent was last heard from. Without this distinction a switched-off device looked
 *  "updated a minute ago" and "Normal" for as long as the agent kept running. */
export async function getLastSyncInfo(deviceId: string): Promise<LastSyncInfo> {
  const supabase = await createClient();
  const { data: beat } = await supabase
    .from("equipment_heartbeat")
    .select("last_seen, upload_interval_s, heartbeat_s, device_online, last_read_at")
    .eq("equipment_id", deviceId)
    .maybeSingle();

  const deviceOnline = beat?.device_online ?? null;
  let lastTs: string | null = beat?.last_read_at ?? null;
  if (!lastTs && deviceOnline === null) {
    // An agent that does not report connectivity: the newest stored reading is the best answer.
    const { data } = await supabase
      .from("equipment_latest")
      .select("ts")
      .eq("equipment_id", deviceId)
      .order("ts", { ascending: false })
      .limit(1)
      .maybeSingle();
    lastTs = data?.ts ?? beat?.last_seen ?? null;
  }

  const minutesAgo = lastTs ? Math.round((Date.now() - new Date(lastTs).getTime()) / 60000) : null;
  return {
    lastTs,
    agentSeenTs: beat?.last_seen ?? null,
    deviceOnline,
    intervalS: beat?.upload_interval_s ?? null,
    heartbeatS: beat?.heartbeat_s ?? null,
    minutesAgo,
    isStale: minutesAgo === null || minutesAgo > STALE_AFTER_MINUTES || deviceOnline === false,
  };
}
