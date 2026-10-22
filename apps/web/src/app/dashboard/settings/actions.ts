"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@waytara/supabase/server";
import { requireCustomer } from "@waytara/supabase/auth";

export async function updateProfile(formData: FormData): Promise<void> {
  const profile = await requireCustomer();

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

// ---- signed-in devices ------------------------------------------------------------------------------------------------------------------

/** Ends the sessions on every other device and keeps this one (Supabase's "others" scope). */
export async function signOutOtherDevices(): Promise<void> {
  await requireCustomer();
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "others" });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/settings");
}

/** Ends every session, this device included (the caller then goes to the sign-in page). */
export async function signOutAllDevices(): Promise<void> {
  await requireCustomer();
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "global" });
  if (error) throw new Error(error.message);
}

/** Ends one other device's session (the database function only ever touches the caller's own). */
export async function revokeSession(sessionId: string): Promise<void> {
  await requireCustomer();
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_my_session", { p_id: sessionId });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/settings");
}
