"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@waytara/supabase/server";
import { getCurrentProfile } from "@waytara/supabase/auth";
import type { Json } from "@waytara/supabase";
import { generateQuotationPdf, type PricingLineItem } from "@/lib/quotation-pdf";
import { sendQuotationEmail } from "@/lib/send-quotation-email";
import { sendCustomerInviteEmail } from "@/lib/send-customer-invite-email";

export async function createAndSendQuotation(onboardingId: string, formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const planId = String(formData.get("planId") ?? "");
  let pricingBreakdown: PricingLineItem[] = [];
  try {
    pricingBreakdown = JSON.parse(String(formData.get("pricingBreakdown") ?? "[]"));
  } catch {
    // leave empty — caught by the validation below
  }

  if (!planId || pricingBreakdown.length === 0) {
    redirect(
      `/onboarding/${onboardingId}?error=${encodeURIComponent("Pick a plan and add at least one pricing line.")}`
    );
  }

  const totalAmount = pricingBreakdown.reduce((sum, item) => sum + item.amount, 0);
  const supabase = await createClient();

  const { data: onboarding, error: onboardingError } = await supabase
    .from("customer_onboarding")
    .select("lead_id")
    .eq("id", onboardingId)
    .single();

  if (onboardingError || !onboarding) {
    redirect(
      `/onboarding/${onboardingId}?error=${encodeURIComponent("Couldn't load this onboarding record.")}`
    );
  }

  const [{ data: lead }, { data: plan }] = await Promise.all([
    supabase.from("leads").select("full_name, email, phone").eq("id", onboarding.lead_id).single(),
    supabase.from("plans").select("name").eq("id", planId).single(),
  ]);

  const { data: quotation, error: insertError } = await supabase
    .from("quotations")
    .insert({
      lead_id: onboarding.lead_id,
      employee_id: profile.id,
      plan_id: planId,
      pricing_breakdown: pricingBreakdown as unknown as Json,
      total_amount: totalAmount,
      status: "draft",
    })
    .select()
    .single();

  if (insertError || !quotation) {
    redirect(
      `/onboarding/${onboardingId}?error=${encodeURIComponent(insertError?.message ?? "Couldn't create the quotation.")}`
    );
  }

  const pdfBuffer = await generateQuotationPdf({
    quotationId: quotation.id,
    createdAt: quotation.created_at,
    leadName: lead?.full_name ?? "Customer",
    leadEmail: lead?.email ?? "",
    leadPhone: lead?.phone ?? null,
    planName: plan?.name ?? "—",
    pricingBreakdown,
    totalAmount,
    currency: quotation.currency,
    validUntil: quotation.valid_until,
  });

  const filePath = `${quotation.id}.pdf`;
  const { error: uploadError } = await supabase.storage
    .from("quotation-pdfs")
    .upload(filePath, pdfBuffer, { contentType: "application/pdf", upsert: true });

  if (uploadError) {
    redirect(
      `/onboarding/${onboardingId}?error=${encodeURIComponent("Quotation saved but PDF upload failed: " + uploadError.message)}`
    );
  }

  const {
    data: { publicUrl: pdfUrl },
  } = supabase.storage.from("quotation-pdfs").getPublicUrl(filePath);

  await supabase
    .from("quotations")
    .update({ status: "sent", sent_at: new Date().toISOString(), pdf_url: pdfUrl })
    .eq("id", quotation.id);

  if (lead?.email) {
    await sendQuotationEmail({
      to: lead.email,
      leadName: lead.full_name ?? "Customer",
      totalAmount,
      currency: quotation.currency,
      planName: plan?.name ?? "—",
      pdfUrl,
      pdfBuffer,
    });
  }

  await supabase.from("leads").update({ status: "quoted" }).eq("id", onboarding.lead_id);

  revalidatePath(`/onboarding/${onboardingId}`);
  redirect(`/onboarding/${onboardingId}`);
}

export async function recordQuotationAccepted(quotationId: string, onboardingId: string) {
  const supabase = await createClient();

  const { data: onboarding } = await supabase
    .from("customer_onboarding")
    .select("lead_id")
    .eq("id", onboardingId)
    .single();

  await supabase
    .from("quotations")
    .update({ status: "accepted", accepted_at: new Date().toISOString() })
    .eq("id", quotationId);

  await supabase
    .from("customer_onboarding")
    .update({ current_stage: "payment_pending" })
    .eq("id", onboardingId);

  if (onboarding?.lead_id) {
    await supabase.from("leads").update({ status: "converted" }).eq("id", onboarding.lead_id);
  }

  revalidatePath(`/onboarding/${onboardingId}`);
}

export async function recordQuotationRejected(
  quotationId: string,
  onboardingId: string,
  formData: FormData
) {
  const action = String(formData.get("action") ?? "");
  const supabase = await createClient();

  await supabase
    .from("quotations")
    .update({ status: "rejected", rejected_at: new Date().toISOString() })
    .eq("id", quotationId);

  if (action === "close") {
    const { data: onboarding } = await supabase
      .from("customer_onboarding")
      .select("lead_id")
      .eq("id", onboardingId)
      .single();

    if (onboarding?.lead_id) {
      await supabase.from("leads").update({ status: "lost" }).eq("id", onboarding.lead_id);
    }
  }
  // action === "re-quote": nothing further — the pipeline page shows the
  // create-quotation form again once no active (draft/sent) quotation remains.

  revalidatePath(`/onboarding/${onboardingId}`);
  redirect(`/onboarding/${onboardingId}`);
}

