import { Resend } from "resend";

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
    const { error } = await resend.emails.send({
      from,
      to: input.to,
      subject: "Thanks for accepting your WayTara quote",
      text: [
        `Hi ${input.name ?? "there"},`,
        ``,
        `Thanks for accepting your quotation — a copy is attached for your records.`,
        ``,
        `The next step is your onboarding and payment. Create your account and fill in your details here:`,
        inviteUrl,
        ``,
        `Once your account is set up, you'll complete payment and then be able to track your onboarding progress.`,
        ``,
        `— The WayTara Team`,
      ].join("\n"),
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
