"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@waytara/supabase/server";
import { getCurrentProfile, requireStaff } from "@waytara/supabase/auth";

export async function assignLead(leadId: string, formData: FormData): Promise<void> {
  await requireStaff();
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") {
    // RLS (leads_admin_update) would block this anyway — this is just a
    // friendlier failure than a raw permission-denied from Postgres.
    redirect("/unauthorized");
  }

  const employeeId = String(formData.get("employeeId") ?? "");
  if (!employeeId) throw new Error("Select an employee to assign.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("leads")
    .update({ assigned_to: employeeId, status: "assigned" })
    .eq("id", leadId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
}

// Phase 2 of the onboarding pipeline redesign: an explicit "I'm working
// this" marker from the employee, distinct from merely being assigned
// (an admin action the employee didn't necessarily see yet). Gates
// startOnboarding below — see canStartOnboarding on the detail page.
export async function acceptLeadAssignment(leadId: string): Promise<void> {
  const profile = await requireStaff();

  const supabase = await createClient();
  const { data: lead } = await supabase.from("leads").select("assigned_to").eq("id", leadId).single();
  if (lead?.assigned_to !== profile.id) {
    throw new Error("Only the assigned employee can accept this lead.");
  }

  const { error } = await supabase.from("leads").update({ accepted_at: new Date().toISOString() }).eq("id", leadId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
}

export async function startOnboarding(leadId: string): Promise<void> {
  const profile = await requireStaff();

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
    throw new Error(error.message);
  }

  // Task 8 (the pipeline UI) doesn't exist yet — the lead detail page
  // itself now shows the onboarding row that was just created, via its
  // own revalidatePath below (no separate pipeline page to redirect to).
  revalidatePath(`/leads/${leadId}`);
}
