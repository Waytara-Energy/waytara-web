import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@waytara/supabase/server";
import { gatherReportsBase } from "@/lib/reports/gather";
import { PERIOD_PRESETS, buildCustomReport, type CustomReportDef, type PeriodSpec } from "@/lib/reports/custom-report";
import { customReportCsv } from "@/lib/reports/custom-report-csv";
import { generateCustomReportPdf } from "@/lib/reports/custom-report-pdf";
import { PARAMETER_BY_ID } from "@/lib/reports/parameters";
import { savedParamsSchema, toDef } from "@/lib/reports/saved-report";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "report";

// A report built from parameters, as a file. Either a saved report (?report=<id>) or one described in the address:
//   ?series=pv:My solar,load&from=2026-10-01&to=2026-10-09 (or &period=last30)&name=...&compare=1&format=pdf|csv
// Auth is cookie-based, so RLS scopes everything to whoever is signed in.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const format = q.get("format") === "csv" ? "csv" : "pdf";

  let def: CustomReportDef;
  let deviceId: string | undefined = q.get("device") ?? undefined;
  const reportId = q.get("report");
  if (reportId) {
    const supabase = await createClient();
    const { data: row } = await supabase.from("customer_reports").select("name, params, equipment_id").eq("id", reportId).maybeSingle();
    if (!row) return NextResponse.json({ error: "That report was not found." }, { status: 404 });
    const parsed = savedParamsSchema.safeParse(row.params);
    if (!parsed.success) return NextResponse.json({ error: "The report's settings are not valid." }, { status: 422 });
    def = toDef(row.name, parsed.data);
    deviceId = row.equipment_id ?? deviceId;
  } else {
    const series = (q.get("series") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => {
        const i = s.indexOf(":");
        return i < 0 ? { param: s } : { param: s.slice(0, i), label: s.slice(i + 1).slice(0, 40) };
      });
    if (series.length === 0 || series.some((s) => !PARAMETER_BY_ID[s.param])) return NextResponse.json({ error: "Pick parameters from the list." }, { status: 400 });
    const from = q.get("from");
    const to = q.get("to");
    const preset = q.get("period");
    let period: PeriodSpec;
    if (from && to) {
      if (!DAY.test(from) || !DAY.test(to) || to < from) return NextResponse.json({ error: "from and to must be dates (YYYY-MM-DD)." }, { status: 400 });
      period = { from, to };
    } else if (PERIOD_PRESETS.some((p) => p.id === preset)) period = preset as PeriodSpec;
    else return NextResponse.json({ error: "Give a period." }, { status: 400 });
    def = { name: (q.get("name") ?? "Report").slice(0, 80), series, period, comparePrevious: q.get("compare") === "1" };
  }

  const base = await gatherReportsBase(deviceId);
  if (!base.authorized) return NextResponse.json({ error: "Not available on your plan." }, { status: 403 });
  if (!base.isSolar) return NextResponse.json({ error: "Reports are available for solar inverters." }, { status: 404 });

  const report = buildCustomReport(base, def, base.today);
  const filename = `waytara-${slug(report.name)}-${report.period.from}-to-${report.period.to}.${format}`;
  const headers = { "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "private, no-store" };
  if (format === "csv") return new NextResponse(customReportCsv(report), { headers: { ...headers, "Content-Type": "text/csv; charset=utf-8" } });
  return new NextResponse(new Uint8Array(await generateCustomReportPdf(report)), { headers: { ...headers, "Content-Type": "application/pdf" } });
}
