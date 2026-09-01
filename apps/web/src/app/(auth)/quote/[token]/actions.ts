"use server";

import { redirect } from "next/navigation";
import { createServiceRoleClient } from "@waytara/supabase/service-role";
import { generateQuotationPdf, type PricingLineItem } from "@waytara/ui/quotation-pdf";
import { sendQuoteAcceptedEmail } from "@/lib/send-quote-accepted-email";
import { notifyEmployeeOfQuoteResponse } from "@/lib/notify-employee-of-quote-response";

// Onboarding pipeline redesign, Phase 4: the customer has no session on
// this page (anon, token-addressable link from an email) — every action
// re-validates the token itself via the service-role client, mirroring
// invite/[token]/actions.ts's acceptCustomerInvite exactly, rather than
// trusting whatever the page last rendered.
// Employee notification needs an email address to send to, but the
// existing sender convention (send-install-complete-email.ts etc.) keeps
// senders as pure "send what you're given" functions with no DB access —
// so the lookup (assigned employee, falling back to any admin if the
// employee has no email on file) happens here, once, shared by both
// reject and revision-request paths.
async function resolveEmployeeNotifyTarget(
  service: ReturnType<typeof createServiceRoleClient>,
  employeeId: string | null
) {
  if (employeeId) {
    const { data: employee } = await service
      .from("profiles")
      .select("email, full_name")
      .eq("id", employeeId)
      .maybeSingle();
    if (employee?.email) return employee;
  }

  const { data: admin } = await service
    .from("profiles")
    .select("email, full_name")
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();

  return admin ?? null;
}

async function loadRespondableQuotation(token: string) {
  const service = createServiceRoleClient();
  const { data: quotation } = await service
    .from("quotations")
    .select(
      "id, status, lead_id, employee_id, valid_until, pricing_breakdown, subtotal_amount, gst_rate, gst_amount, total_amount, created_at, plan_id, plan:plans(name, price_monthly), lead:leads(full_name, email, phone)"
    )
    .eq("access_token", token)
    .maybeSingle();

  const expired = !!quotation?.valid_until && new Date(quotation.valid_until).getTime() < Date.now();
  if (!quotation || quotation.status !== "sent" || expired) {
    return { service, quotation: null };
  }
  return { service, quotation };
}

export async function submitQuoteReject(token: string, formData: FormData) {
  const message = String(formData.get("message") ?? "").trim();
  if (!message) {
    redirect(`/quote/${token}?error=${encodeURIComponent("Please tell us why you're declining.")}`);
  }

  const { service, quotation } = await loadRespondableQuotation(token);
  if (!quotation) {
    redirect(`/quote/${token}?error=${encodeURIComponent("This quote is no longer open for a response.")}`);
  }

  await service
    .from("quotations")
    .update({ status: "rejected", rejected_at: new Date().toISOString(), customer_message: message })
    .eq("id", quotation.id);

  await service.from("leads").update({ status: "lost" }).eq("id", quotation.lead_id);

  const notifyTarget = await resolveEmployeeNotifyTarget(service, quotation.employee_id);
  if (notifyTarget?.email) {
    await notifyEmployeeOfQuoteResponse({
      to: notifyTarget.email,
      employeeName: notifyTarget.full_name,
      leadName: quotation.lead?.full_name ?? "Customer",
      kind: "rejected",
      message,
    });
  }

  redirect(`/quote/${token}`);
}

