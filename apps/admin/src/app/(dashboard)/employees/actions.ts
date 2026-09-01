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

// Revoke/restore/permanent-delete — same "remove from org, don't erase
// history" pattern GitHub/Vercel/Supabase use for team members. profiles.id
// IS auth.users.id (the FK is ON DELETE CASCADE and profiles.id is its own
// primary key), so there is no way to delete the auth account and keep the
// profiles row — every leads.assigned_to / quotations.employee_id /
// audit_log.actor_id reference would go with it. Instead: ban sign-in via
// the Auth admin API (blocks it at the identity-provider level — a new
// sign-in or session refresh fails outright) and mark it on the profile
// itself so getCurrentProfile() treats it as "no session" everywhere,
// closing the window before an already-issued token would naturally expire.
const PERMANENT_BAN = "876000h"; // ~100 years — Supabase has no literal "forever"

export async function revokeEmployeeAccess(profileId: string) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profileId === profile.id) {
    redirect(`/employees?error=${encodeURIComponent("You can't revoke your own access.")}`);
  }

  const service = createServiceRoleClient();
  const { error: banError } = await service.auth.admin.updateUserById(profileId, { ban_duration: PERMANENT_BAN });
  if (banError) {
    redirect(`/employees?error=${encodeURIComponent(banError.message)}`);
  }

  const { error } = await service.from("profiles").update({ deactivated_at: new Date().toISOString() }).eq("id", profileId);
  if (error) {
    redirect(`/employees?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/employees");
  redirect("/employees?success=revoked-access");
}

export async function restoreEmployeeAccess(profileId: string) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const service = createServiceRoleClient();

  // A permanently-deleted (ghosted) account can't be restored — that's
  // the whole point of "permanent". Check before touching the ban.
  const { data: target } = await service.from("profiles").select("deleted_at").eq("id", profileId).maybeSingle();
  if (target?.deleted_at) {
    redirect(`/employees?error=${encodeURIComponent("This account was permanently deleted and can't be restored.")}`);
  }

  const { error: banError } = await service.auth.admin.updateUserById(profileId, { ban_duration: "none" });
  if (banError) {
    redirect(`/employees?error=${encodeURIComponent(banError.message)}`);
  }

  const { error } = await service.from("profiles").update({ deactivated_at: null }).eq("id", profileId);
  if (error) {
    redirect(`/employees?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/employees");
  redirect("/employees?success=restored-access");
}

// Irreversible. displayName is the admin's choice at delete time — left as
// their real name (pre-filled in the confirm UI) so every historical
// record stays easy to trace, or replaced with something generic/anonymous
// if that's what the admin wants instead. Either way it becomes this row's
// permanent full_name, and every reference to this profile keeps resolving
// to it. Email is scrubbed so the real address is free to be invited again
// as a genuinely new account later.
export async function permanentlyDeleteEmployee(profileId: string, formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profileId === profile.id) {
    redirect(`/employees?error=${encodeURIComponent("You can't delete your own account.")}`);
  }

  const displayName = String(formData.get("displayName") ?? "").trim();
  if (!displayName) {
    redirect(`/employees?error=${encodeURIComponent("Enter a name to keep on their historical records.")}`);
  }

  const service = createServiceRoleClient();
  const { error: banError } = await service.auth.admin.updateUserById(profileId, { ban_duration: PERMANENT_BAN });
  if (banError) {
    redirect(`/employees?error=${encodeURIComponent(banError.message)}`);
  }

  const now = new Date().toISOString();
  const ghostEmail = `deleted-${profileId}@removed.waytaraenergy.internal`;
  const { error } = await service
    .from("profiles")
    .update({ full_name: displayName, email: ghostEmail, deactivated_at: now, deleted_at: now })
    .eq("id", profileId);

  if (error) {
    redirect(`/employees?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/employees");
  redirect("/employees?success=deleted");
}
