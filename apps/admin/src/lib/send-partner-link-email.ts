import { Resend } from "resend";
import { MAIL_REPLY_TO, renderMail } from "@waytara/ui/mail-layout";

export interface PartnerLinkEmailInput {
  to: string;
  contactName: string;
  reference: string | null;
  /**
   * The code of the invite link (it leads to the start page, where the e-mail code and a password come first). Left out for a partner who already has an account: the
   * button then simply opens their partner area, where they sign in.
   */
  token?: string;
  /** "resend": the first e-mail was lost. "onboarding": the forms opened. "more_info": the team needs something. "approved": they are approved. */
  purpose?: "resend" | "onboarding" | "more_info" | "approved";
  /** For "more_info": what the team asked for, in the admin's words. */
  note?: string;
}

/**
 * A short e-mail with one button: the invite link for an applicant who has not made an account yet, or the partner area for one who has. Same non-fatal-if-unconfigured
 * pattern as every other Resend sender here: a failed send is logged, never thrown.
 */
export async function sendPartnerLinkEmail(input: PartnerLinkEmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[send-partner-link-email] RESEND_API_KEY not set: skipping send.");
    return;
  }
  const from = process.env.RESEND_FROM_EMAIL || "WayTara Energy <onboarding@resend.dev>";
  const publicUrl = (process.env.CUSTOMER_APP_URL || "http://localhost:3000").replace(/\/+$/, "");
  const url = input.token ? `${publicUrl}/partner/start?t=${input.token}` : `${publicUrl}/partner/portal`;
  const first = input.contactName.trim().split(/\s+/)[0] || "there";
  const purpose = input.purpose ?? "resend";
  const signIn = !input.token;

  const copy = {
    resend: { title: "Your link to your application", lead: "Here is your link. It replaces any earlier one.", button: "Open your application", subject: "Your WayTara application link" },
    onboarding: {
      title: "Your onboarding is open",
      lead: signIn ? "Thank you for speaking with us. Next, sign in and send us your details and documents." : "Thank you for speaking with us. Next, open the link below: we will send a code to this address, you choose a password, and then you send us your details and documents.",
      button: signIn ? "Open your onboarding" : "Start onboarding",
      subject: "Start your WayTara partner onboarding",
    },
    more_info: { title: "We need a little more", lead: "To finish checking your application, we need something more.", button: "Open your application", subject: "We need a little more for your WayTara application" },
    approved: { title: "You are approved", lead: signIn ? "Welcome to the WayTara Partner Network. Sign in to open your partner area." : "Welcome to the WayTara Partner Network. Confirm your e-mail and choose a password to open your partner area.", button: signIn ? "Open your partner area" : "Choose your password", subject: "You are approved: open your WayTara partner area" },
  }[purpose];

  try {
    const { html, text } = renderMail({
      preheader: copy.lead,
      title: copy.title,
      greeting: `Hi ${first},`,
      blocks: [
        { type: "p", text: copy.lead },
        ...(purpose === "more_info" && input.note ? [{ type: "quote" as const, label: "What we need", text: input.note }] : []),
        ...(purpose === "onboarding" ? [{ type: "p" as const, text: "Keep these ready: a photo ID, your PAN, a cancelled cheque, your licences and certificates, and a photo ID (and certificate) for each person on your team." }] : []),
        ...(input.reference ? [{ type: "facts" as const, rows: [["Reference", input.reference] as [string, string]] }] : []),
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
