import { renderMail } from "@waytara/ui/mail-layout";
import { sendMail } from "./send-mail";

export interface QuoteAcceptedEmailInput {
  to: string;
  name: string | null;
  pdfBuffer: Buffer;
  inviteToken: string;
}

/**
 * Fires the moment a customer accepts their quote on the public /quote/[token] page. This is the one point in the whole pipeline where the PDF actually
 * gets generated and sent. Non-fatal: it never throws.
 */
export async function sendQuoteAcceptedEmail(input: QuoteAcceptedEmailInput): Promise<void> {
  const customerAppUrl = process.env.CUSTOMER_APP_URL || "http://localhost:3000";
  const inviteUrl = `${customerAppUrl}/invite/${input.inviteToken}`;

  const { html, text } = renderMail({
    preheader: "A copy of your quotation is attached. Next: set up your account.",
    title: "Thanks for accepting your quote",
    greeting: `Hi ${input.name ?? "there"},`,
    blocks: [
      { type: "p", text: "Thanks for accepting your quotation. A copy is attached for your records." },
      { type: "p", text: "The next step is your onboarding and payment. Create your account and fill in your details with the button below." },
      { type: "note", text: "Once your account is set up, you will complete payment and then be able to track your onboarding progress." },
    ],
    button: { label: "Set up your account", url: inviteUrl },
    why: "You get this e-mail because you accepted a WayTara quotation.",
    audience: "public",
    siteUrl: process.env.CUSTOMER_APP_URL && !/localhost/.test(process.env.CUSTOMER_APP_URL) ? process.env.CUSTOMER_APP_URL : undefined,
  });

  const result = await sendMail(input.to, { subject: "Thanks for accepting your WayTara quote", text, html }, [{ filename: "waytara-quotation.pdf", content: input.pdfBuffer }]);
  if (result === "failed") console.error("[send-quote-accepted-email] the e-mail could not be sent");
}
