import { Resend } from "resend";

export type SendResult = "sent" | "failed" | "suppressed";

/** Sends one device-status e-mail (already built by device-status-mail.ts). Same pattern as send-device-alert-email.ts: never throws, and
 *  `suppressed` means the sender is switched off (no RESEND_API_KEY, or DEVICE_ALERT_EMAILS=off), which the caller treats as "do not retry". */
export async function sendDeviceStatusEmail(to: string, mail: { subject: string; text: string; html: string }): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[send-device-status-email] RESEND_API_KEY not set - skipping send.");
    return "suppressed";
  }
  if ((process.env.DEVICE_ALERT_EMAILS ?? "on").toLowerCase() === "off") return "suppressed";

  const from = process.env.RESEND_FROM_EMAIL || "WayTara Energy <onboarding@resend.dev>";
  try {
    const { error } = await new Resend(apiKey).emails.send({ from, to, subject: mail.subject, text: mail.text, html: mail.html });
    if (error) {
      console.error("[send-device-status-email] Resend rejected the send:", error);
      return "failed";
    }
    return "sent";
  } catch (error) {
    console.error("[send-device-status-email] Resend send failed:", error);
    return "failed";
  }
}
