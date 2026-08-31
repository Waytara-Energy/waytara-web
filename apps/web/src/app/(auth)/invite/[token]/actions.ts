"use server";

import { redirect } from "next/navigation";
import { createClient } from "@waytara/supabase/server";
import { createServiceRoleClient } from "@waytara/supabase/service-role";

export async function acceptCustomerInvite(token: string, formData: FormData) {
  const service = createServiceRoleClient();

  const { data: onboarding, error: lookupError } = await service
    .from("customer_onboarding")
    .select("id, lead_id, invite_token, invite_status")
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

  // Task 9 needs customers.plan_id set for the dashboard's plan-based nav
  // gating to mean anything — look up the accepted quotation for this
  // onboarding's lead and use its plan_id. Most recent accepted one, in
  // case of a re-quote history; falls back to null (Basic-only gating,
  // the safe default) if none is found rather than failing signup over it.
  const { data: acceptedQuotation } = await service
    .from("quotations")
    .select("id, plan_id")
    .eq("lead_id", onboarding.lead_id)
    .eq("status", "accepted")
    .order("accepted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error: customerError } = await service.from("customers").insert({
    id: userId,
    billing_email: email,
    address: addressLine ? { line1: addressLine } : null,
    status: "active",
    plan_id: acceptedQuotation?.plan_id ?? null,
    plan_started_at: acceptedQuotation?.plan_id ? new Date().toISOString() : null,
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

  // Task 9.5's billing history reads payments.customer_id — Task 8.2 never
  // sets it (the account doesn't exist yet at payment time, exactly as the
  // schema's own comment on the column anticipates). Backfill it now that
  // it does.
  if (acceptedQuotation?.id) {
    await service
      .from("payments")
      .update({ customer_id: userId })
      .eq("quotation_id", acceptedQuotation.id);
  }

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

  if (signInError) {
    redirect("/login");
  }

  redirect("/dashboard");
}
