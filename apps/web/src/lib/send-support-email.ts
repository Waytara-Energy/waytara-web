import { sendMail } from "./send-mail";
import type { Mail } from "./support-mail";

export type SendResult = "sent" | "failed" | "suppressed";

/** Sends one support e-mail (built by support-mail.ts). Never throws; `suppressed` means the sender is switched off (no RESEND_API_KEY, or
 *  SUPPORT_EMAILS=off), which the caller treats as "do not retry". */
export async function sendSupportEmail(to: string, mail: Mail): Promise<SendResult> {
  if ((process.env.SUPPORT_EMAILS ?? "on").toLowerCase() === "off") return "suppressed";
  return sendMail(to, mail);
}
