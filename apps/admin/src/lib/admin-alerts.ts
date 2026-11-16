import type { createClient } from "@waytara/supabase/server";
import { licenceStatus, todayIst } from "@waytara/supabase/partner-account";
import { memberKey, readOnboarding } from "@waytara/supabase/partner-onboarding";
import { isMemberCheckKey, isCheckState, memberStatus, type MemberCheckKey, type CheckState } from "@waytara/supabase/partner-verification";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** One line of the notification center. */
export interface AdminNotification {
  id: string;
  kind: "lead" | "support" | "alert" | "partner";
  title: string;
  detail: string;
  at: string;
  href: string;
  /** how loud it is: a critical device alert is "critical" */
  tone: "info" | "warning" | "critical";
}

/** What needs the team's attention, for the badges in the sidebar and the notification center. */
export interface AdminAlerts {
  counts: { leads: number; support: number; alerts: number; partners: number };
  /** What sits inside the partners count, for the Overview: stalled onboardings and partners with a licence that has run out or is about to. */
  partnerDue: { stalled: number; licences: number; members: number };
  items: AdminNotification[];
}

const EMPTY: AdminAlerts = { counts: { leads: 0, support: 0, alerts: 0, partners: 0 }, partnerDue: { stalled: 0, licences: 0, members: 0 }, items: [] };

/** An onboarding with no activity for this long is "stalled" and worth a nudge. */
const STALLED_DAYS = 3;

/**
 * Reads what needs attention, as the signed-in person is allowed to see it (row-level security decides: an employee sees their own leads and
 * the tickets of their sites). A site engineer works the support desk only, so only that is read for them.
 */
