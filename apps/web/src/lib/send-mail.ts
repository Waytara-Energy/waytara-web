import "server-only";
import { Resend } from "resend";
import type { Mail } from "./support-mail";

export type MailResult = "sent" | "failed" | "suppressed";

/** A file to attach (a PDF, say). */
export interface MailAttachment {
  filename: string;
  content: Buffer;
}

/** Sends one e-mail through Resend. Never throws. `suppressed` means no RESEND_API_KEY is set (nothing was sent). */
export async function sendMail(to: string, mail: Mail, attachments?: MailAttachment[]): Promise<MailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[send-mail] RESEND_API_KEY not set - nothing sent.");
    return "suppressed";
  }
  const from = process.env.RESEND_FROM_EMAIL || "WayTara Energy <onboarding@resend.dev>";
  try {
    const { error } = await new Resend(apiKey).emails.send({ from, to, subject: mail.subject, text: mail.text, html: mail.html, ...(attachments?.length ? { attachments } : {}) });
    if (error) {
      console.error("[send-mail] Resend rejected the send:", error);
      return "failed";
    }
    return "sent";
  } catch (error) {
    console.error("[send-mail] Resend send failed:", error);
    return "failed";
  }
}
