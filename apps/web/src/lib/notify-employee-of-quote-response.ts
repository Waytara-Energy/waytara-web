import { Resend } from "resend";
import { renderMail } from "@waytara/ui/mail-layout";

export interface QuoteResponseNotifyInput {
  to: string;
  employeeName: string | null;
  leadName: string;
  kind: "rejected" | "revision_requested";
  message: string;
}

/**
 * Onboarding pipeline redesign, Phase 4: fires when a customer rejects or
 * requests changes to their quote from the public /quote/[token] page —
 * the assigned employee (or an admin, if none) needs to know without
 * having to keep refreshing the onboarding pipeline. Structure follows
 * notify-team.ts: non-fatal if RESEND_API_KEY is missing, explicit error
 * check on the Resend response.
 */
export async function notifyEmployeeOfQuoteResponse(input: QuoteResponseNotifyInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.warn("[notify-employee-of-quote-response] RESEND_API_KEY not set — skipping send.");
    return;
  }

  const from = process.env.RESEND_FROM_EMAIL || "WayTara Energy <onboarding@resend.dev>";
  const subject =
    input.kind === "rejected"
      ? `Quote declined: ${input.leadName}`
      : `Changes requested: ${input.leadName}`;

  const resend = new Resend(apiKey);

  try {
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
    const { error } = await resend.emails.send({
      from,
      to: input.to,
      subject,
      text,
      html,
    });

    if (error) {
      console.error("[notify-employee-of-quote-response] Resend rejected the send:", error);
    }
  } catch (error) {
    console.error("[notify-employee-of-quote-response] Resend send failed:", error);
  }
}
