import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@waytara/supabase/service-role";

// Task 12.1: device-offline detection. Runs on a Vercel Cron schedule
// (see vercel.json) hitting this Route Handler — a Vercel Function, not a
// Supabase Edge Function, matching this codebase's established backend
// convention. No signed-in user exists for a scheduled job, so this is one
// of the legitimate service_role cases (see service-role.ts's own doc
// comment).
const OFFLINE_THRESHOLD_HOURS = 6;
const OFFLINE_MESSAGE_PREFIX = "Device offline";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // No secret configured — allowed, but logged, so local/dev testing
    // isn't blocked. Set CRON_SECRET in production so this endpoint can't
    // be triggered by anyone who finds the URL.
    console.warn("[cron/detect-alerts] CRON_SECRET not set — running unauthenticated.");
    return true;
  }
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const now = Date.now();
  const thresholdMs = OFFLINE_THRESHOLD_HOURS * 60 * 60 * 1000;

  const { data: devices, error: devicesError } = await supabase
    .from("devices")
    .select("id, label, device_uid")
    .eq("status", "active");

  if (devicesError) {
    return NextResponse.json({ error: devicesError.message }, { status: 500 });
  }

  const deviceIds = (devices ?? []).map((d) => d.id);
  if (deviceIds.length === 0) {
    return NextResponse.json({ checked: 0, newAlerts: 0, resolvedAlerts: 0 });
  }

  // Same bounded-window simplification as the dashboard Overview page:
  // most recent readings first, reduced client-side to the latest per
  // device, rather than a DISTINCT ON the query builder can't express.
  const { data: readings } = await supabase
    .from("device_readings")
    .select("device_id, ts")
    .in("device_id", deviceIds)
    .eq("is_test", false)
    .order("ts", { ascending: false })
    .limit(2000);

  const lastSeenByDevice = new Map<string, number>();
  for (const r of readings ?? []) {
    if (!lastSeenByDevice.has(r.device_id)) {
      lastSeenByDevice.set(r.device_id, new Date(r.ts).getTime());
    }
  }

  const { data: openOfflineAlerts } = await supabase
    .from("alerts")
    .select("id, device_id")
    .in("device_id", deviceIds)
    .is("acknowledged_at", null)
    .like("message", `${OFFLINE_MESSAGE_PREFIX}%`);

  const openAlertByDevice = new Map((openOfflineAlerts ?? []).map((a) => [a.device_id, a.id]));

  let newAlerts = 0;
  let resolvedAlerts = 0;

  for (const device of devices ?? []) {
    const lastSeen = lastSeenByDevice.get(device.id);
    const isOffline = !lastSeen || now - lastSeen > thresholdMs;
    const existingAlertId = openAlertByDevice.get(device.id);

    if (isOffline && !existingAlertId) {
      const label = device.label || device.device_uid;
      const message = lastSeen
        ? `${OFFLINE_MESSAGE_PREFIX}: ${label} hasn't reported in over ${OFFLINE_THRESHOLD_HOURS} hours.`
        : `${OFFLINE_MESSAGE_PREFIX}: ${label} has never reported a reading.`;
      const { error } = await supabase.from("alerts").insert({
        device_id: device.id,
        severity: "critical",
        message,
      });
      if (!error) newAlerts++;
    } else if (!isOffline && existingAlertId) {
      // Device is reporting again — auto-resolve the standing offline
      // alert rather than leaving it open forever. acknowledged_by stays
      // null to distinguish a system auto-resolve from a person clicking
      // "Acknowledge".
      const { error } = await supabase
        .from("alerts")
        .update({ acknowledged_at: new Date().toISOString() })
        .eq("id", existingAlertId);
      if (!error) resolvedAlerts++;
    }
  }

  return NextResponse.json({ checked: devices?.length ?? 0, newAlerts, resolvedAlerts });
}
