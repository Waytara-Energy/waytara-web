"use server";

import { requireCustomer } from "@waytara/supabase/auth";
import { loadInvoice } from "@/lib/invoice-data";
import { generateInvoicePdf } from "@/lib/invoice-pdf";
import { istText } from "@/lib/auth-mail";
import { sendMail } from "@/lib/send-mail";
import type { InvoiceData } from "@/lib/invoice";

/** One invoice for the in-app view (the same data the PDF is drawn from). */
export async function getInvoice(paymentId: string): Promise<InvoiceData> {
  await requireCustomer();
  const invoice = await loadInvoice(paymentId);
  if (!invoice) throw new Error("There is no invoice for this payment.");
  return invoice;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** E-mails the invoice as a PDF to the billing e-mail (or the account's e-mail when there is none). */
export async function emailInvoice(paymentId: string): Promise<{ sentTo: string }> {
  const profile = await requireCustomer();
  const invoice = await loadInvoice(paymentId);
  if (!invoice) throw new Error("There is no invoice for this payment.");
  const to = invoice.buyer.billingEmail || profile.email;
  if (!to) throw new Error("Your account has no e-mail address to send it to.");

  const pdf = await generateInvoicePdf(invoice);
  const hello = invoice.buyer.name.split(/\s+/)[0] ? `Hi ${invoice.buyer.name.split(/\s+/)[0]},` : "Hi,";
  const text = [hello, "", `Your invoice ${invoice.number} for ${invoice.description.toLowerCase()} is attached.`, "", `Paid ${istText(Date.parse(invoice.issuedAt))}.`, "", "- The WayTara Team"].join("\n");
  const html = `<div style="font-family:Segoe UI,Arial,sans-serif;color:#0f172a;max-width:520px"><p>${esc(hello)}</p><p>Your invoice <strong>${esc(invoice.number)}</strong> for ${esc(invoice.description.toLowerCase())} is attached.</p><p style="color:#64748b;font-size:12px">- The WayTara Team</p></div>`;
  const sent = await sendMail(to, { subject: `Your WayTara invoice ${invoice.number}`, text, html }, [{ filename: `waytara-invoice-${invoice.number}.pdf`, content: pdf }]);
  if (sent !== "sent") throw new Error(sent === "suppressed" ? "E-mail is not set up on this server yet." : "We could not send the e-mail. Try again in a moment.");
  return { sentTo: to };
}
