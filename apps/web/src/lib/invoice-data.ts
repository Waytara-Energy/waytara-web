import "server-only";
import { createClient } from "@waytara/supabase/server";
import { createServiceRoleClient } from "@waytara/supabase/service-role";
import { getCurrentProfile } from "@waytara/supabase/auth";
import { addressLines, hasInvoice, invoiceDescription, invoiceNumber, paymentTypeText, purchaseProgress, splitGst, type InvoiceData, type InvoiceParty } from "./invoice";
import { isEmptyAddress, parseAddress } from "./address";

/** Who the invoice is from. The name and the address for questions are fixed; the GSTIN and the registered address are set in the environment
 *  (WAYTARA_GSTIN, WAYTARA_ADDRESS with the lines separated by "|") and are left off the invoice until they are. */
export function seller(): InvoiceParty {
  const gstin = process.env.WAYTARA_GSTIN?.trim().toUpperCase() || null;
  const address = (process.env.WAYTARA_ADDRESS ?? "").split("|").map((l) => l.trim()).filter(Boolean);
  return { name: "WayTara Energy LLP", email: "hello@waytaraenergy.com", address, gstin };
}

/**
 * The invoice for one payment of the signed-in customer, or null when there is none to show: not theirs (the payment is read through their own
 * session, so another person's id finds nothing), not paid yet, or the person is not a customer. The quotation is read with the service role
 * because customers cannot read quotations directly, and only after the payment itself proved to be theirs.
 */
export async function loadInvoice(paymentId: string): Promise<InvoiceData | null> {
  const supabase = await createClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile) return null;

  const { data: payment } = await supabase
    .from("payments")
    .select("id, customer_id, quotation_id, payment_type, amount, status, method, paid_at, created_at, gateway_ref")
    .eq("id", paymentId)
    .maybeSingle();
  if (!payment || payment.customer_id !== profile.id || !hasInvoice(payment.status)) return null;

  const service = createServiceRoleClient();
  const [{ data: customer }, { data: quotation }, { data: paid }] = await Promise.all([
    supabase.from("customers").select("address, billing_address, billing_email, gstin").eq("id", profile.id).maybeSingle(),
    service.from("quotations").select("id, gst_rate, total_amount, plan:plans(name)").eq("id", payment.quotation_id).maybeSingle(),
    supabase.from("payments").select("amount").eq("quotation_id", payment.quotation_id).eq("status", "paid"),
  ]);

  const total = Number(payment.amount);
  const gstRate = quotation ? Number(quotation.gst_rate) : null;
  const { taxable, gst } = splitGst(total, gstRate);
  const issuedAt = payment.paid_at ?? payment.created_at;
  const planName = quotation?.plan?.name ?? null;

  const billing = customer?.billing_address ? parseAddress(customer.billing_address) : null;
  const address = billing && !isEmptyAddress(billing) ? billing : parseAddress(customer?.address);

  return {
    number: invoiceNumber(payment.id, issuedAt),
    issuedAt,
    seller: seller(),
    buyer: { name: profile.full_name?.trim() || profile.email || "Customer", email: profile.email, billingEmail: customer?.billing_email ?? null, address: addressLines(address), gstin: customer?.gstin ?? null },
    description: invoiceDescription(payment.payment_type, planName),
    quotationRef: quotation ? quotation.id.slice(0, 8) : null,
    planName,
    amounts: { taxable, gstRate, gst, total },
    payment: { type: payment.payment_type, typeLabel: paymentTypeText(payment.payment_type), method: payment.method, reference: payment.gateway_ref, paidAt: payment.paid_at },
    progress: quotation ? purchaseProgress(Number(quotation.total_amount), (paid ?? []).map((p) => Number(p.amount))) : null,
  };
}
