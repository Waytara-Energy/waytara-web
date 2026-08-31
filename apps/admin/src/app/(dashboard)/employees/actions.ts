"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@waytara/supabase/server";
import { createServiceRoleClient } from "@waytara/supabase/service-role";
import { getCurrentProfile } from "@waytara/supabase/auth";
import { sendEmployeeInviteEmail } from "@/lib/send-employee-invite-email";

const INVITE_EXPIRY_DAYS = 7;

export async function sendEmployeeInvite(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "");

  if (!email || (role !== "admin" && role !== "employee")) {
    redirect(`/employees?error=${encodeURIComponent("Enter a valid email and pick a role.")}`);
  }

  const supabase = await createClient();

  const { data: existingProfile } = await supabase.from("profiles").select("id").eq("email", email).maybeSingle();
  if (existingProfile) {
    redirect(`/employees?error=${encodeURIComponent("Someone with that email already has an account.")}`);
  }

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase.from("employee_invites").insert({
    email,
    role: role as "admin" | "employee",
    token,
    invited_by: profile.id,
    expires_at: expiresAt,
  });

  if (error) {
    redirect(`/employees?error=${encodeURIComponent(error.message)}`);
  }

  await sendEmployeeInviteEmail({ to: email, role: role as "admin" | "employee", token });

  revalidatePath("/employees");
  redirect("/employees?success=invited");
}

export async function revokeInvite(inviteId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("employee_invites").update({ status: "revoked" }).eq("id", inviteId);

  if (error) {
    redirect(`/employees?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/employees");
  redirect("/employees?success=revoked");
}

// Uses service_role deliberately, per the note left on the profiles
// self-update migration: profiles has no admin-write RLS policy at all
// (only column-restricted self-update), and re-opening that for "admin
// can update any profile" would also loosen every customer's own
// self-update surface. This is the one legitimate case for bypassing RLS
// outright rather than adding a policy.
export async function changeEmployeeRole(profileId: string, formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  if (profileId === profile.id) {
    redirect(`/employees?error=${encodeURIComponent("You can't change your own role.")}`);
  }

  const newRole = String(formData.get("role") ?? "");
  if (newRole !== "admin" && newRole !== "employee") {
    redirect(`/employees?error=${encodeURIComponent("Invalid role.")}`);
  }

  const service = createServiceRoleClient();
  const { error } = await service.from("profiles").update({ role: newRole }).eq("id", profileId);

  if (error) {
    redirect(`/employees?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/employees");
  redirect("/employees?success=role-updated");
}
