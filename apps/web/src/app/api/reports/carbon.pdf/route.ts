import { NextRequest, NextResponse } from "next/server";
import { gatherReportsBase } from "@/lib/reports/gather";
import { buildCarbonPack } from "@/lib/reports/carbon-data";
import { generateCarbonPdf } from "@/lib/reports/carbon-pdf";

// The carbon and sustainability report for a financial year (fy-2026 is April 2026 to March 2027) or all the history on file. Auth is cookie-based through
// gatherReportsBase -> createClient(), so RLS scopes it to whoever is signed in.
export async function GET(req: NextRequest) {
  const period = req.nextUrl.searchParams.get("period") ?? "";
  if (!/^(all|fy-\d{4})$/.test(period)) return NextResponse.json({ error: "period must be 'all' or fy-YYYY" }, { status: 400 });
  const base = await gatherReportsBase(req.nextUrl.searchParams.get("device") ?? undefined);
  if (!base.authorized) return NextResponse.json({ error: "Not available on your plan." }, { status: 403 });
  if (!base.isSolar) return NextResponse.json({ error: "The carbon report is available for solar inverters." }, { status: 404 });
  const pack = buildCarbonPack(base, period);
  if (!pack) return NextResponse.json({ error: "There are no readings in that period." }, { status: 404 });

  const pdf = await generateCarbonPdf(pack);
  return new NextResponse(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="waytara-carbon-${period}.pdf"`, "Cache-Control": "private, no-store" },
  });
}
