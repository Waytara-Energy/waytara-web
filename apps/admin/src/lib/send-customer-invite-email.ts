import { Resend } from "resend";

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
    const { error } = await resend.emails.send({
      from,
      to: input.to,
      subject: "Set up your WayTara account",
      text: [
        `Hi ${input.name ?? "there"},`,
        ``,
        `Your payment is confirmed — thank you! Set up your WayTara account to track your installation and, once it's live, your system's dashboard:`,
        inviteUrl,
        ``,
        `— The WayTara Team`,
      ].join("\n"),
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
