"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@waytara/supabase/server";
import { getCurrentProfile, requireStaff } from "@waytara/supabase/auth";
import { accessExpiry, newAccessToken } from "@waytara/supabase/partner-access";
import { sendPartnerLinkEmail } from "@/lib/send-partner-link-email";
import { isPartnerStatus } from "@/lib/partners";

/** Sets an application's status, notes and the note the applicant sees, and records who did it and when. Admin only (the row-level rules enforce it too). */
export async function reviewPartnerApplication(id: string, formData: FormData): Promise<void> {
  await requireStaff();
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") redirect("/unauthorized");

  const status = String(formData.get("status") ?? "");
  if (!isPartnerStatus(status)) throw new Error("Choose a status.");
  const notes = String(formData.get("adminNotes") ?? "").trim();
  if (notes.length > 5000) throw new Error("The notes are too long (5000 characters at most).");
  const message = String(formData.get("statusMessage") ?? "").trim();
  if (message.length > 600) throw new Error("The note for the applicant is too long (600 characters at most).");

  const supabase = await createClient();
  // The note's date is when it was last changed, so an unchanged note keeps its date.
  const { data: before } = await supabase.from("partner_applications").select("status_message, status_message_at").eq("id", id).single();
  const messageChanged = (before?.status_message ?? "") !== message;

  const { error } = await supabase
    .from("partner_applications")
    .update({
      status,
      admin_notes: notes === "" ? null : notes,
      reviewed_by: profile.id,
      reviewed_at: new Date().toISOString(),
      // Shown in the public partner directory only while approved, and only when the box is ticked.
      listed_publicly: status === "approved" && formData.get("listedPublicly") === "on",
      status_message: message === "" ? null : message,
      status_message_at: message === "" ? null : messageChanged ? new Date().toISOString() : (before?.status_message_at ?? new Date().toISOString()),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath(`/partners/${id}`);
  revalidatePath("/partners");
}

/**
 * Sends the applicant a new private tracking link. The old one stops working at once (only the new code's hash is kept), which is also how a link that has leaked is
 * closed. Admin only.
 */
export async function resendPartnerTrackingLink(id: string): Promise<void> {
  await requireStaff();
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") redirect("/unauthorized");

  const supabase = await createClient();
  const { data: app, error: readError } = await supabase.from("partner_applications").select("contact_name, email, reference").eq("id", id).single();
  if (readError || !app) throw new Error("Couldn't find this application.");

  const access = newAccessToken();
  const { error } = await supabase.from("partner_applications").update({ access_token_hash: access.hash, access_expires_at: accessExpiry() }).eq("id", id);
  if (error) throw new Error(error.message);

  await sendPartnerLinkEmail({ to: app.email, contactName: app.contact_name, reference: app.reference, token: access.token });
  revalidatePath(`/partners/${id}`);
}
