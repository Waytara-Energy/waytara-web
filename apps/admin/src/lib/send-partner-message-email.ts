import { Resend } from "resend";
import { renderMail } from "@waytara/ui/mail-layout";

export interface PartnerMessageInput {
  from: { name: string; email: string; company: string; reference: string | null };
  subject: string;
  message: string;
  adminUrl: string;
  applicationId: string;
}

/** A partner's message to the partnerships team: to the team's inbox, with the partner as the Reply-To so a reply goes straight back to them. Returns whether it was sent. */
export async function sendPartnerMessageEmail(input: PartnerMessageInput): Promise<"sent" | "failed" | "skipped"> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[send-partner-message-email] RESEND_API_KEY not set: skipping send.");
    return "skipped";
  }
  const to = (process.env.PARTNERS_NOTIFICATION_EMAIL || process.env.LEADS_NOTIFICATION_EMAIL || "hello@waytaraenergy.com")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const from = process.env.RESEND_FROM_EMAIL || "WayTara Energy <onboarding@resend.dev>";
  try {
    const { html, text } = renderMail({
      preheader: `${input.from.company}: ${input.subject}`,
      title: "Message from a partner",
      blocks: [
        {
          type: "facts",
          rows: [
            ["From", `${input.from.name} (${input.from.company})`],
            ["E-mail", input.from.email],
            ...(input.from.reference ? ([["Reference", input.from.reference]] as [string, string][]) : []),
            ["Subject", input.subject],
          ],
        },
        { type: "quote", label: "Message", text: input.message },
      ],
      button: { label: "Open the partner", url: `${input.adminUrl.replace(/\/+$/, "")}/partners/${input.applicationId}` },
      why: "You get this e-mail because you are on the team that looks after partners. Reply to answer them directly.",
      audience: "team",
      adminUrl: input.adminUrl,
    });
    const { error } = await new Resend(apiKey).emails.send({ from, to, replyTo: input.from.email, subject: `Partner message: ${input.subject} (${input.from.company})`, text, html });
    if (error) {
      console.error("[send-partner-message-email] Resend rejected the send:", error);
      return "failed";
    }
    return "sent";
  } catch (error) {
    console.error("[send-partner-message-email] Resend send failed:", error);
    return "failed";
  }
}
