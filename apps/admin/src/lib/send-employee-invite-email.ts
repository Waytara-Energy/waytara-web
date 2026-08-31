import { Resend } from "resend";

export interface EmployeeInviteEmailInput {
  to: string;
  role: "admin" | "employee";
  token: string;
}

/**
 * Points at this app's own /invite/[token] acceptance flow (apps/admin's
 * (auth)/invite route already exists) — NEXT_PUBLIC_SITE_URL, not
 * CUSTOMER_APP_URL, since a staff invite is accepted here, not on the
 * customer app. Same non-fatal-if-unconfigured / explicit-error-check
 * pattern as every other Resend sender in this codebase.
 */
export async function sendEmployeeInviteEmail(input: EmployeeInviteEmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.warn("[send-employee-invite-email] RESEND_API_KEY not set — skipping send.");
    return;
  }

  const from = process.env.RESEND_FROM_EMAIL || "WayTara Energy <onboarding@resend.dev>";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3001";
  const inviteUrl = `${siteUrl}/invite/${input.token}`;

  const resend = new Resend(apiKey);

  try {
    const { error } = await resend.emails.send({
      from,
      to: input.to,
      subject: "You're invited to join WayTara Admin",
      text: [
        `Hi,`,
        ``,
        `You've been invited to join the WayTara staff panel as ${input.role === "admin" ? "an admin" : "an employee"}.`,
        `Set up your account:`,
        inviteUrl,
        ``,
        `This link expires in 7 days.`,
        `— The WayTara Team`,
      ].join("\n"),
    });

    if (error) {
      console.error("[send-employee-invite-email] Resend rejected the send:", error);
    }
  } catch (error) {
    console.error("[send-employee-invite-email] Resend send failed:", error);
  }
}