export async function submitQuoteRevision(token: string, formData: FormData) {
  const message = String(formData.get("message") ?? "").trim();
  if (!message) {
    redirect(`/quote/${token}?error=${encodeURIComponent("Please tell us what you'd like changed.")}`);
  }

  const { service, quotation } = await loadRespondableQuotation(token);
  if (!quotation) {
    redirect(`/quote/${token}?error=${encodeURIComponent("This quote is no longer open for a response.")}`);
  }

  await service
    .from("quotations")
    .update({ status: "revision_requested", customer_message: message })
    .eq("id", quotation.id);

  const notifyTarget = await resolveEmployeeNotifyTarget(service, quotation.employee_id);
  if (notifyTarget?.email) {
    await notifyEmployeeOfQuoteResponse({
      to: notifyTarget.email,
      employeeName: notifyTarget.full_name,
      leadName: quotation.lead?.full_name ?? "Customer",
      kind: "revision_requested",
      message,
    });
  }

  redirect(`/quote/${token}`);
}

export async function submitQuoteAccept(token: string, formData: FormData) {
  const paymentOption = String(formData.get("paymentOption") ?? "full");
  if (paymentOption !== "full" && paymentOption !== "split") {
    redirect(`/quote/${token}?error=${encodeURIComponent("Pick a payment option.")}`);
  }

  const { service, quotation } = await loadRespondableQuotation(token);
  if (!quotation) {
    redirect(`/quote/${token}?error=${encodeURIComponent("This quote is no longer open for a response.")}`);
  }

  const totalAmount = Number(quotation.total_amount);
  const advanceAmount = paymentOption === "split" ? Math.round(totalAmount * 0.3 * 100) / 100 : null;
  const balanceAmount = paymentOption === "split" ? Math.round((totalAmount - (advanceAmount ?? 0)) * 100) / 100 : null;

  await service
    .from("quotations")
    .update({
      status: "accepted",
      accepted_at: new Date().toISOString(),
      payment_option: paymentOption,
      advance_amount: advanceAmount,
      balance_amount: balanceAmount,
    })
    .eq("id", quotation.id);

  await service.from("leads").update({ status: "converted" }).eq("id", quotation.lead_id);

  // Payment itself happens after the customer creates their account
  // (Phase 5) — this only locks in which option they picked. If a split
  // was chosen, Phase 5's self-service pay actions will insert the actual
  // `payments` rows (advance + pending balance) at that point.

  const lines = (quotation.pricing_breakdown as unknown as PricingLineItem[] | null) ?? [];
  const planPrice = quotation.plan?.price_monthly ?? 0;

  const pdfBuffer = await generateQuotationPdf({
    quotationId: quotation.id,
    createdAt: quotation.created_at,
    leadName: quotation.lead?.full_name ?? "Customer",
    leadEmail: quotation.lead?.email ?? "",
    leadPhone: quotation.lead?.phone ?? null,
    planName: quotation.plan?.name ?? "—",
    planPrice,
    pricingBreakdown: lines,
    subtotalAmount: Number(quotation.subtotal_amount ?? 0),
    gstRate: Number(quotation.gst_rate ?? 0),
    gstAmount: Number(quotation.gst_amount ?? 0),
    totalAmount,
    currency: "INR",
    validUntil: quotation.valid_until,
    paymentOption: paymentOption as "full" | "split",
    advanceAmount,
    balanceAmount,
  });

  // Mint the account-creation invite now, same shape as admin's retired
  // advanceToAccountCreatedAndInvite — the customer_onboarding row already
  // exists (created when the employee started this lead's onboarding), so
  // this only ever updates it, never inserts.
  const inviteToken = crypto.randomUUID();
  const { data: onboarding } = await service
    .from("customer_onboarding")
    .update({ current_stage: "account_created", invite_token: inviteToken, invite_status: "pending" })
    .eq("lead_id", quotation.lead_id)
    .select("id")
    .maybeSingle();

  if (!onboarding) {
    redirect(
      `/quote/${token}?error=${encodeURIComponent("Accepted, but we couldn't start onboarding automatically — your WayTara advisor has been notified.")}`
    );
  }

  if (quotation.lead?.email) {
    await sendQuoteAcceptedEmail({
      to: quotation.lead.email,
      name: quotation.lead.full_name,
      pdfBuffer,
      inviteToken,
    });
  }

  redirect(`/quote/${token}`);
}
