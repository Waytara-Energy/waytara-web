"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@waytara/supabase/server";
import { getCurrentProfile } from "@waytara/supabase/auth";

export async function updateProfile(formData: FormData): Promise<void> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const fullName = String(formData.get("fullName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const emailAlerts = formData.get("emailAlerts") === "on";
  const emailMaintenanceUpdates = formData.get("emailMaintenanceUpdates") === "on";

  if (!fullName) {
    throw new Error("Name can't be empty.");
  }

  const supabase = await createClient();
  // Only the columns granted to `authenticated` in the self-update policy
  // (full_name, phone, avatar_url, notification_preferences) can actually
  // change here — role/email are enforced server-side via a column-level
  // GRANT restriction, not just app-layer omission.
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      phone,
      notification_preferences: {
        email_alerts: emailAlerts,
        email_maintenance_updates: emailMaintenanceUpdates,
      },
    })
    .eq("id", profile.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/dashboard/settings");
}
