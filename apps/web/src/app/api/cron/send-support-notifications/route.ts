import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";
import { createServiceRoleClient } from "@waytara/supabase/service-role";
import { buildSupportEmail, ticketUrl } from "@/lib/support-mail";
import { planSupportBatch, retryDelayMs, type QueueRow, type RecipientFacts, type TicketFacts } from "@/lib/support-plan";
import { sendSupportEmail } from "@/lib/send-support-email";

// Sends the support e-mails that the support functions queued in waytara.support_notifications (a new ticket, a reply, someone taking or
// handing over a ticket, resolved, closed, rated ...). The database calls this route (waytara._support_kick) the moment something is due, and
// a once-a-minute job calls it too, so a missed call only delays an e-mail. Service role: no signed-in user exists for a scheduled job, as
// for the other /api/cron routes.
//
// What it guarantees:
//   - a row is claimed before it is sent (claimed_at), so two overlapping calls never send the same row;
//   - a reply the person has already read in the app is not e-mailed, and several replies become one e-mail (planSupportBatch);
//   - nobody is written to who has no address, has switched support e-mails off, or whose account was closed;
//   - a send that fails is tried again later; one that is switched off (no sender configured) is closed so it does not pile up.

const CLAIM_STALE_MS = 2 * 60_000;
const MAX_ROWS = 100;

type Claimed = QueueRow;

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req, "send-support-notifications")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = createServiceRoleClient();
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const staleIso = new Date(now - CLAIM_STALE_MS).toISOString();

  // 1. claim what is due
  const { data: candidates, error: candidateError } = await supabase
    .from("support_notifications")
    .select("id")
    .is("sent_at", null)
    .lte("due_at", nowIso)
    .or(`claimed_at.is.null,claimed_at.lt.${staleIso}`)
    .order("id")
    .limit(MAX_ROWS);
  if (candidateError) return NextResponse.json({ error: candidateError.message }, { status: 500 });
  if (!candidates || candidates.length === 0) return NextResponse.json({ claimed: 0, sent: 0 });

  const { data: claimedRows, error: claimError } = await supabase
    .from("support_notifications")
    .update({ claimed_at: nowIso })
    .in("id", candidates.map((c) => c.id))
    .is("sent_at", null)
    .or(`claimed_at.is.null,claimed_at.lt.${staleIso}`)
    .select("id, ticket_id, recipient_id, audience, kind, payload, created_at, attempts");
  if (claimError) return NextResponse.json({ error: claimError.message }, { status: 500 });
  const rows = (claimedRows ?? []) as unknown as Claimed[];
  if (rows.length === 0) return NextResponse.json({ claimed: 0, sent: 0 });

  const close = async (ids: number[], note: string | null) => {
    if (ids.length > 0) await supabase.from("support_notifications").update({ sent_at: nowIso, claimed_at: null, last_error: note }).in("id", ids);
  };
  const release = async (ids: number[]) => {
    if (ids.length > 0) await supabase.from("support_notifications").update({ claimed_at: null }).in("id", ids);
  };

  // 2. what the rules need to know
  const ticketIds = [...new Set(rows.map((r) => r.ticket_id))];
  const personIds = [...new Set(rows.map((r) => r.recipient_id))];
  const messageIds = [...new Set(rows.map((r) => r.payload?.message_id).filter((v): v is string => typeof v === "string"))];
  const [ticketResult, personResult, attachmentResult] = await Promise.all([
    supabase.from("support_tickets").select("id, subject, ticket_no, customer_last_read_at, staff_last_read_at, site:sites(name)").in("id", ticketIds),
    supabase.from("profiles").select("id, email, full_name, notification_preferences, deactivated_at, deleted_at").in("id", personIds),
    messageIds.length > 0 ? supabase.from("support_attachments").select("message_id").in("message_id", messageIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (ticketResult.error || personResult.error || attachmentResult.error) {
    await release(rows.map((r) => r.id));
    return NextResponse.json({ error: ticketResult.error?.message ?? personResult.error?.message ?? attachmentResult.error?.message }, { status: 500 });
  }
  const tickets = new Map((ticketResult.data ?? []).map((t) => [t.id, t]));
  const people = new Map((personResult.data ?? []).map((p) => [p.id, p]));
  const fileCount = new Map<string, number>();
  for (const a of attachmentResult.data ?? []) fileCount.set(a.message_id, (fileCount.get(a.message_id) ?? 0) + 1);

  const facts = new Map<string, TicketFacts>([...tickets].map(([id, t]) => [id, { id, customer_last_read_at: t.customer_last_read_at, staff_last_read_at: t.staff_last_read_at }]));
  const recipients = new Map<string, RecipientFacts>(
    [...people].map(([id, p]) => [
      id,
      { id, email: p.email, deactivated_at: p.deactivated_at, deleted_at: p.deleted_at, support_emails: (p.notification_preferences as { support_emails?: boolean } | null)?.support_emails ?? null },
    ]),
  );
  const plan = planSupportBatch(rows, facts, recipients);
  for (const c of plan.close) await close(c.ids, c.note);

  // 3. send
  const urls = { customerApp: process.env.CUSTOMER_APP_URL || "https://www.waytaraenergy.com", adminApp: process.env.ADMIN_APP_URL || "https://admin.waytaraenergy.com" };
  let sent = 0;
  let suppressed = 0;
  let failed = 0;
  for (const { row, covers } of plan.send) {
    const ticket = tickets.get(row.ticket_id);
    const person = people.get(row.recipient_id);
    if (!ticket || !person?.email) {
      await close(covers.map((c) => c.id), "the ticket or the person is gone");
      continue;
    }
    const messageId = typeof row.payload?.message_id === "string" ? row.payload.message_id : null;
    const mail = buildSupportEmail({
      kind: row.kind,
      recipientName: person.full_name,
      ticketNo: ticket.ticket_no,
      subject: ticket.subject,
      siteName: (ticket.site as { name: string | null } | null)?.name ?? null,
      payload: row.payload,
      attachments: messageId ? (fileCount.get(messageId) ?? 0) : 0,
      url: ticketUrl(row.audience, ticket.id, urls),
    });
    const result = await sendSupportEmail(person.email, mail);
    if (result === "sent") {
      sent++;
      await close(covers.map((c) => c.id), null);
    } else if (result === "suppressed") {
      suppressed++;
      await close(covers.map((c) => c.id), "the e-mail sender is switched off");
    } else {
      failed++;
      for (const c of covers) {
        const attempts = c.attempts + 1;
        await supabase
          .from("support_notifications")
          .update({ claimed_at: null, attempts, last_error: "the e-mail service did not take it", due_at: new Date(now + retryDelayMs(attempts)).toISOString() })
          .eq("id", c.id);
      }
    }
  }
  return NextResponse.json({ claimed: rows.length, sent, suppressed, failed, closed: plan.close.reduce((n, c) => n + c.ids.length, 0) });
}
