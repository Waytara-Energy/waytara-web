import { Suspense } from "react";
import { cookies } from "next/headers";
import { createClient } from "@waytara/supabase/server";
import { getRequestProfile } from "@/lib/request-profile";
import { deviceDisplayId, getCustomerSites, resolveSelectedSite, SELECTED_SITE_COOKIE } from "@/lib/selected-site";
import { NewSupportTicketDialog } from "@/components/dashboard/new-support-ticket-dialog";
import { SupportInbox, type InboxTicket } from "@/components/dashboard/support-inbox";
import { SupportShell } from "@/components/dashboard/support-shell";

// The ticket list stays on the left while the right side changes (the help, or a conversation): this layout is not rebuilt when a ticket is
// opened. It follows the tickets live (see SupportInbox).
export default async function SupportLayout({ children }: { children: React.ReactNode }) {
  const [profile, sites, cookieStore] = await Promise.all([getRequestProfile(), getCustomerSites(), cookies()]);
  const supabase = await createClient();
  const selected = resolveSelectedSite(sites, cookieStore.get(SELECTED_SITE_COOKIE)?.value);

  const { data } = profile
    ? await supabase
        .from("support_tickets")
        .select("id, ticket_no, subject, status, site_id, assigned_name, assigned_role, last_message_at, last_message_preview, last_message_role, unread_customer, updated_at, rating")
        .order("updated_at", { ascending: false })
        .limit(200)
    : { data: null };

  const siteName = new Map(sites.map((s) => [s.id, s.name]));
  const tickets: InboxTicket[] = (data ?? []).map((t) => ({ ...t, site_name: t.site_id ? (siteName.get(t.site_id) ?? null) : null }));

  return (
    <SupportShell
      list={
        <SupportInbox
          tickets={tickets}
          customerId={profile?.id ?? ""}
          action={<Suspense fallback={null}><NewSupportTicketDialog fromLink sites={sites.map((s) => ({ id: s.id, name: s.name, devices: s.devices.map((d) => ({ id: d.id, name: deviceDisplayId(d) })) }))} defaultSiteId={selected?.id ?? sites[0]?.id ?? null} /></Suspense>}
        />
      }
    >
      {children}
    </SupportShell>
  );
}
