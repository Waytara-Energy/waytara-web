"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@waytara/supabase/server";
import { getCurrentProfile } from "@waytara/supabase/auth";

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// Task 12.1: alerts_owner_update scopes this to the customer's own
// devices — nothing extra to check here beyond having a session at all.
export async function acknowledgeAlert(alertId: string) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  await supabase
    .from("alerts")
    .update({ acknowledged_at: new Date().toISOString(), acknowledged_by: profile.id })
    .eq("id", alertId);

  revalidatePath("/dashboard");
}
