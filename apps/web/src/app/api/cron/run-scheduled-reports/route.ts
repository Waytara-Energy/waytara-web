import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@waytara/supabase/service-role";
import { isCronAuthorized } from "@/lib/cron-auth";
import { runSavedReport, scheduleOf, type ReportRow } from "@/lib/reports/run-report";
import { nextRunAt } from "@/lib/reports/schedule";

// The scheduled reports (pg_cron calls this every minute through waytara.invoke_cron_route). Each report that is due is first
// "claimed" - its next run is moved on, but only if nobody else moved it - so two overlapping calls never send the same report twice;
// then it is generated and e-mailed, and the result recorded in customer_report_runs (which the dashboard shows live).
// No signed-in user exists for a scheduled job, so this is one of the legitimate service_role cases.

const BATCH = 8;

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req, "run-scheduled-reports")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServiceRoleClient();
  const now = new Date();
  const { data: due, error } = await supabase
    .from("customer_reports")
    .select("id, customer_id, equipment_id, name, params, schedule_kind, schedule_time, schedule_dow, schedule_dom, send_to_me, recipients, enabled, next_run_at")
    .eq("enabled", true)
    .neq("schedule_kind", "none")
    .lte("next_run_at", now.toISOString())
    .order("next_run_at")
    .limit(BATCH);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  for (const r of due ?? []) {
    const next = nextRunAt(scheduleOf(r), now);
    const { data: claimed } = await supabase
      .from("customer_reports")
      .update({ next_run_at: next ? next.toISOString() : null })
      .eq("id", r.id)
      .eq("next_run_at", r.next_run_at as string)
      .select("id")
      .maybeSingle();
    if (!claimed) {
      skipped++;
      continue;
    }
    const result = await runSavedReport(r as ReportRow, "schedule");
    if (result.ok) sent++;
    else failed++;
  }
  return NextResponse.json({ due: (due ?? []).length, sent, failed, skipped });
}
