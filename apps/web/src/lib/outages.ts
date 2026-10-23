import type { createClient } from "@waytara/supabase/server";
import type { OutageEvent } from "@/lib/data-gaps";

/** The outages the platform recorded for a device from `fromMs` on (the unit stopped checking in, or could not reach the inverter), for naming why a stretch has no readings. The customer view of the log carries only these two facts, not the technical detail. */
export async function loadOutages(supabase: Awaited<ReturnType<typeof createClient>>, deviceId: string, fromMs: number): Promise<OutageEvent[]> {
  const { data } = await supabase
    .from("device_activity_log")
    .select("cause, since, at")
    .eq("equipment_id", deviceId)
    .eq("action", "device_offline")
    .gte("at", new Date(fromMs).toISOString())
    .order("at", { ascending: false })
    .limit(100);
  return (data ?? []).map((r) => ({ sinceMs: Date.parse(r.since ?? r.at ?? ""), cause: r.cause })).filter((o) => Number.isFinite(o.sinceMs));
}
