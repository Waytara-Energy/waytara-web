"use server";

import { redirect } from "next/navigation";
import { createClient } from "@waytara/supabase/server";
import { createServiceRoleClient } from "@waytara/supabase/service-role";

export async function acceptEmployeeInvite(token: string, formData: FormData) {
  const service = createServiceRoleClient();

  const { data: invite, error: lookupError } = await service
    .from("employee_invites")
    .select("id, email, role, status, expires_at")
    .eq("token", token)
    .maybeSingle();

  const expired = !!invite && new Date(invite.expires_at).getTime() < Date.now();

  if (lookupError || !invite || invite.status !== "pending" || expired) {
    redirect(
      `/invite/${token}?error=${encodeURIComponent("This invite link is invalid, expired, or has already been used.")}`
    );
  }

  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim() || null;

  if (!password || !fullName) {
    redirect(
      `/invite/${token}?error=${encodeURIComponent("Name and password are required.")}`
    );
  }

  const { data: created, error: createError } = await service.auth.admin.createUser({
    email: invite.email,
    password,
    email_confirm: true,
  });

  if (createError || !created.user) {
    redirect(
      `/invite/${token}?error=${encodeURIComponent(createError?.message ?? "Couldn't create your account.")}`
    );
  }

  const userId = created.user.id;

  const { error: profileError } = await service.from("profiles").insert({
    id: userId,
    email: invite.email,
    full_name: fullName,
    phone,
    role: invite.role,
  });

  if (profileError) {
    redirect(
      `/invite/${token}?error=${encodeURIComponent("Account created but profile setup failed: " + profileError.message)}`
    );
  }

  await service
    .from("employee_invites")
    .update({ status: "accepted", accepted_at: new Date().toISOString() })
    .eq("id", invite.id);

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: invite.email,
    password,
  });

  if (signInError) {
    redirect("/login");
  }

  redirect("/dashboard");
}