export async function loadAdminAlerts(supabase: Supabase, role: string | null | undefined): Promise<AdminAlerts> {
  if (!role) return EMPTY;
  const supportOnly = role === "site_engineer";

  // Partner applications are the admins' to handle: a new one to look at, or one whose onboarding was sent and is waiting to be verified.
  const [leads, tickets, alerts, partners] = await Promise.all([
    supportOnly
      ? null
      : supabase.from("leads").select("id, full_name, created_at", { count: "exact" }).eq("status", "new").order("created_at", { ascending: false }).limit(5),
    supabase
      .from("support_tickets")
      .select("id, ticket_no, subject, customer_name, last_message_at, last_message_preview", { count: "exact" })
      .gt("unread_staff", 0)
      .neq("status", "closed")
      .order("last_message_at", { ascending: false })
      .limit(6),
    supportOnly
      ? null
      : supabase
          .from("alerts")
          .select("id, message, severity, ts, device:equipment(label, serial_number, site:sites(name))", { count: "exact" })
          .is("resolved_at", null)
          .is("acknowledged_at", null)
          .order("ts", { ascending: false })
          .limit(6),
    role === "admin"
      ? supabase.from("partner_applications").select("id, company_name, status, created_at, updated_at").in("status", ["new", "verification", "onboarding", "approved"]).order("created_at", { ascending: false }).limit(500)
      : null,
  ]);

  // Partners that need the team: a new application, an onboarding sent for verification, an onboarding that has gone quiet, and an approved partner with a licence that
  // has run out or runs out within 60 days (read from what the partner entered).
  const partnerRows = partners?.data ?? [];
  const now = Date.now();
  const stalled = partnerRows.filter((p) => p.status === "onboarding" && now - Date.parse(p.updated_at) >= STALLED_DAYS * 86_400_000);
  const approvedIds = partnerRows.filter((p) => p.status === "approved").map((p) => p.id);
  const licenceDue: { id: string; company: string; text: string; expired: boolean }[] = [];
  const memberWaiting: { id: string; company: string; names: string[] }[] = [];
  if (approvedIds.length > 0) {
    const [{ data: onboardings }, { data: memberChecks }] = await Promise.all([
      supabase.from("partner_onboarding").select("application_id, data").in("application_id", approvedIds),
      supabase.from("partner_item_checks").select("application_id, subject, key, state").in("application_id", approvedIds).like("subject", "member:%"),
    ]);
    const today = todayIst();
    for (const o of onboardings ?? []) {
      // people added to the team of an approved partner who have not been verified yet: each is waiting for an admin
      const data = readOnboarding(o.data);
      const states: Record<string, Partial<Record<MemberCheckKey, CheckState>>> = {};
      for (const c of memberChecks ?? []) if (c.application_id === o.application_id && isMemberCheckKey(c.key) && isCheckState(c.state)) (states[c.subject.slice(7)] ??= {})[c.key] = c.state;
      const waiting = data.team.members.map((m, i) => ({ m, ref: { key: memberKey(m, i), name: m.name, needsLicence: m.needsLicence } })).filter((x) => x.m.name && memberStatus(x.ref, states) !== "verified");
      if (waiting.length > 0) memberWaiting.push({ id: o.application_id, company: partnerRows.find((p) => p.id === o.application_id)?.company_name ?? "A partner", names: waiting.map((x) => x.m.name) });
      const due = data.licences.map((l) => ({ l, s: licenceStatus(l.validUntil, today) })).filter((x) => x.s.state === "expired" || x.s.state === "soon").sort((a, b) => (a.s.days ?? 0) - (b.s.days ?? 0))[0];
      if (!due) continue;
      const days = due.s.days ?? 0;
      licenceDue.push({ id: o.application_id, company: partnerRows.find((p) => p.id === o.application_id)?.company_name ?? "A partner", expired: due.s.state === "expired", text: due.s.state === "expired" ? `Licence ${due.l.number} expired ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago` : `Licence ${due.l.number} runs out in ${days} day${days === 1 ? "" : "s"}` });
    }
  }
  const partnerNew = partnerRows.filter((p) => p.status === "new");
  const partnerVerify = partnerRows.filter((p) => p.status === "verification");
  const partnerCount = partnerNew.length + partnerVerify.length + stalled.length + licenceDue.length + memberWaiting.length;

  const items: AdminNotification[] = [
    ...(leads?.data ?? []).map((l): AdminNotification => ({ id: `lead-${l.id}`, kind: "lead", title: "New lead", detail: l.full_name, at: l.created_at, href: `/leads/${l.id}`, tone: "info" })),
    ...(tickets.data ?? []).map((t): AdminNotification => ({
      id: `support-${t.id}`,
      kind: "support",
      title: `Ticket #${t.ticket_no}: ${t.subject}`,
      detail: [t.customer_name, t.last_message_preview].filter(Boolean).join(" · "),
      at: t.last_message_at ?? new Date().toISOString(),
      href: `/support/${t.id}`,
      tone: "warning",
    })),
    ...(alerts?.data ?? []).map((a): AdminNotification => ({
      id: `alert-${a.id}`,
      kind: "alert",
      title: a.severity === "critical" ? "Critical device alert" : "Device alert",
      detail: [a.device?.label ?? a.device?.serial_number, a.device?.site?.name, a.message].filter(Boolean).join(" · "),
      at: a.ts,
      href: "/alerts",
      tone: a.severity === "critical" ? "critical" : "warning",
    })),
    ...[...partnerNew, ...partnerVerify].slice(0, 6).map((p): AdminNotification => ({
      id: `partner-${p.id}`,
      kind: "partner",
      title: p.status === "verification" ? "Partner ready to verify" : "New partner application",
      detail: p.company_name,
      at: p.status === "verification" ? p.updated_at : p.created_at,
      href: `/partners/${p.id}`,
      tone: p.status === "verification" ? "warning" : "info",
    })),
    ...stalled.slice(0, 4).map((p): AdminNotification => ({ id: `partner-stalled-${p.id}`, kind: "partner", title: "Onboarding has gone quiet", detail: `${p.company_name} · no activity for ${Math.floor((now - Date.parse(p.updated_at)) / 86_400_000)} days`, at: p.updated_at, href: `/partners/${p.id}`, tone: "warning" })),
    ...memberWaiting.slice(0, 4).map((x): AdminNotification => ({ id: `partner-members-${x.id}`, kind: "partner", title: "Team member to verify", detail: `${x.company} · ${x.names.join(", ")}`, at: new Date().toISOString(), href: `/partners/${x.id}?tab=team`, tone: "warning" })),
    ...licenceDue.slice(0, 4).map((x): AdminNotification => ({ id: `partner-licence-${x.id}`, kind: "partner", title: x.expired ? "Partner licence expired" : "Partner licence expiring", detail: `${x.company} · ${x.text}`, at: new Date().toISOString(), href: `/partners/${x.id}`, tone: x.expired ? "critical" : "warning" })),
  ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  return { counts: { leads: leads?.count ?? 0, support: tickets.count ?? 0, alerts: alerts?.count ?? 0, partners: partnerCount }, partnerDue: { stalled: stalled.length, licences: licenceDue.length, members: memberWaiting.length }, items: items.slice(0, 12) };
}
