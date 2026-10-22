import { Resend } from "resend";
import type { Mail } from "./support-mail";

export type SendResult = "sent" | "failed" | "suppressed";

/** Sends one support e-mail (built by support-mail.ts). Never throws; `suppressed` means the sender is switched off (no RESEND_API_KEY, or
 *  SUPPORT_EMAILS=off), which the caller treats as "do not retry". Same pattern as send-device-status-email.ts. */
export async function sendSupportEmail(to: string, mail: Mail): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[send-support-email] RESEND_API_KEY not set - skipping send.");
    return "suppressed";
  }
  if ((process.env.SUPPORT_EMAILS ?? "on").toLowerCase() === "off") return "suppressed";

  const from = process.env.RESEND_FROM_EMAIL || "WayTara Energy <onboarding@resend.dev>";
  try {
    const { error } = await new Resend(apiKey).emails.send({ from, to, subject: mail.subject, text: mail.text, html: mail.html });
    if (error) {
      console.error("[send-support-email] Resend rejected the send:", error);
      return "failed";
    }
    return "sent";
  } catch (error) {
    console.error("[send-support-email] Resend send failed:", error);
    return "failed";
  }
}
