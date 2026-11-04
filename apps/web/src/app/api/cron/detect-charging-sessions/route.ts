import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";

// Retired (migration 20261104000000_retire_detect_charging_sessions.sql). Charging sessions now come only from the charger's own OCPP messages.
// This job used to guess sessions every 2 minutes from the connector status and energy reading. It could add a second "inferred" session for a
// charge that was already running (when its read of the open sessions failed) and wrote an end time and "Local" onto real sessions without
// marking them finished. The route stays as a no-op so an old scheduler call does no harm.
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req, "detect-charging-sessions")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ checked: 0, opened: 0, closed: 0, retired: true });
}
