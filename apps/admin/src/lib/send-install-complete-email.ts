import { Resend } from "resend";

export interface InstallCompleteEmailInput {
  to: string;
  name: string | null;
}

/**
 * Fires once every device on site is physically installed and marked
 * complete (Task 8.6) — the close of the onboarding pipeline. Same
 * non-fatal-if-unconfigured / explicit-error-check pattern as the other
 * Resend senders in this codebase (send-customer-invite-email.ts,
 * send-quotation-email.ts).
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
    const { error } = await resend.emails.send({
      from,
      to: input.to,
      subject: "Your WayTara system is live",
      text: [
        `Hi ${input.name ?? "there"},`,
        ``,
        `Installation is complete and your system is now live. Track your output, savings, and support requests any time from your dashboard:`,
        dashboardUrl,
        ``,
        `Welcome to WayTara.`,
        `— The WayTara Team`,
      ].join("\n"),
    });

    if (error) {
      console.error("[send-install-complete-email] Resend rejected the send:", error);
    }
  } catch (error) {
    console.error("[send-install-complete-email] Resend send failed:", error);
  }
}
