import { NextRequest, NextResponse } from "next/server";
import { daysInclusive } from "@/lib/reports/period-math";
import { generateEvReportPdf } from "@/lib/reports/ev-report-pdf";
import { gatherEvReport } from "@/lib/reports/ev-report-data";

const MAX_DAYS = 730;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

// The EV charging report of a period as a PDF. Auth is cookie-based, so RLS scopes it to whoever is signed in.
export async function GET(req: NextRequest) {
  const from = req.nextUrl.searchParams.get("from") ?? "";
  const to = req.nextUrl.searchParams.get("to") ?? "";
  if (!DAY.test(from) || !DAY.test(to) || to < from || daysInclusive(from, to) > MAX_DAYS) {
    return NextResponse.json({ error: "from and to must be YYYY-MM-DD dates, at most 730 days apart" }, { status: 400 });
  }
  const r = await gatherEvReport(req.nextUrl.searchParams.get("device") ?? undefined, from, to);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  const pdf = await generateEvReportPdf(r.report);
  return new NextResponse(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="waytara-ev-charging-${from}-to-${to}.pdf"` },
  });
}
