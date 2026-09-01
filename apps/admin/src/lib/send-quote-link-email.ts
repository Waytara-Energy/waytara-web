import { Resend } from "resend";

export interface QuoteLinkEmailInput {
  to: string;
  leadName: string;
  totalAmount: number;
  accessToken: string;
}

/**
 * Onboarding pipeline redesign, Phase 3: fires when a quotation is
 * generated — points the customer at the public quote-response page
 * (apps/web's /quote/[token], Phase 4) rather than attaching a PDF. No
 * PDF exists yet at this point; one is only generated once they accept.
 * Same non-fatal-if-unconfigured / explicit-error-check pattern as every
 * other Resend sender in this codebase.
 */
export async function sendQuoteLinkEmail(input: QuoteLinkEmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.warn("[send-quote-link-email] RESEND_API_KEY not set — skipping send.");
    return;
  }

  const from = process.env.RESEND_FROM_EMAIL || "WayTara Energy <onboarding@resend.dev>";
  const customerAppUrl = process.env.CUSTOMER_APP_URL || "http://localhost:3000";
  const quoteUrl = `${customerAppUrl}/quote/${input.accessToken}`;

  const resend = new Resend(apiKey);

  try {
    const { error } = await resend.emails.send({
      from,
      to: input.to,
      subject: "Your WayTara quotation is ready",
      text: [
        `Hi ${input.leadName},`,
        ``,
        `Your WayTara quotation is ready — total ₹${input.totalAmount.toLocaleString("en-IN")} (GST included).`,
        `View it, and accept, reject, or request changes, here:`,
        quoteUrl,
        ``,
        `— The WayTara Team`,
      ].join("\n"),
    });

    if (error) {
      console.error("[send-quote-link-email] Resend rejected the send:", error);
    }
  } catch (error) {
    console.error("[send-quote-link-email] Resend send failed:", error);
  }
}
