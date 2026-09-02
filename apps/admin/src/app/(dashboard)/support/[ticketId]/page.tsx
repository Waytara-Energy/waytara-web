import { notFound } from "next/navigation";
import { getCurrentProfile } from "@waytara/supabase/auth";
import { createClient } from "@waytara/supabase/server";
import { SupportThread } from "@/components/support-thread";

export default async function SupportTicketPage({
  params,
}: {
  params: Promise<{ ticketId: string }>;
}) {
  const { ticketId } = await params;
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  // RLS scopes this to a ticket the signed-in staff member can actually
  // see — admin sees any, an employee only one for a customer assigned to
  // them via customer_onboarding.employee_id. An unassigned employee gets
  // null back here just like a nonexistent ticket id would, and both
  // correctly 404 the same way rather than leaking that the ticket exists.
  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("id, subject, status, customer_id")
    .eq("id", ticketId)
    .maybeSingle();

  if (!ticket) notFound();

  // Not a `customers -> profiles` join — see support/page.tsx's comment:
  // profiles_self_or_admin RLS blocks an employee from reading an
  // arbitrary customer's profile row, so the customer's display name comes
  // from customer_onboarding -> leads instead, which the assigned employee
  // can actually read.
  let customerName = "Customer";
  const { data: onboarding } = await supabase
    .from("customer_onboarding")
    .select("lead_id")
    .eq("customer_id", ticket.customer_id)
    .maybeSingle();
  if (onboarding) {
    const { data: lead } = await supabase.from("leads").select("full_name, email").eq("id", onboarding.lead_id).maybeSingle();
    if (lead) customerName = lead.full_name || lead.email;
  }

  const { data: messages } = await supabase
    .from("support_messages")
    .select("id, sender_id, sender_role, body, attachment_path, created_at")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });

  return (
    <SupportThread
      ticket={{ id: ticket.id, subject: ticket.subject, status: ticket.status, customerName }}
      initialMessages={messages ?? []}
      currentUserId={profile?.id ?? ""}
    />
  );
}
