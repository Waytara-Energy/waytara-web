import { NextRequest, NextResponse } from "next/server";
import { gatherDayReport } from "@/lib/report-day-data";

// JSON behind the Reports page's daily chart. Cookie-session auth + RLS, the
// same model as the CSV/PDF exports next to it; nothing here trusts the device id.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const result = await gatherDayReport({
    deviceId: q.get("device") ?? undefined,
    date: q.get("date"),
    type: q.get("type"),
    bucketMinutes: q.get("interval"),
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  // `type` carries compute functions the client already has; send just its id.
  const { type, ...rest } = result.report;
  return NextResponse.json({ ...rest, typeId: type.id }, { headers: { "Cache-Control": "private, no-store" } });
}
