import { Resend } from "resend";
import { renderMail } from "@waytara/ui/mail-layout";

export interface QuoteAcceptedEmailInput {
  to: string;
  name: string | null;
  pdfBuffer: Buffer;
  inviteToken: string;
}

/**
 * Onboarding pipeline redesign, Phase 4: fires the moment a customer
 * accepts their quote on the public /quote/[token] page. This is the one
 * point in the whole pipeline where the PDF actually gets generated and
 * sent — same non-fatal-if-unconfigured / explicit-error-check pattern as
 * every other Resend sender in this codebase.
 */
export async function sendQuoteAcceptedEmail(input: QuoteAcceptedEmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.warn("[send-quote-accepted-email] RESEND_API_KEY not set — skipping send.");
    return;
  }

  const from = process.env.RESEND_FROM_EMAIL || "WayTara Energy <onboarding@resend.dev>";
  const customerAppUrl = process.env.CUSTOMER_APP_URL || "http://localhost:3000";
  const inviteUrl = `${customerAppUrl}/invite/${input.inviteToken}`;

  const resend = new Resend(apiKey);

  try {
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
    const { error } = await resend.emails.send({
      from,
      to: input.to,
      subject: "Thanks for accepting your WayTara quote",
      text,
      html,
      attachments: [
        {
          filename: "waytara-quotation.pdf",
          content: input.pdfBuffer,
        },
      ],
    });

    if (error) {
      console.error("[send-quote-accepted-email] Resend rejected the send:", error);
    }
  } catch (error) {
    console.error("[send-quote-accepted-email] Resend send failed:", error);
  }
}
