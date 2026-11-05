"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@waytara/supabase/server";
import { getCurrentProfile, requireStaff } from "@waytara/supabase/auth";
import { isPartnerStatus } from "@/lib/partners";

/** Sets an application's status and notes, and records who did it and when. Admin only (the row-level rules enforce it too). */
export async function reviewPartnerApplication(id: string, formData: FormData): Promise<void> {
  await requireStaff();
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") redirect("/unauthorized");

  const status = String(formData.get("status") ?? "");
  if (!isPartnerStatus(status)) throw new Error("Choose a status.");
  const notes = String(formData.get("adminNotes") ?? "").trim();
  if (notes.length > 5000) throw new Error("The notes are too long (5000 characters at most).");

  const supabase = await createClient();
  const { error } = await supabase
    .from("partner_applications")
    .update({ status, admin_notes: notes === "" ? null : notes, reviewed_by: profile.id, reviewed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath(`/partners/${id}`);
  revalidatePath("/partners");
}
