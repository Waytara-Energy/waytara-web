import { Resend } from "resend";

export interface QuotationEmailInput {
  to: string;
  leadName: string;
  totalAmount: number;
  currency: string;
  planName: string;
  pdfUrl: string;
  pdfBuffer: Buffer;
}

/**
 * Emails the customer their quotation PDF. Non-fatal by design, same as
 * apps/web's notify-team: if RESEND_API_KEY isn't set or the send fails,
 * this logs and returns rather than throwing — the quotation is already
 * saved and uploaded by the time this runs.
 */
export async function sendQuotationEmail(input: QuotationEmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.warn("[send-quotation-email] RESEND_API_KEY not set — skipping send.");
    return;
  }

  const from = process.env.RESEND_FROM_EMAIL || "WayTara Energy <onboarding@resend.dev>";
  const resend = new Resend(apiKey);

  const formattedTotal = `${input.currency} ${input.totalAmount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  try {
    await resend.emails.send({
      from,
      to: input.to,
      subject: `Your WayTara quotation — ${formattedTotal}`,
      text: [
        `Hi ${input.leadName},`,
        ``,
        `Thanks for your interest in WayTara. Your quotation is attached, and also available here:`,
        input.pdfUrl,
        ``,
        `Plan: ${input.planName}`,
        `Total: ${formattedTotal}`,
        ``,
        `Reply to this email or call us with any questions — we're happy to walk through the details.`,
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
  } catch (error) {
    console.error("[send-quotation-email] Resend send failed:", error);
  }
}
