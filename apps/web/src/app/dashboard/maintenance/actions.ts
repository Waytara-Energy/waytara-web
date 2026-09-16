"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@waytara/supabase/server";
import { getCurrentProfile } from "@waytara/supabase/auth";
import { getCustomerSites } from "@/lib/selected-site";

// A site can have more than one device now, so there's no single
// cookie-resolved "current device" to trust — deviceId/siteId come bound
// from the dialog's own form action (which knows exactly which device the
// customer had open), and are checked against this customer's own
// sites/devices (RLS-scoped) before the insert, the same
// don't-trust-the-client reasoning every other id-bearing action here
// already follows.
export async function createMaintenanceTicket(deviceId: string, siteId: string, formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const description = String(formData.get("description") ?? "").trim();
  if (!description) {
    redirect(`/dashboard/maintenance?error=${encodeURIComponent("Describe the issue before submitting.")}`);
  }

  const sites = await getCustomerSites();
  const site = sites.find((s) => s.id === siteId);
  const device = site?.devices.find((d) => d.id === deviceId);
  if (!site || !device) {
    redirect(`/dashboard/maintenance?error=${encodeURIComponent("Select a device before submitting.")}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.from("maintenance_tickets").insert({
    customer_id: profile.id,
    site_id: site.id,
    device_id: device.id,
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
