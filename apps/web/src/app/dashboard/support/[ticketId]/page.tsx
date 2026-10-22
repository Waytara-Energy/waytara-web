import { notFound } from "next/navigation";
import { createClient } from "@waytara/supabase/server";
import type { AttachmentView, MessageView, TicketView } from "@waytara/ui/support-model";
import { getRequestProfile } from "@/lib/request-profile";
import { deviceDisplayId, getCustomerSites } from "@/lib/selected-site";
import { SupportConversation } from "@/components/dashboard/support-conversation";

export default async function SupportTicketPage({ params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = await params;
  const profile = await getRequestProfile();
  const supabase = await createClient();

  // RLS scopes this to a ticket the signed-in customer owns: someone else's ticket id and a made-up one both come back empty, and both 404.
  const { data: ticket } = await supabase.from("support_tickets").select("*").eq("id", ticketId).maybeSingle();
  if (!ticket) notFound();

  const [{ data: messages }, { data: attachments }, sites] = await Promise.all([
    supabase.from("support_messages").select("*").eq("ticket_id", ticketId).order("created_at", { ascending: true }),
    supabase.from("support_attachments").select("*").eq("ticket_id", ticketId).order("created_at", { ascending: true }),
    getCustomerSites(),
  ]);
  const site = sites.find((s) => s.id === ticket.site_id);
  const device = site?.devices.find((d) => d.id === ticket.equipment_id);

  return (
    <SupportConversation
      initialTicket={ticket as unknown as TicketView}
      initialMessages={(messages ?? []) as unknown as MessageView[]}
      initialAttachments={(attachments ?? []) as unknown as AttachmentView[]}
      ownId={profile?.id ?? ""}
      siteName={site?.name ?? null}
      deviceName={device ? deviceDisplayId(device) : null}
    />
  );
}
