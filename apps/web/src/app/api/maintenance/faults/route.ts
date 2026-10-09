import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@waytara/supabase/server";
import { getRequestProfile } from "@/lib/request-profile";
import { getSelectedSite, resolveDeviceInSite } from "@/lib/selected-site";
import { fetchFaultEvents } from "@/lib/maintenance-data";
import { isValidReportDate, istDayStart } from "@/lib/report-types";

const MAX_DAYS = 90;

// The fault history of the device for a period the customer picked on the Maintenance page. Cookie-session auth and RLS, like the
// reports routes; the device is looked up in the customer's own site, never trusted from the request.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const date = q.get("date");
  const days = Number(q.get("days") ?? 30);
  if (!isValidReportDate(date)) return NextResponse.json({ error: "Pick a valid date that is not in the future." }, { status: 400 });
  if (!Number.isInteger(days) || days < 1 || days > MAX_DAYS) return NextResponse.json({ error: `Pick 1 to ${MAX_DAYS} days.` }, { status: 400 });

  const [profile, site] = await Promise.all([getRequestProfile(), getSelectedSite()]);
  if (!profile) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const device = await resolveDeviceInSite(site, q.get("device") ?? undefined);
  if (!device) return NextResponse.json({ error: "No device found." }, { status: 404 });
  if (device.deviceType?.category !== "solar_inverter") return NextResponse.json({ events: [], failed: false });

  const fromMs = istDayStart(date).getTime();
  const toMs = Math.min(Date.now(), fromMs + days * 86_400_000);
  const result = await fetchFaultEvents(await createClient(), device.id, fromMs, toMs);
  return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
}
