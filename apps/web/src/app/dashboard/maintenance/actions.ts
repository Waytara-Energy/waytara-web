"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@waytara/supabase/server";
import { getCurrentProfile } from "@waytara/supabase/auth";

export async function createMaintenanceTicket(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const description = String(formData.get("description") ?? "").trim();
  const siteId = String(formData.get("siteId") ?? "");

  if (!description || !siteId) {
    redirect(
      `/dashboard/maintenance?error=${encodeURIComponent("Pick a site and describe the issue before submitting.")}`
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.from("maintenance_tickets").insert({
    customer_id: profile.id,
    site_id: siteId,
    type: "issue",
    status: "open",
    description,
  });

  if (error) {
    redirect(`/dashboard/maintenance?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/dashboard/maintenance");
  redirect("/dashboard/maintenance");
}
