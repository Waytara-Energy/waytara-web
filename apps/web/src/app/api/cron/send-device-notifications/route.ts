import { digestKey, wants } from "@/lib/notification-prefs";
import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";
import { createServiceRoleClient } from "@waytara/supabase/service-role";
import { buildHubEmail, buildStatusDigest, itemOf, planBatch, type DigestItem, type OutboxRow } from "@/lib/device-status-mail";
import { sendDeviceStatusEmail } from "@/lib/send-device-status-email";

// Sends the device-status e-mails that waytara.fleet_tick() queued in waytara.notification_outbox (see GATEWAY_V3_TASKS.md, T3 and T5).
// fleet_tick calls this route (waytara.invoke_cron_route) only when something is due, never more than every 30 seconds. Service role: no
// signed-in user exists for a scheduled job, as for the other /api/cron routes.
//
// What it guarantees:
//   - a row is claimed before it is sent (claimed_at), so two overlapping calls never send the same row;
//   - one customer gets one e-mail with everything that is due for them, and never another within 10 minutes of the last (planBatch);
//   - an "offline" or "still offline" row whose alert has been resolved in the meantime is dropped, not sent;
//   - a customer who has since switched alert e-mails off, or was deactivated or deleted, gets nothing;
//   - a send that fails is retried later (the row stays), one that is switched off (suppressed) is closed so it does not pile up.

const CLAIM_STALE_MS = 2 * 60_000;
const MAX_ROWS = 200;