// Advances the onboarding stage to account_created and fires the customer's
// invite email, pointing at apps/web's existing /invite/[token] flow
// (Task 5) — the same step both payment paths below end with.
async function advanceToAccountCreatedAndInvite(onboardingId: string) {
  const supabase = await createClient();
  const inviteToken = crypto.randomUUID();

  const { data: onboarding } = await supabase
    .from("customer_onboarding")
    .update({ current_stage: "account_created", invite_token: inviteToken, invite_status: "pending" })
    .eq("id", onboardingId)
    .select("lead_id")
    .single();

  if (onboarding?.lead_id) {
    const { data: lead } = await supabase
      .from("leads")
      .select("full_name, email")
      .eq("id", onboarding.lead_id)
      .single();

    if (lead?.email) {
      await sendCustomerInviteEmail({ to: lead.email, name: lead.full_name, inviteToken });
    }
  }
}

// Payment collection is SIMULATED — no Razorpay integration yet (that's a
// follow-up). Clicking "Pay" here immediately records a paid `payments` row
// rather than redirecting to a real checkout. Swap the guts of these two
// functions for real Razorpay order creation + webhook-verified capture
// when that's wired up; the RLS policies, stage advancement, and invite
// email are already the real thing.

export async function recordFullPayment(onboardingId: string, quotationId: string) {
  const supabase = await createClient();

  const { data: quotation } = await supabase
    .from("quotations")
    .select("total_amount")
    .eq("id", quotationId)
    .single();

  if (!quotation) {
    redirect(`/onboarding/${onboardingId}?error=${encodeURIComponent("Couldn't load this quotation.")}`);
  }

  await supabase.from("payments").insert({
    quotation_id: quotationId,
    payment_type: "full",
    amount: quotation.total_amount,
    status: "paid",
    gateway: "simulated",
    paid_at: new Date().toISOString(),
  });

  await supabase.from("quotations").update({ payment_option: "full" }).eq("id", quotationId);

  await advanceToAccountCreatedAndInvite(onboardingId);

  revalidatePath(`/onboarding/${onboardingId}`);
  redirect(`/onboarding/${onboardingId}`);
}

export async function recordSplitPayment(
  onboardingId: string,
  quotationId: string,
  formData: FormData
) {
  const advanceAmount = Number(formData.get("advanceAmount") ?? 0);
  const supabase = await createClient();

  const { data: quotation } = await supabase
    .from("quotations")
    .select("total_amount")
    .eq("id", quotationId)
    .single();

  const totalAmount = quotation ? Number(quotation.total_amount) : 0;

  if (!quotation || advanceAmount <= 0 || advanceAmount >= totalAmount) {
    redirect(
      `/onboarding/${onboardingId}?error=${encodeURIComponent("Enter an advance amount greater than 0 and less than the total.")}`
    );
  }

  const balanceAmount = totalAmount - advanceAmount;

  await supabase.from("payments").insert([
    {
      quotation_id: quotationId,
      payment_type: "advance",
      amount: advanceAmount,
      status: "paid",
      gateway: "simulated",
      paid_at: new Date().toISOString(),
    },
    {
      quotation_id: quotationId,
      payment_type: "balance",
      amount: balanceAmount,
      status: "pending",
      gateway: "simulated",
    },
  ]);

  await supabase
    .from("quotations")
    .update({
      payment_option: "split",
      advance_amount: advanceAmount,
      balance_amount: balanceAmount,
    })
    .eq("id", quotationId);

  await supabase
    .from("customer_onboarding")
    .update({ balance_payment_status: "pending" })
    .eq("id", onboardingId);

  await advanceToAccountCreatedAndInvite(onboardingId);

  revalidatePath(`/onboarding/${onboardingId}`);
  redirect(`/onboarding/${onboardingId}`);
}

// Task 8.3: the pipeline view distinguishes "waiting on customer" (no
// customer_id yet) from "profile submitted" — this is the resend option for
// the waiting case. Reuses the existing invite_token rather than minting a
// new one, so a link the customer may already have open keeps working.
export async function resendCustomerInviteEmail(onboardingId: string) {
  const supabase = await createClient();

  const { data: onboarding } = await supabase
    .from("customer_onboarding")
    .select("lead_id, invite_token, customer_id")
    .eq("id", onboardingId)
    .single();

  if (!onboarding || onboarding.customer_id || !onboarding.invite_token) {
    redirect(
      `/onboarding/${onboardingId}?error=${encodeURIComponent("Nothing to resend — the account may already be set up.")}`
    );
  }

  const { data: lead } = await supabase
    .from("leads")
    .select("full_name, email")
    .eq("id", onboarding.lead_id)
    .single();

  if (lead?.email) {
    await sendCustomerInviteEmail({
      to: lead.email,
      name: lead.full_name,
      inviteToken: onboarding.invite_token,
    });
  }

  revalidatePath(`/onboarding/${onboardingId}`);
  redirect(`/onboarding/${onboardingId}`);
}
