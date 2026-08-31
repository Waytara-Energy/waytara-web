import { NextRequest, NextResponse } from "next/server";
import { gatherReportData } from "@/lib/gather-report-data";

const ALLOWED_DAYS = [30, 90, 365];

// Route Handler (Vercel Function), not a Supabase Edge Function — same
// backend convention as /api/leads. Auth is cookie-based via
// gatherReportData -> createClient(), so RLS scopes the export to
// whichever customer is signed in; there's nothing to authorize here
// beyond what the query already restricts.
export async function GET(req: NextRequest) {
  const daysParam = Number(req.nextUrl.searchParams.get("days"));
  const days = ALLOWED_DAYS.includes(daysParam) ? daysParam : 90;

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
