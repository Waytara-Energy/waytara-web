import type { createClient } from "@waytara/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** One line of the notification center. */
export interface AdminNotification {
  id: string;
  kind: "lead" | "support" | "alert";
  title: string;
  detail: string;
  at: string;
  href: string;
  /** how loud it is: a critical device alert is "critical" */
  tone: "info" | "warning" | "critical";
}

/** What needs the team's attention, for the badges in the sidebar and the notification center. */
export interface AdminAlerts {
  counts: { leads: number; support: number; alerts: number };
  items: AdminNotification[];
}

const EMPTY: AdminAlerts = { counts: { leads: 0, support: 0, alerts: 0 }, items: [] };

/**
 * Reads what needs attention, as the signed-in person is allowed to see it (row-level security decides: an employee sees their own leads and
 * the tickets of their sites). A site engineer works the support desk only, so only that is read for them.
 */
export async function loadAdminAlerts(supabase: Supabase, role: string | null | undefined): Promise<AdminAlerts> {
  if (!role) return EMPTY;
  const supportOnly = role === "site_engineer";

  const [leads, tickets, alerts] = await Promise.all([
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
  ]);

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
  ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  return { counts: { leads: leads?.count ?? 0, support: tickets.count ?? 0, alerts: alerts?.count ?? 0 }, items: items.slice(0, 12) };
}
