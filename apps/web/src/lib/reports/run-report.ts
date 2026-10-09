import "server-only";
import { createServiceRoleClient } from "@waytara/supabase/service-role";
import { gatherReportsBaseForCustomer } from "./gather";
import { buildCustomReport, type CustomReport } from "./custom-report";
import { customReportCsv } from "./custom-report-csv";
import { generateCustomReportPdf } from "./custom-report-pdf";
import { buildReportEmail, sendReportEmail } from "./report-email";
import { allRecipients } from "./recipients";
import { savedParamsSchema, toDef } from "./saved-report";
import { describeSchedule, nextRunAt, type Schedule } from "./schedule";

export interface ReportRow {
  id: string;
  customer_id: string;
  equipment_id: string | null;
  name: string;
  params: unknown;
  schedule_kind: string;
  schedule_time: string;
  schedule_dow: number | null;
  schedule_dom: number | null;
  send_to_me: boolean;
  recipients: string[];
  enabled: boolean;
}

export const scheduleOf = (r: Pick<ReportRow, "schedule_kind" | "schedule_time" | "schedule_dow" | "schedule_dom">): Schedule => ({
  kind: r.schedule_kind as Schedule["kind"],
  time: r.schedule_time.slice(0, 5),
  dow: r.schedule_dow,
  dom: r.schedule_dom,
});

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "report";

/** Builds a saved report's numbers and files for the customer it belongs to (no signed-in user needed). */
export async function buildSavedReport(row: ReportRow): Promise<{ ok: true; report: CustomReport; files: { filename: string; content: Buffer }[]; customerName: string; customerEmail: string | null } | { ok: false; error: string }> {
  const parsed = savedParamsSchema.safeParse(row.params);
  if (!parsed.success) return { ok: false, error: "The report's settings are no longer valid." };
  const base = await gatherReportsBaseForCustomer(row.customer_id, row.equipment_id);
  if (!base) return { ok: false, error: "The device or the Reports feature is no longer available for this account." };

  const report = buildCustomReport(base, toDef(row.name, parsed.data), base.today);
  const stamp = `${report.period.from}-to-${report.period.to}`;
  const files: { filename: string; content: Buffer }[] = [];
  if (parsed.data.formats.includes("pdf")) files.push({ filename: `waytara-${slug(row.name)}-${stamp}.pdf`, content: await generateCustomReportPdf(report) });
  if (parsed.data.formats.includes("csv")) files.push({ filename: `waytara-${slug(row.name)}-${stamp}.csv`, content: Buffer.from(customReportCsv(report), "utf-8") });
  return { ok: true, report, files, customerName: base.customerName, customerEmail: base.customerEmail };
}

/**
 * Generates a saved report and e-mails it, recording each step in customer_report_runs (which the dashboard shows live).
 * `to` overrides who gets it (a one-off "send now to ..."); otherwise it goes to the customer and the report's own list.
 */
export async function runSavedReport(row: ReportRow, trigger: "schedule" | "send_now", to?: string[]): Promise<{ ok: boolean; runId: string | null; error?: string }> {
  const supabase = createServiceRoleClient();
  const { data: run } = await supabase
    .from("customer_report_runs")
    .insert({ report_id: row.id, customer_id: row.customer_id, trigger, status: "sending", recipients: to ?? row.recipients })
    .select("id")
    .single();
  const runId = run?.id ?? null;

  const finish = async (status: "sent" | "failed", fields: { recipients?: string[]; file_names?: string[]; error?: string | null }) => {
    if (runId) await supabase.from("customer_report_runs").update({ status, finished_at: new Date().toISOString(), ...fields }).eq("id", runId);
    if (trigger === "schedule") {
      const next = nextRunAt(scheduleOf(row), new Date());
      await supabase.from("customer_reports").update({ last_run_at: new Date().toISOString(), next_run_at: next ? next.toISOString() : null }).eq("id", row.id);
    }
  };

  try {
    const built = await buildSavedReport(row);
    if (!built.ok) {
      await finish("failed", { error: built.error });
      return { ok: false, runId, error: built.error };
    }
    const recipients = to && to.length > 0 ? to : allRecipients(built.customerEmail, row.send_to_me, row.recipients);
    if (recipients.length === 0) {
      const error = "There is nobody to send this report to.";
      await finish("failed", { error });
      return { ok: false, runId, error };
    }
    if (runId) await supabase.from("customer_report_runs").update({ recipients }).eq("id", runId);

    const dashboardUrl = `${process.env.CUSTOMER_APP_URL || "https://www.waytaraenergy.com"}/dashboard/reports#downloads`;
    const why = trigger === "schedule" ? describeSchedule(scheduleOf(row)) : "Sent on request";
    const mail = buildReportEmail({ customerName: built.customerName, report: built.report, why, dashboardUrl, fileNames: built.files.map((f) => f.filename) });
    const sent = await sendReportEmail(recipients, mail, built.files);
    if (!sent.ok) {
      await finish("failed", { recipients, error: sent.error });
      return { ok: false, runId, error: sent.error };
    }
    await finish("sent", { recipients, file_names: built.files.map((f) => f.filename), error: null });
    return { ok: true, runId };
  } catch (e) {
    const error = e instanceof Error ? e.message : "The report could not be generated.";
    await finish("failed", { error });
    return { ok: false, runId, error };
  }
}
