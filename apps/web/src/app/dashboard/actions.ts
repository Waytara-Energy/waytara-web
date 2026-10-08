"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@waytara/supabase/server";
import { requireCustomer } from "@waytara/supabase/auth";
import { SELECTED_SITE_COOKIE, SELECTED_DEVICE_COOKIE } from "@/lib/selected-site";

// Called directly from the header's SiteSwitcher (a client component), not
// via a <form action>. No ownership check on `siteId` here — the cookie is
// a UI preference, not an authorization boundary; every site-scoped query
// still goes through RLS regardless of what this cookie says, so a
// tampered/foreign id just fails to resolve to anything in
// resolveSelectedSite() rather than granting access.
export async function selectSite(siteId: string) {
  const cookieStore = await cookies();
  cookieStore.set(SELECTED_SITE_COOKIE, siteId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath("/dashboard", "layout");
}

// Called directly from DeviceSwitcher (a client component) right before it
// navigates — same "UI preference, not an authorization boundary" reasoning
// as selectSite above, and the same reason there's no ownership check on
// `deviceId` here: resolveDeviceInSite re-validates it against the
// requesting customer's own (RLS-scoped) site before ever using it, so a
// tampered/foreign id just fails to resolve rather than granting access.
export async function selectDevice(deviceId: string) {
  const cookieStore = await cookies();
  cookieStore.set(SELECTED_DEVICE_COOKIE, deviceId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// Task 12.1: alerts_owner_update scopes this to the customer's own
// devices — nothing extra to check here beyond having a session at all.
export async function acknowledgeAlert(alertId: string) {
  const profile = await requireCustomer();

  const supabase = await createClient();
  await supabase
    .from("alerts")
    .update({ acknowledged_at: new Date().toISOString(), acknowledged_by: profile.id })
    .eq("id", alertId);

  revalidatePath("/dashboard");
}

/** Marks every one of these alerts as read (the notification panel's "Mark all read"). The same row-level policy as above limits
 *  it to the customer's own devices; only alerts still unread are touched. */
export async function acknowledgeAllAlerts(alertIds: string[]) {
  const profile = await requireCustomer();
  const ids = [...new Set(alertIds.filter((id) => typeof id === "string" && id.length > 0))].slice(0, 200);
  if (ids.length === 0) return;

  const supabase = await createClient();
  await supabase
    .from("alerts")
    .update({ acknowledged_at: new Date().toISOString(), acknowledged_by: profile.id })
    .in("id", ids)
    .is("acknowledged_at", null);

  revalidatePath("/dashboard");
}
