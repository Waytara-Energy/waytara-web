"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@waytara/supabase/server";
import { getCurrentProfile } from "@waytara/supabase/auth";

/** `${ticketId}/${Date.now()}-${originalName}` — the timestamp keeps two
 *  same-named uploads from colliding; stripped back off for display by
 *  `attachmentFileName` in support-thread.tsx / new-support-ticket-dialog.tsx. */
function attachmentPathFor(ticketId: string, file: File): string {
  return `${ticketId}/${Date.now()}-${file.name}`;
}

export async function createSupportTicket(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const subject = String(formData.get("subject") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  const attachment = formData.get("attachment");

  if (!subject || !message) {
    redirect(
      `/dashboard/support?error=${encodeURIComponent("A subject and a first message are required.")}`
    );
  }

  const supabase = await createClient();

  const { data: ticket, error: ticketError } = await supabase
    .from("support_tickets")
    .insert({ customer_id: profile.id, subject })
    .select("id")
    .single();

  if (ticketError || !ticket) {
    redirect(
      `/dashboard/support?error=${encodeURIComponent(ticketError?.message ?? "Couldn't open the ticket.")}`
    );
  }

  let attachmentPath: string | null = null;
  if (attachment instanceof File && attachment.size > 0) {
    const path = attachmentPathFor(ticket.id, attachment);
    const { error: uploadError } = await supabase.storage.from("support-attachments").upload(path, attachment);
    // Non-fatal — the ticket and first message still matter more than the
    // attachment; a failed upload just means the message goes out without it.
    if (!uploadError) attachmentPath = path;
  }

  const { error: messageError } = await supabase.from("support_messages").insert({
    ticket_id: ticket.id,
    sender_id: profile.id,
    sender_role: "customer",
    body: message,
    attachment_path: attachmentPath,
  });

  if (messageError) {
    redirect(`/dashboard/support?error=${encodeURIComponent(messageError.message)}`);
  }

  revalidatePath("/dashboard/support");
  redirect(`/dashboard/support/${ticket.id}`);
}

export async function sendSupportMessage(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const ticketId = String(formData.get("ticketId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const attachment = formData.get("attachment");

  if (!ticketId || !body) {
    redirect(`/dashboard/support/${ticketId}?error=${encodeURIComponent("Write a message before sending.")}`);
  }

  const supabase = await createClient();

  let attachmentPath: string | null = null;
  if (attachment instanceof File && attachment.size > 0) {
    const path = attachmentPathFor(ticketId, attachment);
    const { error: uploadError } = await supabase.storage.from("support-attachments").upload(path, attachment);
    if (uploadError) {
      redirect(`/dashboard/support/${ticketId}?error=${encodeURIComponent(uploadError.message)}`);
    }
    attachmentPath = path;
  }

  const { error } = await supabase.from("support_messages").insert({
    ticket_id: ticketId,
    sender_id: profile.id,
    sender_role: "customer",
    body,
    attachment_path: attachmentPath,
  });

  if (error) {
    redirect(`/dashboard/support/${ticketId}?error=${encodeURIComponent(error.message)}`);
  }

  // Bumps updated_at so the ticket list's "Updated ..." sort reflects new
  // activity, same spirit as any other "touch the parent row" pattern.
  await supabase.from("support_tickets").update({ updated_at: new Date().toISOString() }).eq("id", ticketId);

  revalidatePath(`/dashboard/support/${ticketId}`);
  revalidatePath("/dashboard/support");
}

export async function markTicketResolved(ticketId: string) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const { error } = await supabase
    .from("support_tickets")
    .update({ status: "resolved", updated_at: new Date().toISOString() })
    .eq("id", ticketId);

  if (error) {
    redirect(`/dashboard/support/${ticketId}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/dashboard/support/${ticketId}`);
  revalidatePath("/dashboard/support");
}
