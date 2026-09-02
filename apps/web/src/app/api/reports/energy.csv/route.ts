import { NextRequest, NextResponse } from "next/server";
import { gatherReportData } from "@/lib/gather-report-data";

const MAX_DAYS = 365;

// Route Handler (Vercel Function), not a Supabase Edge Function — same
// backend convention as /api/leads. Auth is cookie-based via
// gatherReportData -> createClient(), so RLS scopes the export to
// whichever customer is signed in; there's nothing to authorize here
// beyond what the query already restricts.
//
// Accepts either a preset (30/90/365) or a custom day count from the
// dashboard's Calendar range picker — clamped to [1, 365] rather than a
// fixed allow-list, since "since" is always relative to now either way.
export async function GET(req: NextRequest) {
  const daysParam = Number(req.nextUrl.searchParams.get("days"));
  const days = Number.isInteger(daysParam) && daysParam > 0 ? Math.min(daysParam, MAX_DAYS) : 90;

  const report = await gatherReportData(days);
  if (!report.authorized) {
    return NextResponse.json({ error: "Not available on your plan." }, { status: 403 });
  }

  const rows = [
    ["Date", "Household yield (kWh)"],
    ...report.daily.map((p) => [p.date, p.value.toFixed(2)]),
  ];
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="waytara-energy-${days}d.csv"`,
    },
  });
}
