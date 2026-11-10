import { sendMail } from "./send-mail";

export type SendResult = "sent" | "failed" | "suppressed";

/** Sends one device-status e-mail (already built by device-status-mail.ts). Never throws, and `suppressed` means the sender is
 *  switched off (no RESEND_API_KEY, or DEVICE_ALERT_EMAILS=off), which the caller treats as "do not retry". */
export async function sendDeviceStatusEmail(to: string, mail: { subject: string; text: string; html: string }): Promise<SendResult> {
  if ((process.env.DEVICE_ALERT_EMAILS ?? "on").toLowerCase() === "off") return "suppressed";
  return sendMail(to, mail);
}
