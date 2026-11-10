import { Resend } from "resend";
import { MAIL_REPLY_TO, renderMail } from "@waytara/ui/mail-layout";

export interface InstallCompleteEmailInput {
  to: string;
  name: string | null;
}

/**
 * Fires once every device on site is physically installed and marked
 * complete (Task 8.6) — the close of the onboarding pipeline. Same
 * non-fatal-if-unconfigured / explicit-error-check pattern as the other
 * Resend senders in this codebase (send-customer-invite-email.ts,
 * send-quote-link-email.ts).
 */
export async function sendInstallCompleteEmail(input: InstallCompleteEmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.warn("[send-install-complete-email] RESEND_API_KEY not set — skipping send.");
    return;
  }

  const from = process.env.RESEND_FROM_EMAIL || "WayTara Energy <onboarding@resend.dev>";
  const customerAppUrl = process.env.CUSTOMER_APP_URL || "http://localhost:3000";
  const dashboardUrl = `${customerAppUrl}/dashboard`;

  const resend = new Resend(apiKey);

  try {
    const { html, text } = renderMail({
      preheader: "Installation is complete and your system is live.",
      title: "Your WayTara system is live",
      greeting: `Hi ${input.name ?? "there"},`,
      blocks: [
        { type: "p", text: "Installation is complete and your system is now live. Track your output, savings and support requests any time from your dashboard." },
        { type: "p", text: "Welcome to WayTara." },
      ],
      button: { label: "Open your dashboard", url: dashboardUrl },
      why: "You get this e-mail because the installation at your site was marked complete.",
      audience: "customer",
      siteUrl: customerAppUrl && !/localhost/.test(customerAppUrl) ? customerAppUrl : undefined,
    });
    const { error } = await resend.emails.send({
      from,
      to: input.to,
      replyTo: MAIL_REPLY_TO,
      subject: "Your WayTara system is live",
      text,
      html,
    });

    if (error) {
      console.error("[send-install-complete-email] Resend rejected the send:", error);
    }
  } catch (error) {
    console.error("[send-install-complete-email] Resend send failed:", error);
  }
}
