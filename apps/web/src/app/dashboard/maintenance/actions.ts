"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@waytara/supabase/server";
import { getCurrentProfile } from "@waytara/supabase/auth";
import { getSelectedDevice } from "@/lib/selected-device";

// Device-centric redesign: no more a customer-picked "siteId" field — the
// ticket attaches to whichever device is currently selected (resolved
// server-side via the same cookie every other device-scoped page reads,
// not trusted from the form), and its site is derived from that device
// rather than typed in.
export async function createMaintenanceTicket(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const description = String(formData.get("description") ?? "").trim();
  if (!description) {
    redirect(`/dashboard/maintenance?error=${encodeURIComponent("Describe the issue before submitting.")}`);
  }

  const device = await getSelectedDevice();
  if (!device) {
    redirect(`/dashboard/maintenance?error=${encodeURIComponent("Select a device before submitting.")}`);
  }
  if (!device.site) {
    redirect(`/dashboard/maintenance?error=${encodeURIComponent("This device isn't attached to a site yet.")}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.from("maintenance_tickets").insert({
    customer_id: profile.id,
    site_id: device.site.id,
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
