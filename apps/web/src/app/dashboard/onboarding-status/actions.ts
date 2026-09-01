"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@waytara/supabase/server";
import { getCurrentProfile } from "@waytara/supabase/auth";

// Onboarding pipeline redesign, Phase 5: payment now happens after the
// customer already has an account and is signed in — mirrors apps/admin's
// recordFullPayment/recordSplitPayment payments-insert shape exactly, but
// runs under the customer's own RLS-scoped session (payments_customer_
// insert_own) instead of an employee's. The payment_option — and, for a
// split, the exact advance/balance amounts — were already locked in when
// the customer accepted their quote (Phase 4's submitQuoteAccept); these
// actions never let them re-choose or edit those numbers.
//
// Payment collection is SIMULATED — no real Razorpay integration yet,
// matching every other payment step in this pipeline. Swap the insert
// below for real order-creation + webhook-verified capture later; the
// RLS policy and stage advancement are already the real thing.

async function loadOwnOnboarding(customerId: string) {
  const supabase = await createClient();
  const { data: onboarding } = await supabase
    .from("customer_onboarding")
    .select("id, quotation_id, current_stage")
    .eq("customer_id", customerId)
    .maybeSingle();
  return { supabase, onboarding };
}

export async function payFullAmount() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const { supabase, onboarding } = await loadOwnOnboarding(profile.id);
  if (!onboarding || onboarding.current_stage !== "payment_pending" || !onboarding.quotation_id) {
    redirect(
      `/dashboard/onboarding-status?error=${encodeURIComponent("No payment is due right now.")}`
    );
  }

  const { data: quotation } = await supabase
    .from("quotations")
    .select("id, total_amount, payment_option")
    .eq("id", onboarding.quotation_id)
    .single();

  if (!quotation || quotation.payment_option !== "full") {
    redirect(
      `/dashboard/onboarding-status?error=${encodeURIComponent("This quote isn't set up for a full payment.")}`
    );
  }

  const { error } = await supabase.from("payments").insert({
    quotation_id: quotation.id,
    customer_id: profile.id,
    payment_type: "full",
    amount: quotation.total_amount,
    status: "paid",
    gateway: "simulated",
    paid_at: new Date().toISOString(),
  });

  if (error) {
    redirect(`/dashboard/onboarding-status?error=${encodeURIComponent(error.message)}`);
  }

  await supabase.from("customer_onboarding").update({ current_stage: "site_setup" }).eq("id", onboarding.id);

  revalidatePath("/dashboard/onboarding-status");
  redirect("/dashboard/onboarding-status");
}

export async function payAdvanceAmount() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const { supabase, onboarding } = await loadOwnOnboarding(profile.id);
  if (!onboarding || onboarding.current_stage !== "payment_pending" || !onboarding.quotation_id) {
    redirect(
      `/dashboard/onboarding-status?error=${encodeURIComponent("No payment is due right now.")}`
    );
  }

  const { data: quotation } = await supabase
    .from("quotations")
    .select("id, payment_option, advance_amount, balance_amount")
    .eq("id", onboarding.quotation_id)
    .single();

  if (
    !quotation ||
    quotation.payment_option !== "split" ||
    quotation.advance_amount == null ||
    quotation.balance_amount == null
  ) {
    redirect(
      `/dashboard/onboarding-status?error=${encodeURIComponent("This quote isn't set up for a split payment.")}`
    );
  }

  const { error } = await supabase.from("payments").insert([
    {
      quotation_id: quotation.id,
      customer_id: profile.id,
      payment_type: "advance",
      amount: quotation.advance_amount,
      status: "paid",
      gateway: "simulated",
      paid_at: new Date().toISOString(),
    },
    {
      quotation_id: quotation.id,
      customer_id: profile.id,
      payment_type: "balance",
      amount: quotation.balance_amount,
      status: "pending",
      gateway: "simulated",
    },
  ]);

  if (error) {
    redirect(`/dashboard/onboarding-status?error=${encodeURIComponent(error.message)}`);
  }

  await supabase
    .from("customer_onboarding")
    .update({ balance_payment_status: "pending", current_stage: "site_setup" })
    .eq("id", onboarding.id);

  revalidatePath("/dashboard/onboarding-status");
  redirect("/dashboard/onboarding-status");
}
