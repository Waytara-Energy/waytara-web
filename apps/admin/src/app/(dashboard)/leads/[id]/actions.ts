"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@waytara/supabase/server";
import { getCurrentProfile } from "@waytara/supabase/auth";

export async function assignLead(leadId: string, formData: FormData) {
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") {
    // RLS (leads_admin_update) would block this anyway — this is just a
    // friendlier failure than a raw permission-denied from Postgres.
    redirect("/unauthorized");
  }

  const employeeId = String(formData.get("employeeId") ?? "");
  if (!employeeId) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("leads")
    .update({ assigned_to: employeeId, status: "assigned" })
    .eq("id", leadId);

  if (error) {
    console.error("assignLead failed:", error.message);
  }

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
}

export async function startOnboarding(leadId: string) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();

  const { data: lead } = await supabase
    .from("leads")
    .select("assigned_to")
    .eq("id", leadId)
    .single();

  // Matches the onboarding_employee_insert_own_lead RLS policy: an employee
  // can only start onboarding for a lead assigned to them, naming
  // themselves as the employee. Admin can start onboarding for any lead —
  // but still needs *some* employee_id (not null on the table), so default
  // to the lead's own assignee, or fall back to the admin's own id if
  // unassigned.
  const employeeId =
    profile.role === "admin" ? lead?.assigned_to ?? profile.id : profile.id;

  const { error } = await supabase.from("customer_onboarding").insert({
    lead_id: leadId,
    employee_id: employeeId,
    current_stage: "quotation_sent",
  });

  if (error) {
    console.error("startOnboarding failed:", error.message);
    redirect(`/leads/${leadId}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/leads/${leadId}`);
  // Task 8 (the pipeline UI) doesn't exist yet — land back on the lead
  // detail page, which now shows the onboarding row that was just created.
  redirect(`/leads/${leadId}`);
}
