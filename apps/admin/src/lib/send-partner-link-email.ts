import { Resend } from "resend";
import { MAIL_REPLY_TO, renderMail } from "@waytara/ui/mail-layout";

export interface PartnerLinkEmailInput {
  to: string;
  contactName: string;
  reference: string | null;
  /** The code of the tracking link (the page it opens is on the public site). */
  token: string;
}

/**
 * Sends an applicant a new private link to follow their partner application (the public site's /partner/track page). It is what an admin sends when the first
 * e-mail was lost, and it replaces the earlier link. Same non-fatal-if-unconfigured pattern as every other Resend sender here: a failed send is logged, never thrown.
 */
export async function sendPartnerLinkEmail(input: PartnerLinkEmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[send-partner-link-email] RESEND_API_KEY not set: skipping send.");
    return;
  }
  const from = process.env.RESEND_FROM_EMAIL || "WayTara Energy <onboarding@resend.dev>";
  const publicUrl = (process.env.CUSTOMER_APP_URL || "http://localhost:3000").replace(/\/+$/, "");
  const url = `${publicUrl}/partner/track/${input.token}`;
  const first = input.contactName.trim().split(/\s+/)[0] || "there";

  try {
    const { html, text } = renderMail({
      preheader: "A new link to follow your WayTara partner application.",
      title: "Your link to follow your application",
      greeting: `Hi ${first},`,
      blocks: [
        { type: "p", text: "Here is a new private link to follow your application to the WayTara Partner Network. It replaces any link we sent before." },
        ...(input.reference ? [{ type: "facts" as const, rows: [["Application reference", input.reference] as [string, string]] }] : []),
        { type: "p", text: "This link is private to you. Anyone who has it can see where your application is, so please do not share it." },
      ],
      button: { label: "Follow your application", url },
      why: "You get this e-mail because you applied to join the WayTara Partner Network.",
      audience: "public",
    });
    const { error } = await new Resend(apiKey).emails.send({
      from,
      to: input.to,
      replyTo: MAIL_REPLY_TO,
      subject: "Your link to follow your WayTara partner application",
      text,
      html,
    });
    if (error) console.error("[send-partner-link-email] Resend rejected the send:", error);
  } catch (error) {
    console.error("[send-partner-link-email] Resend send failed:", error);
  }
}
