import { notFound } from "next/navigation";
import { getCurrentProfile } from "@waytara/supabase/auth";
import { createClient } from "@waytara/supabase/server";
import { SupportThread } from "@/components/dashboard/support-thread";

export default async function SupportTicketPage({
  params,
}: {
  params: Promise<{ ticketId: string }>;
}) {
  const { ticketId } = await params;
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  // RLS scopes this to a ticket the signed-in customer actually owns —
  // .maybeSingle() comes back null for someone else's ticket id just as it
  // would for a nonexistent one, so both cases correctly 404 the same way.
  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("id, subject, status")
    .eq("id", ticketId)
    .maybeSingle();

  if (!ticket) notFound();

  const { data: messages } = await supabase
    .from("support_messages")
    .select("id, sender_id, sender_role, body, attachment_path, created_at")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });

  return (
    <div className="flex h-[75vh] min-h-[420px] max-w-2xl flex-col">
      <SupportThread ticket={ticket} initialMessages={messages ?? []} currentUserId={profile?.id ?? ""} />
    </div>
  );
}
