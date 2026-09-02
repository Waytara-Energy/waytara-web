"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@waytara/supabase/server";
import { getCurrentProfile } from "@waytara/supabase/auth";
import { SELECTED_DEVICE_COOKIE } from "@/lib/selected-device";

// Called directly from the header's DeviceSwitcher (a client component),
// not via a <form action>. No ownership check on `deviceId` here — the
// cookie is a UI preference, not an authorization boundary; every
// device-scoped query still goes through RLS regardless of what this
// cookie says, so a tampered/foreign id just fails to resolve to anything
// in resolveSelectedDevice() rather than granting access.
export async function selectDevice(deviceId: string) {
  const cookieStore = await cookies();
  cookieStore.set(SELECTED_DEVICE_COOKIE, deviceId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath("/dashboard", "layout");
}

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
