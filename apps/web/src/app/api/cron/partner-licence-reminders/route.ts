import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@waytara/supabase/service-role";
import { LICENCE_TYPES, readOnboarding } from "@waytara/supabase/partner-onboarding";
import { licenceReminderKey, licenceStatus, reminderDue, todayIst } from "@waytara/supabase/partner-account";
import { isCronAuthorized } from "@/lib/cron-auth";
import { sendMail } from "@/lib/send-mail";
import { SITE } from "@/lib/site";
import { buildLicenceReminderMail } from "@/lib/partner-mail";

/**
 * Daily: e-mails an approved partner who has an account when a licence is 60, 30 or 7 days from running out, and once when it has. A partner gets ONE e-mail listing
 * everything due for them. What was sent is remembered per licence (kind, number and valid-until date) and reminder, so nothing is sent twice, and a renewal (a new
 * date) starts a fresh set. A reminder is marked sent only after the e-mail really went; if mail is switched off or fails, it is tried again tomorrow.
 * Service role: no signed-in user exists for a scheduled job, as for the other /api/cron routes.
 */
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req, "partner-licence-reminders")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = createServiceRoleClient();
  const today = todayIst();
  const portalUrl = `${(process.env.NEXT_PUBLIC_SITE_URL || SITE.url).replace(/\/+$/, "")}/partner/portal/licences`;

  const { data: apps, error } = await db.from("partner_applications").select("id, contact_name, email").eq("status", "approved").not("profile_id", "is", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const ids = (apps ?? []).map((a) => a.id);
  if (ids.length === 0) return NextResponse.json({ partners: 0, sent: 0 });

  const [{ data: onboardings }, { data: sentRows }] = await Promise.all([
    db.from("partner_onboarding").select("application_id, data").in("application_id", ids),
    db.from("partner_licence_reminders").select("application_id, licence_key, threshold").in("application_id", ids),
  ]);
  const already = new Set((sentRows ?? []).map((r) => `${r.application_id}|${r.licence_key}|${r.threshold}`));
  let sent = 0;
  let failed = 0;

  for (const app of apps ?? []) {
    const licences = readOnboarding(onboardings?.find((o) => o.application_id === app.id)?.data).licences;
    const due: { label: string; number: string; days: number; key: string; threshold: number }[] = [];
    for (const l of licences) {
      const status = licenceStatus(l.validUntil, today);
      const threshold = reminderDue(status.days);
      if (threshold === null || status.days === null) continue;
      const key = licenceReminderKey(l);
      if (already.has(`${app.id}|${key}|${threshold}`)) continue;
      due.push({ label: LICENCE_TYPES.find((t) => t.id === l.type)?.label.split(" (")[0] ?? "Licence", number: l.number, days: status.days, key, threshold });
    }
    if (due.length === 0) continue;
    const result = await sendMail(app.email, buildLicenceReminderMail(app.contact_name, due, portalUrl));
    if (result !== "sent") {
      failed++;
      continue;
    }
    await db.from("partner_licence_reminders").upsert(due.map((d) => ({ application_id: app.id, licence_key: d.key, threshold: d.threshold })), { onConflict: "application_id,licence_key,threshold" });
    sent++;
  }
  return NextResponse.json({ partners: ids.length, sent, failed });
}
