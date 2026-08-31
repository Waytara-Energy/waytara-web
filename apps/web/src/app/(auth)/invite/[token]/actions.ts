"use server";

import { redirect } from "next/navigation";
import { createClient } from "@waytara/supabase/server";
import { createServiceRoleClient } from "@waytara/supabase/service-role";

export async function acceptCustomerInvite(token: string, formData: FormData) {
  const service = createServiceRoleClient();

  const { data: onboarding, error: lookupError } = await service
    .from("customer_onboarding")
    .select("id, invite_token, invite_status")
    .eq("invite_token", token)
    .maybeSingle();

  if (lookupError || !onboarding || onboarding.invite_status !== "pending") {
    redirect(`/invite/${token}?error=${encodeURIComponent("This invite link is invalid or has already been used.")}`);
  }

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const addressLine = String(formData.get("address") ?? "").trim() || null;

  if (!email || !password || !fullName) {
    redirect(
      `/invite/${token}?error=${encodeURIComponent("Name, email, and password are required.")}`
    );
  }

  const { data: created, error: createError } = await service.auth.admin.createUser({
    email,
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
    email,
    full_name: fullName,
    phone,
    role: "customer",
  });

  if (profileError) {
    redirect(
      `/invite/${token}?error=${encodeURIComponent("Account created but profile setup failed: " + profileError.message)}`
    );
  }

  // plan_id / plan_started_at intentionally left unset — not enough context
  // here (customer_onboarding has no direct plan reference) to derive them
  // safely. Whoever builds the real onboarding business logic should backfill
  // these once a plan is assigned.
  const { error: customerError } = await service.from("customers").insert({
    id: userId,
    billing_email: email,
    address: addressLine ? { line1: addressLine } : null,
    status: "active",
  });

  if (customerError) {
    redirect(
      `/invite/${token}?error=${encodeURIComponent("Account created but customer setup failed: " + customerError.message)}`
    );
  }

  await service
    .from("customer_onboarding")
    .update({
      customer_id: userId,
      invite_status: "accepted",
      current_stage: "account_created",
      updated_at: new Date().toISOString(),
    })
    .eq("id", onboarding.id);

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

  if (signInError) {
    redirect("/login");
  }

  redirect("/dashboard");
}
