"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@waytara/supabase/server";
import { getCurrentProfile } from "@waytara/supabase/auth";
import type { Json } from "@waytara/supabase";
import { generateQuotationPdf, type PricingLineItem } from "@/lib/quotation-pdf";
import { sendQuotationEmail } from "@/lib/send-quotation-email";

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
