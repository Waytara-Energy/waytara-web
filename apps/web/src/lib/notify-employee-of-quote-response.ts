import { renderMail } from "@waytara/ui/mail-layout";
import { sendMail } from "./send-mail";

export interface QuoteResponseNotifyInput {
  to: string;
  employeeName: string | null;
  leadName: string;
  kind: "rejected" | "revision_requested";
  message: string;
}

/**
 * Fires when a customer rejects or requests changes to their quote from the public /quote/[token] page: the assigned employee (or an admin, if none)
 * needs to know without having to keep refreshing the onboarding pipeline. Non-fatal: it never throws.
 */
export async function notifyEmployeeOfQuoteResponse(input: QuoteResponseNotifyInput): Promise<void> {
  const subject = input.kind === "rejected" ? `Quote declined: ${input.leadName}` : `Changes requested: ${input.leadName}`;

  const { html, text } = renderMail({
    preheader: input.kind === "rejected" ? `${input.leadName} declined their quotation.` : `${input.leadName} asked for changes to their quotation.`,
    title: subject,
    greeting: `Hi ${input.employeeName ?? "there"},`,
    blocks: [
      { type: "p", text: input.kind === "rejected" ? `${input.leadName} has declined their quotation.` : `${input.leadName} has requested changes to their quotation.` },
      { type: "quote", label: "Their message", text: input.message },
    ],
    why: "You get this e-mail because this customer's onboarding is yours, or because no one has taken it yet and you are an admin.",
    audience: "team",
    adminUrl: process.env.ADMIN_APP_URL || "https://admin.waytaraenergy.com",
  });

  const result = await sendMail(input.to, { subject, text, html });
  if (result === "failed") console.error("[notify-employee-of-quote-response] the e-mail could not be sent");
}
