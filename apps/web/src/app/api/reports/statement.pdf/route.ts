import { NextRequest, NextResponse } from "next/server";
import { gatherReportsBase } from "@/lib/reports/gather";
import { buildStatement } from "@/lib/reports/statement-data";
import { generateStatementPdf } from "@/lib/reports/statement-pdf";

// One month's statement. Auth is cookie-based through gatherReportsBase -> createClient(), so RLS scopes it to whoever is signed in.
export async function GET(req: NextRequest) {
  const month = req.nextUrl.searchParams.get("month") ?? "";
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return NextResponse.json({ error: "month must be YYYY-MM" }, { status: 400 });
  const base = await gatherReportsBase(req.nextUrl.searchParams.get("device") ?? undefined);
  if (!base.authorized) return NextResponse.json({ error: "Not available on your plan." }, { status: 403 });
  if (!base.isSolar) return NextResponse.json({ error: "Statements are available for solar inverters." }, { status: 404 });

  const pdf = await generateStatementPdf(buildStatement(base, month));
  return new NextResponse(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="waytara-statement-${month}.pdf"` },
  });
}
