import { Resend } from "resend";
import { MAIL_REPLY_TO, renderMail } from "@waytara/ui/mail-layout";
import { DECLINE_OPTIONS, type DeclineHandling } from "@waytara/supabase/partner-verification";

export type MailOutcome = "sent" | "failed" | "skipped";

export interface PartnerDeclineEmailInput {
  to: string;
  contactName: string;
  reference: string | null;
  /** What was (or is about to be) done with their data; the e-mail says it in the words the admin saw. */
  handling: DeclineHandling;
}

/**
 * The last e-mail an applicant gets: their application is not being taken forward, what happens to their data, and nothing about why (we do not give reasons).
 * It is sent BEFORE anything is deleted, and the decline flow stops if it was not sent. No link: the applicant's private link is closed by the same decline.
 *
 * Returns what happened, so the caller can tell a failed send (stop, delete nothing) from "no e-mail service is set up here" (a development machine: carry on).
 */
export async function sendPartnerDeclineEmail(input: PartnerDeclineEmailInput): Promise<MailOutcome> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[send-partner-decline-email] RESEND_API_KEY not set: skipping send.");
    return "skipped";
  }
  const from = process.env.RESEND_FROM_EMAIL || "WayTara Energy <onboarding@resend.dev>";
  const first = input.contactName.trim().split(/\s+/)[0] || "there";
  const option = DECLINE_OPTIONS.find((o) => o.id === input.handling)!;

  try {
    const { html, text } = renderMail({
      preheader: "About your WayTara Partner Network application.",
      title: "About your application",
      greeting: `Hi ${first},`,
      blocks: [
        { type: "p", text: "Thank you for applying. We are not able to take your application forward at this time." },
        ...(input.reference ? [{ type: "facts" as const, rows: [["Reference", input.reference] as [string, string]] }] : []),
        { type: "p", text: option.mail },
        { type: "p", text: "Your sign-in and links no longer work. Reply to this e-mail with any question." },
      ],
      why: "You get this e-mail because you applied to join the WayTara Partner Network.",
      audience: "public",
    });
    const { error } = await new Resend(apiKey).emails.send({ from, to: input.to, replyTo: MAIL_REPLY_TO, subject: "About your WayTara partner application", text, html });
    if (error) {
      console.error("[send-partner-decline-email] Resend rejected the send:", error);
      return "failed";
    }
    return "sent";
  } catch (error) {
    console.error("[send-partner-decline-email] Resend send failed:", error);
    return "failed";
  }
}
