import { Resend } from "resend";
import { MAIL_REPLY_TO, renderMail } from "@waytara/ui/mail-layout";

export interface CustomerInviteEmailInput {
  to: string;
  name: string | null;
  inviteToken: string;
}

/**
 * Fires the "set up your account" email once payment is recorded, pointing
 * at apps/web's existing /invite/[token] acceptance flow (Task 5). Same
 * non-fatal-if-unconfigured pattern as the other Resend senders in this
 * codebase.
 */
export async function sendCustomerInviteEmail(input: CustomerInviteEmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.warn("[send-customer-invite-email] RESEND_API_KEY not set — skipping send.");
    return;
  }

  const from = process.env.RESEND_FROM_EMAIL || "WayTara Energy <onboarding@resend.dev>";
  const customerAppUrl = process.env.CUSTOMER_APP_URL || "http://localhost:3000";
  const inviteUrl = `${customerAppUrl}/invite/${input.inviteToken}`;

  const resend = new Resend(apiKey);

  try {
    const { html, text } = renderMail({
      preheader: "Your payment is confirmed. Set up your WayTara account.",
      title: "Set up your WayTara account",
      greeting: `Hi ${input.name ?? "there"},`,
      blocks: [
        { type: "p", text: "Your payment is confirmed. Thank you!" },
        { type: "p", text: "Set up your WayTara account to track your installation and, once it is live, your system's dashboard." },
      ],
      button: { label: "Set up your account", url: inviteUrl },
      why: "You get this e-mail because your payment for a WayTara system was recorded.",
      audience: "public",
      siteUrl: customerAppUrl && !/localhost/.test(customerAppUrl) ? customerAppUrl : undefined,
    });
    const { error } = await resend.emails.send({
      from,
      to: input.to,
      replyTo: MAIL_REPLY_TO,
      subject: "Set up your WayTara account",
      text,
      html,
    });

    // The Resend SDK resolves with { data, error } on API-level failures
    // (e.g. an unverified sending domain) rather than throwing — a plain
    // try/catch never sees those unless this is checked explicitly.
    if (error) {
      console.error("[send-customer-invite-email] Resend rejected the send:", error);
    }
  } catch (error) {
    console.error("[send-customer-invite-email] Resend send failed:", error);
  }
}
