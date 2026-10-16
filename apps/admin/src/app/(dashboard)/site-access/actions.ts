"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@waytara/supabase/server";
import { requireAdmin } from "@waytara/supabase/auth";

// Which employees and site engineers may work on which site (waytara.site_staff). Only an admin changes it; the database enforces that too
// (policy site_staff_admin_all). Removing a person is a soft removal (the row stays, with who removed it and when), so the history of
// who had access when is kept.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const ASSIGNABLE_ROLES = ["employee", "site_engineer"];

/** The end of that day in India time, as a timestamp. */
function endOfDayIst(date: string): string {
  return new Date(`${date}T23:59:59+05:30`).toISOString();
}

export async function assignStaff(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const siteId = String(formData.get("site_id") ?? "");
  const staffId = String(formData.get("staff_id") ?? "");
  const until = String(formData.get("until") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim().slice(0, 200);

  if (!UUID.test(siteId) || !UUID.test(staffId)) throw new Error("Pick a person to add.");
  let expiresAt: string | null = null;
  if (until) {
    if (!DATE.test(until) || Number.isNaN(Date.parse(`${until}T00:00:00+05:30`))) throw new Error("That end date is not a valid date.");
    expiresAt = endOfDayIst(until);
    if (new Date(expiresAt).getTime() <= Date.now()) throw new Error("The end date must be today or later.");
  }

  const supabase = await createClient();
  const { data: person, error: personError } = await supabase.from("profiles").select("id, role, deactivated_at, deleted_at").eq("id", staffId).maybeSingle();
  if (personError) throw new Error(personError.message);
  if (!person || !ASSIGNABLE_ROLES.includes(person.role) || person.deactivated_at || person.deleted_at) {
    throw new Error("Only an active employee or site engineer can be added to a site. (Admins already see every site.)");
  }
  const { data: site } = await supabase.from("sites").select("id").eq("id", siteId).maybeSingle();
  if (!site) throw new Error("That site no longer exists.");

  const { data: live, error: liveError } = await supabase.from("site_staff").select("id, expires_at").eq("site_id", siteId).eq("staff_id", staffId).is("removed_at", null).maybeSingle();
  if (liveError) throw new Error(liveError.message);

  if (live) {
    const stillValid = !live.expires_at || new Date(live.expires_at).getTime() > Date.now();
    if (stillValid) throw new Error("That person is already on this site.");
    // an earlier permission that ran out: give it a new period instead of a second row
    const { error } = await supabase.from("site_staff").update({ expires_at: expiresAt, granted_by: admin.id, granted_at: new Date().toISOString(), note: note || null }).eq("id", live.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("site_staff").insert({ site_id: siteId, staff_id: staffId, granted_by: admin.id, expires_at: expiresAt, note: note || null });
    if (error) throw new Error(error.code === "23505" ? "That person is already on this site." : error.message);
  }
  revalidatePath("/site-access");
}

export async function removeStaff(assignmentId: string): Promise<void> {
  const admin = await requireAdmin();
  if (!UUID.test(assignmentId)) throw new Error("That assignment was not found.");
  const supabase = await createClient();
  const { error } = await supabase.from("site_staff").update({ removed_at: new Date().toISOString(), removed_by: admin.id }).eq("id", assignmentId).is("removed_at", null);
  if (error) throw new Error(error.message);
  revalidatePath("/site-access");
}