type Mail = { subject: string; text: string; html: string };

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req, "send-device-notifications")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = createServiceRoleClient();
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const staleIso = new Date(now - CLAIM_STALE_MS).toISOString();

  // 1. claim what is due
  const { data: candidates, error: candidateError } = await supabase
    .from("notification_outbox")
    .select("id")
    .is("sent_at", null)
    .lte("due_at", nowIso)
    .or(`claimed_at.is.null,claimed_at.lt.${staleIso}`)
    .order("id")
    .limit(MAX_ROWS);
  if (candidateError) return NextResponse.json({ error: candidateError.message }, { status: 500 });
  if (!candidates || candidates.length === 0) return NextResponse.json({ claimed: 0, sent: 0 });

  const { data: claimedRows, error: claimError } = await supabase
    .from("notification_outbox")
    .update({ claimed_at: nowIso })
    .in("id", candidates.map((c) => c.id))
    .is("sent_at", null)
    .or(`claimed_at.is.null,claimed_at.lt.${staleIso}`)
    .select("id, audience, kind, customer_id, device_id, alert_id, payload, created_at, attempts");
  if (claimError) return NextResponse.json({ error: claimError.message }, { status: 500 });
  const rows = (claimedRows ?? []) as unknown as OutboxRow[];
  if (rows.length === 0) return NextResponse.json({ claimed: 0, sent: 0 });

  const release = async (ids: number[]) => {
    if (ids.length > 0) await supabase.from("notification_outbox").update({ claimed_at: null }).in("id", ids);
  };
  const close = async (ids: number[], note: string | null) => {
    if (ids.length > 0) await supabase.from("notification_outbox").update({ sent_at: nowIso, claimed_at: null, last_error: note }).in("id", ids);
  };
  const retryLater = async (list: OutboxRow[], error: string) => {
    for (const r of list) {
      const attempts = r.attempts + 1;
      const waitMs = attempts >= 5 ? 6 * 3_600_000 : Math.min(30, attempts * 2) * 60_000;
      await supabase.from("notification_outbox").update({ claimed_at: null, attempts, last_error: error.slice(0, 300), due_at: new Date(now + waitMs).toISOString() }).eq("id", r.id);
    }
  };

  // 2. who is waiting and who was e-mailed lately
  const customerIds = [...new Set(rows.map((r) => r.customer_id).filter((v): v is string => v !== null))];
  const [stateResult, profileResult, adminResult] = await Promise.all([
    customerIds.length > 0 ? supabase.from("notification_state").select("customer_id, last_status_email_at").in("customer_id", customerIds) : Promise.resolve({ data: [], error: null }),
    customerIds.length > 0
      ? supabase.from("profiles").select("id, email, full_name, notification_preferences, deactivated_at, deleted_at").in("id", customerIds)
      : Promise.resolve({ data: [], error: null }),
    rows.some((r) => r.audience === "admin")
      ? supabase.from("profiles").select("id, email, notification_preferences, deactivated_at, deleted_at").eq("role", "admin")
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (stateResult.error || profileResult.error || adminResult.error) {
    await release(rows.map((r) => r.id));
    return NextResponse.json({ error: stateResult.error?.message ?? profileResult.error?.message ?? adminResult.error?.message }, { status: 500 });
  }
  const lastEmailAt = new Map<string, string>();
  for (const s of stateResult.data ?? []) if (s.last_status_email_at) lastEmailAt.set(s.customer_id, s.last_status_email_at);

  const plan = planBatch(rows, lastEmailAt, now);
  await release(plan.waiting.map((r) => r.id));

  // 3. drop customer rows whose alert has cleared since they were queued (offline / still offline only)
  const alertIds = [...plan.customers.values()].flat().filter((r) => (r.kind === "offline" || r.kind === "still_offline") && r.alert_id).map((r) => r.alert_id as string);
  const resolved = new Set<string>();
  if (alertIds.length > 0) {
    const { data } = await supabase.from("alerts").select("id, resolved_at").in("id", alertIds);
    for (const a of data ?? []) if (a.resolved_at) resolved.add(a.id);
  }

  const dashboardUrl = `${process.env.CUSTOMER_APP_URL || "https://www.waytaraenergy.com"}/dashboard`;
  const profiles = new Map((profileResult.data ?? []).map((p) => [p.id, p]));
  let sent = 0;
  let suppressed = 0;
  let failed = 0;

  // 4. one e-mail per customer
  for (const [customerId, list] of plan.customers) {
    const wanted = list.filter((r) => !((r.kind === "offline" || r.kind === "still_offline") && r.alert_id && resolved.has(r.alert_id)));
    await close(list.filter((r) => !wanted.includes(r)).map((r) => r.id), "its alert cleared before it was sent");
    if (wanted.length === 0) continue;

    const p = profiles.get(customerId);
    if (!p || !p.email || p.deactivated_at || p.deleted_at) {
      await close(wanted.map((r) => r.id), "the customer cannot be e-mailed");
      suppressed += wanted.length;
      continue;
    }
    // each line goes by its own switch in Settings > Notifications (offline and reminders, back online)
    const allowed = wanted.filter((r) => (r.kind === "offline" || r.kind === "still_offline" || r.kind === "back_online" ? wants(p.notification_preferences, digestKey(r.kind, itemOf(r)?.cause ?? null)) : true));
    await close(wanted.filter((r) => !allowed.includes(r)).map((r) => r.id), "the customer turned this e-mail off");
    suppressed += wanted.length - allowed.length;
    if (allowed.length === 0) continue;
    const items = allowed.map(itemOf).filter((i): i is DigestItem => i !== null);
    const mail: Mail = buildStatusDigest({ customerName: p.full_name, items, dashboardUrl });
    const result = await sendDeviceStatusEmail(p.email, mail);
    if (result === "sent") {
      sent += 1;
      await close(allowed.map((r) => r.id), null);
      await supabase.from("notification_state").upsert({ customer_id: customerId, last_status_email_at: nowIso });
      // remember when the customer was last told about each alert: reminders count from here
      for (const r of allowed) {
        if ((r.kind === "offline" || r.kind === "still_offline") && r.alert_id) {
          const { data: a } = await supabase.from("alerts").select("notified_count").eq("id", r.alert_id).maybeSingle();
          await supabase.from("alerts").update({ last_notified_at: nowIso, notified_count: (a?.notified_count ?? 0) + 1 }).eq("id", r.alert_id);
        }
      }
    } else if (result === "suppressed") {
      suppressed += allowed.length;
      await close(allowed.map((r) => r.id), "suppressed: e-mails are switched off");
    } else {
      failed += 1;
      await retryLater(allowed, "Resend did not accept the e-mail");
    }
  }

  // 5. the hub's own messages: one e-mail to every admin
  if (plan.admin.length > 0) {
    const admins = (adminResult.data ?? []).filter((a) => a.email && !a.deactivated_at && !a.deleted_at && (a.notification_preferences as { email_alerts?: boolean } | null)?.email_alerts !== false);
    if (admins.length === 0) {
      await close(plan.admin.map((r) => r.id), "there is no admin to tell");
    } else {
      const mail = buildHubEmail(plan.admin, `${process.env.ADMIN_APP_URL || "https://admin.waytaraenergy.com"}/dashboard`);
      const results = await Promise.all(admins.map((a) => sendDeviceStatusEmail(a.email as string, mail)));
      if (results.some((r) => r === "sent")) {
        sent += 1;
        await close(plan.admin.map((r) => r.id), null);
      } else if (results.every((r) => r === "suppressed")) {
        suppressed += plan.admin.length;
        await close(plan.admin.map((r) => r.id), "suppressed: e-mails are switched off");
      } else {
        failed += 1;
        await retryLater(plan.admin, "Resend did not accept the e-mail");
      }
    }
  }

  return NextResponse.json({ claimed: rows.length, waiting: plan.waiting.length, sent, suppressed, failed });
}
