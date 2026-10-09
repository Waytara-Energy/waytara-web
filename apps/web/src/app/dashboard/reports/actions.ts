"use server";

import { createClient } from "@waytara/supabase/server";
import { getRequestProfile } from "@/lib/request-profile";
import { getCustomerPlan } from "@/lib/customer-plan";
import { parseEmails } from "@/lib/reports/recipients";
import { reportFormSchema } from "@/lib/reports/saved-report";
import { nextRunAt, type Schedule } from "@/lib/reports/schedule";
import { runSavedReport, type ReportRow } from "@/lib/reports/run-report";

const MAX_REPORTS = 20;

export type ActionResult = { ok: true; id?: string; message?: string } | { ok: false; error: string; /** The attempt was recorded as a run (so the dashboard shows it live); no further message is needed. */ recorded?: boolean };

async function context() {
  const profile = await getRequestProfile();
  if (!profile) return null;
  const plan = await getCustomerPlan();
  if (!plan?.features?.reports) return null;
  return { profile, supabase: await createClient() };
}

const SELECT = "id, customer_id, equipment_id, name, params, schedule_kind, schedule_time, schedule_dow, schedule_dom, send_to_me, recipients, enabled";

/** Creates a report (no `id`) or changes one. The next run is worked out here, in India time. */
export async function saveReportAction(input: unknown, id: string | null, deviceId: string | null): Promise<ActionResult> {
  const ctx = await context();
  if (!ctx) return { ok: false, error: "Reports are not available on your plan." };
  const parsed = reportFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the report's settings." };
  const v = parsed.data;

  const schedule: Schedule = { kind: v.schedule.kind, time: v.schedule.time, dow: v.schedule.dow, dom: v.schedule.dom };
  const next = v.enabled ? nextRunAt(schedule, new Date()) : null;
  const row = {
    name: v.name,
    params: v.params,
    equipment_id: deviceId,
    schedule_kind: v.schedule.kind,
    schedule_time: v.schedule.time,
    schedule_dow: v.schedule.kind === "weekly" ? (v.schedule.dow ?? null) : null,
    schedule_dom: v.schedule.kind === "monthly" ? (v.schedule.dom ?? null) : null,
    send_to_me: v.sendToMe,
    recipients: v.recipients.map((e) => e.toLowerCase()),
    enabled: v.enabled,
    next_run_at: next ? next.toISOString() : null,
  };

  if (id) {
    const { error } = await ctx.supabase.from("customer_reports").update(row).eq("id", id);
    if (error) return { ok: false, error: "The report could not be saved." };
    return { ok: true, id };
  }
  const { count } = await ctx.supabase.from("customer_reports").select("id", { count: "exact", head: true });
  if ((count ?? 0) >= MAX_REPORTS) return { ok: false, error: `You can keep up to ${MAX_REPORTS} reports. Delete one to add another.` };
  const { data, error } = await ctx.supabase.from("customer_reports").insert({ ...row, customer_id: ctx.profile.id }).select("id").single();
  if (error || !data) return { ok: false, error: "The report could not be saved." };
  return { ok: true, id: data.id };
}

export async function deleteReportAction(id: string): Promise<ActionResult> {
  const ctx = await context();
  if (!ctx) return { ok: false, error: "Reports are not available on your plan." };
  const { error } = await ctx.supabase.from("customer_reports").delete().eq("id", id);
  return error ? { ok: false, error: "The report could not be deleted." } : { ok: true };
}

/** Pauses or resumes a schedule. */
export async function setReportEnabledAction(id: string, enabled: boolean): Promise<ActionResult> {
  const ctx = await context();
  if (!ctx) return { ok: false, error: "Reports are not available on your plan." };
  const { data: row } = await ctx.supabase.from("customer_reports").select(SELECT).eq("id", id).maybeSingle();
  if (!row) return { ok: false, error: "That report no longer exists." };
  const next = enabled && row.schedule_kind !== "none" ? nextRunAt({ kind: row.schedule_kind as Schedule["kind"], time: row.schedule_time.slice(0, 5), dow: row.schedule_dow, dom: row.schedule_dom }, new Date()) : null;
  const { error } = await ctx.supabase.from("customer_reports").update({ enabled, next_run_at: next ? next.toISOString() : null }).eq("id", id);
  return error ? { ok: false, error: "The report could not be changed." } : { ok: true };
}

/** Generates the report now and e-mails it: to the addresses typed (just this once), or to its usual recipients when none are typed. */
export async function sendReportNowAction(id: string, emailsText: string): Promise<ActionResult> {
  const ctx = await context();
  if (!ctx) return { ok: false, error: "Reports are not available on your plan." };
  const { data: row } = await ctx.supabase.from("customer_reports").select(SELECT).eq("id", id).maybeSingle();
  if (!row) return { ok: false, error: "That report no longer exists." };

  const { valid, invalid } = parseEmails(emailsText);
  if (invalid.length > 0) return { ok: false, error: `Not a valid e-mail address: ${invalid.join(", ")}` };
  if (valid.length > 10) return { ok: false, error: "Send to at most 10 addresses at a time." };

  const result = await runSavedReport(row as ReportRow, "send_now", valid.length > 0 ? valid : undefined);
  return result.ok ? { ok: true, message: "Sent." } : { ok: false, error: result.error ?? "The report could not be sent.", recorded: result.runId !== null };
}
