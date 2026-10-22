import { notFound } from "next/navigation";
import { getCurrentProfile } from "@waytara/supabase/auth";
import { createClient } from "@waytara/supabase/server";
import type { AttachmentView, MessageView, TicketView } from "@waytara/ui/support-model";
import { SupportDesk } from "@/components/support-desk";

export default async function SupportTicketPage({ params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = await params;
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  // The row-level rules scope this to a ticket the signed-in person may work on (an admin: any; staff: the sites they are assigned to). A
  // ticket they may not see comes back empty, like one that does not exist, and both 404.
  const { data: ticket } = await supabase.from("support_tickets").select("*").eq("id", ticketId).maybeSingle();
  if (!ticket) notFound();

  const [{ data: messages }, { data: attachments }, device] = await Promise.all([
    supabase.from("support_messages").select("*").eq("ticket_id", ticketId).order("created_at", { ascending: true }),
    supabase.from("support_attachments").select("*").eq("ticket_id", ticketId).order("created_at", { ascending: true }),
    ticket.equipment_id ? supabase.from("equipment").select("label, device_type:equipment_inventory(name, model_number)").eq("id", ticket.equipment_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const deviceName = device.data ? (device.data.label ?? device.data.device_type?.name ?? device.data.device_type?.model_number ?? null) : null;

  return (
    <SupportDesk
      initialTicket={ticket as unknown as TicketView}
      initialMessages={(messages ?? []) as unknown as MessageView[]}
      initialAttachments={(attachments ?? []) as unknown as AttachmentView[]}
      meId={profile?.id ?? ""}
      deviceName={deviceName}
    />
  );
}
