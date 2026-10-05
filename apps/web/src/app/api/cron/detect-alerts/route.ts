import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";
import { createServiceRoleClient } from "@waytara/supabase/service-role";

// Task 12.1: device-offline detection. Meant to run on a schedule hitting
// this Route Handler — a Vercel Function, not a Supabase Edge Function,
// matching this codebase's established backend convention. No signed-in
// user exists for a scheduled job, so this is one of the legitimate
// service_role cases (see service-role.ts's own doc comment).
//
// Not currently wired to any scheduler: Vercel Cron's every-15-minutes
// schedule doesn't deploy on the Hobby plan (capped at once/day), and a
// once-daily cadence would be a real regression against a 6-hour
// threshold, so it was removed rather than degraded. Not urgent enough
// right now to stand up an external trigger for — plan is to schedule
// this via Supabase's pg_cron (calling out to this route, or reimplementing
// the check as a Postgres function) once that's worth doing. Until then,
// this only runs if hit manually or from a local/CI trigger.
const OFFLINE_THRESHOLD_HOURS = 6;
const OFFLINE_MESSAGE_PREFIX = "Device offline";

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req, "detect-alerts")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const now = Date.now();
  const thresholdMs = OFFLINE_THRESHOLD_HOURS * 60 * 60 * 1000;

  const { data: devices, error: devicesError } = await supabase
    .from("equipment")
    .select("id, label, device_type:equipment_inventory(serial_number, model_number)")
    .eq("device_status", "active");

  if (devicesError) {
    return NextResponse.json({ error: devicesError.message }, { status: 500 });
  }

  const deviceIds = (devices ?? []).map((d) => d.id);
  if (deviceIds.length === 0) {
    return NextResponse.json({ checked: 0, newAlerts: 0, resolvedAlerts: 0 });
  }

  // device_last_seen() returns exactly one row per device that has ever
  // reported, computed in the database. Do NOT replace this with a plain
  // select on equipment_latest: that table has one row per device+key (1,000+
  // rows) and the REST API returns at most 1,000 per request, so devices
  // with older readings silently fell out and were reported as "never
  // reported" (see migration 20261005000000_device_last_seen.sql).
  const { data: lastSeenRows, error: lastSeenError } = await supabase.rpc("device_last_seen", {
    p_equipment_ids: deviceIds,
  });
  if (lastSeenError) {
    // Never guess: treating an error as "nobody has reported" would raise a
    // critical alert for every device.
    return NextResponse.json({ error: lastSeenError.message }, { status: 500 });
  }

  const lastSeenByDevice = new Map<string, number>();
  for (const r of lastSeenRows ?? []) {
    lastSeenByDevice.set(r.equipment_id, new Date(r.last_ts).getTime());
  }

  const { data: openOfflineAlerts } = await supabase
    .from("alerts")
    .select("id, device_id")
    .in("device_id", deviceIds)
    .is("acknowledged_at", null)
    .like("message", `${OFFLINE_MESSAGE_PREFIX}%`);

  const openAlertByDevice = new Map((openOfflineAlerts ?? []).map((a) => [a.device_id, a.id]));

  // Decide per-device in the loop (cheap, in-memory), but batch the actual
  // writes into at most one INSERT and one UPDATE instead of one
  // round-trip per device — with dozens/hundreds of active devices this
  // was the slowest part of the whole check by far.
  const toInsert: { device_id: string; severity: "critical"; message: string }[] = [];
  const toResolveIds: string[] = [];

  for (const device of devices ?? []) {
    const lastSeen = lastSeenByDevice.get(device.id);
    const isOffline = !lastSeen || now - lastSeen > thresholdMs;
    const existingAlertId = openAlertByDevice.get(device.id);

    if (isOffline && !existingAlertId) {
      const label = device.label || device.device_type?.serial_number || device.device_type?.model_number || "Device";
      const message = lastSeen
        ? `${OFFLINE_MESSAGE_PREFIX}: ${label} hasn't reported in over ${OFFLINE_THRESHOLD_HOURS} hours.`
        : `${OFFLINE_MESSAGE_PREFIX}: ${label} has never reported a reading.`;
      toInsert.push({ device_id: device.id, severity: "critical", message });
    } else if (!isOffline && existingAlertId) {
      // Device is reporting again — auto-resolve the standing offline
      // alert rather than leaving it open forever. acknowledged_by stays
      // null to distinguish a system auto-resolve from a person clicking
      // "Acknowledge".
      toResolveIds.push(existingAlertId);
    }
  }

  const [insertResult, resolveResult] = await Promise.all([
    toInsert.length > 0 ? supabase.from("alerts").insert(toInsert) : Promise.resolve({ error: null }),
    toResolveIds.length > 0
      ? supabase.from("alerts").update({ acknowledged_at: new Date().toISOString() }).in("id", toResolveIds)
      : Promise.resolve({ error: null }),
  ]);

  const newAlerts = insertResult.error ? 0 : toInsert.length;
  const resolvedAlerts = resolveResult.error ? 0 : toResolveIds.length;

  return NextResponse.json({ checked: devices?.length ?? 0, newAlerts, resolvedAlerts });
}
