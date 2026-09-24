import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@waytara/supabase/service-role";

// Phase 0 of the multi-device-type dashboard roadmap (see
// packages/supabase/supabase/migrations/20260917010000_charging_sessions.sql):
// turns an EV charger's raw connector_status/energy readings into discrete
// charging_sessions rows — a session opens when connector_status
// transitions into Charging (2) and closes when it transitions back out,
// capturing the cumulative energy register's value at each edge. Same
// scheduling situation as ../detect-alerts/route.ts: not currently wired
// to a scheduler (see that route's own doc comment for why), only runs on
// a manual/local/CI trigger for now.
const CHARGING_STATUS = 2;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.warn("[cron/detect-charging-sessions] CRON_SECRET not set — running unauthenticated.");
    return true;
  }
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();

  const { data: devices, error: devicesError } = await supabase
    .from("devices")
    .select("id, device_type:stock(category)")
    .eq("device_status", "active");

  if (devicesError) {
    return NextResponse.json({ error: devicesError.message }, { status: 500 });
  }

  const chargerIds = (devices ?? []).filter((d) => d.device_type?.category === "ev_charger").map((d) => d.id);
  if (chargerIds.length === 0) {
    return NextResponse.json({ checked: 0, opened: 0, closed: 0 });
  }

  // Same bounded-window "most recent first, reduced to latest per device"
  // simplification the rest of this app already uses for a snapshot read.
  const { data: readings } = await supabase
    .from("device_readings")
    .select("device_id, instrument_key, value, ts")
    .in("device_id", chargerIds)
    .in("instrument_key", ["connector_status", "energy_active_import_register_kwh"])
    .order("ts", { ascending: false })
    .limit(chargerIds.length * 10);

  const latestStatus = new Map<string, number | null>();
  const latestEnergy = new Map<string, number | null>();
  for (const r of readings ?? []) {
    if (r.instrument_key === "connector_status" && !latestStatus.has(r.device_id)) latestStatus.set(r.device_id, r.value);
    if (r.instrument_key === "energy_active_import_register_kwh" && !latestEnergy.has(r.device_id)) {
      latestEnergy.set(r.device_id, r.value);
    }
  }

  const { data: openSessions } = await supabase
    .from("charging_sessions")
    .select("id, device_id, started_at")
    .in("device_id", chargerIds)
    .is("ended_at", null);

  const openSessionByDevice = new Map((openSessions ?? []).map((s) => [s.device_id, s]));

  const now = new Date().toISOString();

  // Decide per-charger in the loop (cheap, in-memory), but batch the
  // actual writes into at most one INSERT and one upsert instead of one
  // round-trip per charger. The closing sessions can't share a single
  // `.update().in("id", [...])` the way detect-alerts's resolve-batch
  // does — each one needs its *own* `end_energy_kwh` — so those go through
  // `.upsert()` by `id` instead, one round trip either way. `device_id`/
  // `started_at` are carried over unchanged (both NOT NULL with no
  // default, so `.upsert()`'s Insert-side typing requires them even
  // though the conflict-update path — the only one ever taken here, since
  // every id already exists — doesn't actually need them).
  const toOpen: { device_id: string; started_at: string; start_energy_kwh: number | null }[] = [];
  const toClose: {
    id: string;
    device_id: string;
    started_at: string;
    ended_at: string;
    end_energy_kwh: number | null;
    stop_reason: string;
  }[] = [];

  for (const deviceId of chargerIds) {
    const status = latestStatus.get(deviceId) ?? null;
    const energy = latestEnergy.get(deviceId) ?? null;
    const openSession = openSessionByDevice.get(deviceId);
    const isCharging = status === CHARGING_STATUS;

    if (isCharging && !openSession) {
      toOpen.push({ device_id: deviceId, started_at: now, start_energy_kwh: energy });
    } else if (!isCharging && openSession) {
      toClose.push({
        id: openSession.id,
        device_id: openSession.device_id,
        started_at: openSession.started_at,
        ended_at: now,
        end_energy_kwh: energy,
        stop_reason: "Local",
      });
    }
  }

  const [insertResult, closeResult] = await Promise.all([
    toOpen.length > 0 ? supabase.from("charging_sessions").insert(toOpen) : Promise.resolve({ error: null }),
    toClose.length > 0 ? supabase.from("charging_sessions").upsert(toClose, { onConflict: "id" }) : Promise.resolve({ error: null }),
  ]);

  const opened = insertResult.error ? 0 : toOpen.length;
  const closed = closeResult.error ? 0 : toClose.length;

  return NextResponse.json({ checked: chargerIds.length, opened, closed });
}
