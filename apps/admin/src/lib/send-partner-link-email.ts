import { Resend } from "resend";
import { MAIL_REPLY_TO, renderMail } from "@waytara/ui/mail-layout";

export interface PartnerLinkEmailInput {
  to: string;
  contactName: string;
  reference: string | null;
  /** The code of the tracking link (the page it opens is on the public site). */
  token: string;
  /** "resend": the first e-mail was lost, here is a new link. "onboarding": the forms have just opened. "more_info": the team needs something more. */
  purpose?: "resend" | "onboarding" | "more_info";
  /** For "more_info": what the team asked for, in the admin's words. */
  note?: string;
}

/**
 * Sends an applicant a new private link to their partner application page (the public site's /partner/track page). Either an admin sends it because the earlier
 * e-mail was lost, or it goes out when the team opens the onboarding forms or asks for more. It replaces the earlier link (only the new code is valid). Same
 * non-fatal-if-unconfigured pattern as every other Resend sender here: a failed send is logged, never thrown.
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
  const purpose = input.purpose ?? "resend";

  const copy = {
    resend: {
      preheader: "A new link to follow your WayTara partner application.",
      title: "Your link to follow your application",
      lead: "Here is a new private link to follow your application to the WayTara Partner Network. It replaces any link we sent before.",
      button: "Follow your application",
      subject: "Your link to follow your WayTara partner application",
    },
    onboarding: {
      preheader: "You are shortlisted. Your onboarding is open.",
      title: "You are shortlisted: your onboarding is open",
      lead: "Good news: you are shortlisted for the WayTara Partner Network. The next step is to tell us about your business, licences, team and the areas you cover, and to send us your documents. You can do it all on your private page, and it saves as you go, so you can stop and come back.",
      button: "Start your onboarding",
      subject: "You are shortlisted: start your WayTara partner onboarding",
    },
    more_info: {
      preheader: "We need a little more from you to finish checking your application.",
      title: "We need a little more from you",
      lead: "Thank you for sending your details. To finish checking your application we need something more. Your page is open again, with everything you sent kept as it was.",
      button: "Open your page",
      subject: "We need a little more for your WayTara partner application",
    },
  }[purpose];

  try {
    const { html, text } = renderMail({
      preheader: copy.preheader,
      title: copy.title,
      greeting: `Hi ${first},`,
      blocks: [
        { type: "p", text: copy.lead },
        ...(purpose === "more_info" && input.note ? [{ type: "quote" as const, label: "What we need", text: input.note }] : []),
        ...(input.reference ? [{ type: "facts" as const, rows: [["Application reference", input.reference] as [string, string]] }] : []),
        ...(purpose !== "resend" ? [{ type: "p" as const, text: "This link replaces the one in our earlier e-mail. We use your documents only to verify your application, and we do not share them with anyone outside WayTara." }] : []),
        { type: "p", text: "This link is private to you. Anyone who has it can see your application, so please do not share it." },
      ],
      button: { label: copy.button, url },
      why: "You get this e-mail because you applied to join the WayTara Partner Network.",
      audience: "public",
    });
    const { error } = await new Resend(apiKey).emails.send({ from, to: input.to, replyTo: MAIL_REPLY_TO, subject: copy.subject, text, html });
    if (error) console.error("[send-partner-link-email] Resend rejected the send:", error);
  } catch (error) {
    console.error("[send-partner-link-email] Resend send failed:", error);
  }
}
