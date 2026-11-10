import { Resend } from "resend";
import { MAIL_REPLY_TO, renderMail } from "@waytara/ui/mail-layout";

export interface EmployeeInviteEmailInput {
  to: string;
  role: "admin" | "employee" | "site_engineer";
  token: string;
}

const ROLE_COPY: Record<EmployeeInviteEmailInput["role"], string> = {
  admin: "an admin",
  employee: "an employee",
  site_engineer: "a site engineer",
};

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
    const { html, text } = renderMail({
      preheader: "You have been invited to the WayTara staff panel.",
      title: "You're invited to join WayTara Admin",
      greeting: "Hi,",
      blocks: [
        { type: "p", text: `You have been invited to join the WayTara staff panel as ${ROLE_COPY[input.role]}.` },
        { type: "note", text: "This link expires in 7 days." },
      ],
      button: { label: "Set up your account", url: inviteUrl },
      why: "You get this e-mail because a WayTara admin invited you.",
      audience: "team",
      adminUrl: siteUrl && !/localhost/.test(siteUrl) ? siteUrl : undefined,
    });
    const { error } = await resend.emails.send({
      from,
      to: input.to,
      replyTo: MAIL_REPLY_TO,
      subject: "You're invited to join WayTara Admin",
      text,
      html,
    });

    if (error) {
      console.error("[send-employee-invite-email] Resend rejected the send:", error);
    }
  } catch (error) {
    console.error("[send-employee-invite-email] Resend send failed:", error);
  }
}
