import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@waytara/supabase/server";
import { resolveEvPeriod } from "@/lib/ev-period";
import { evSessionsCsv, type CsvSession } from "@/lib/ev-sessions-csv";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LIMIT = 5000;
const COLUMNS =
  "id, started_at, ended_at, status, stop_reason, start_energy_kwh, end_energy_kwh, meter_start_wh, meter_stop_wh, peak_power_kw, avg_power_kw, max_current_a, charging_seconds, energy_from_solar_kwh, energy_from_battery_kwh, energy_from_grid_kwh, solar_share_pct, target_kwh";

// The charging sessions of one charger and one period as CSV. Auth is cookie-based and ev_sessions is read through the signed-in person's own access
// (row-level security), so a charger that is not theirs gives an empty file, never somebody else's sessions.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const device = q.get("device") ?? "";
  if (!UUID.test(device)) return NextResponse.json({ error: "device must be a charger id" }, { status: 400 });

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const period = resolveEvPeriod({ period: q.get("period") ?? undefined, from: q.get("from") ?? undefined, to: q.get("to") ?? undefined }, Date.now());
  const { data, error } = await supabase
    .from("ev_sessions")
    .select(COLUMNS)
    .eq("equipment_id", device)
    .gte("started_at", period.fromIso)
    .lt("started_at", period.toIso)
    .order("started_at", { ascending: true })
    .limit(LIMIT);
  if (error) return NextResponse.json({ error: "The sessions could not be read right now." }, { status: 502 });

  return new NextResponse(evSessionsCsv((data ?? []) as CsvSession[]), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="waytara-charging-sessions-${period.from}${period.to === period.from ? "" : `-to-${period.to}`}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
