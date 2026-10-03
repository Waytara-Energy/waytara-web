"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@waytara/supabase/server";
import { requireStaff } from "@waytara/supabase/auth";

/** Same naming convention as apps/web's identically-named helper in
 *  dashboard/support/actions.ts — `<ticketId>/<timestamp>-<name>`. */
function attachmentPathFor(ticketId: string, file: File): string {
  return `${ticketId}/${Date.now()}-${file.name}`;
}

export async function sendSupportReply(formData: FormData): Promise<void> {
  const profile = await requireStaff();

  const ticketId = String(formData.get("ticketId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const attachment = formData.get("attachment");

  if (!ticketId || !body) {
    throw new Error("Write a reply before sending.");
  }

  const supabase = await createClient();

  let attachmentPath: string | null = null;
  if (attachment instanceof File && attachment.size > 0) {
    const path = attachmentPathFor(ticketId, attachment);
    const { error: uploadError } = await supabase.storage.from("support-attachments").upload(path, attachment);
    if (uploadError) {
      throw new Error(uploadError.message);
    }
    attachmentPath = path;
  }

  // sender_role reflects the actual signed-in role — support_messages'
  // check constraint only allows customer/employee/admin, and RLS already
  // guarantees this insert only succeeds if this staff member is either
  // admin or assigned to the ticket's customer, so there's nothing more to
  // authorize here beyond picking the right label.
  const { error } = await supabase.from("support_messages").insert({
    ticket_id: ticketId,
    sender_id: profile.id,
    sender_role: profile.role === "admin" ? "admin" : "employee",
    body,
    attachment_path: attachmentPath,
  });

  if (error) {
    throw new Error(error.message);
  }

  await supabase.from("support_tickets").update({ updated_at: new Date().toISOString() }).eq("id", ticketId);

  revalidatePath(`/support/${ticketId}`);
  revalidatePath("/support");
}

export async function updateTicketStatus(ticketId: string, status: string): Promise<void> {
  await requireStaff();

  const supabase = await createClient();
  const { error } = await supabase
    .from("support_tickets")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", ticketId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/support/${ticketId}`);
  revalidatePath("/support");
}
