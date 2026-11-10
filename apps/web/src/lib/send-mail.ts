import "server-only";
import { Resend } from "resend";
import { MAIL_REPLY_TO } from "@waytara/ui/mail-layout";
import type { Mail } from "./support-mail";

export type MailResult = "sent" | "failed" | "suppressed";

/** A file to attach (a PDF, say). */
export interface MailAttachment {
  filename: string;
  content: Buffer;
}

const TEST_SENDER = "WayTara Energy <onboarding@resend.dev>";
let warnedAboutSender = false;

/**
 * Sends one e-mail through Resend. Every e-mail the customer app sends goes through here, so the sender, the Reply-To and the "nothing is set up" rule are
 * decided in one place. Never throws. `suppressed` means no RESEND_API_KEY is set (nothing was sent).
 *
 * The sender is RESEND_FROM_EMAIL. Without it the message goes out as Resend's test address, which only delivers to the Resend account's owner, so that is
 * logged once per server in production. Replies go to REPLY_TO_EMAIL, or hello@waytaraenergy.com.
 */
export async function sendMail(to: string | string[], mail: Mail, attachments?: MailAttachment[]): Promise<MailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[send-mail] RESEND_API_KEY not set - nothing sent.");
    return "suppressed";
  }
  const configured = process.env.RESEND_FROM_EMAIL;
  if (!configured && process.env.NODE_ENV === "production" && !warnedAboutSender) {
    warnedAboutSender = true;
    console.error("[send-mail] RESEND_FROM_EMAIL is not set: e-mail is going out from Resend's test address and will only reach the Resend account owner.");
  }
  const from = configured || TEST_SENDER;
  const replyTo = process.env.REPLY_TO_EMAIL || MAIL_REPLY_TO;
  try {
    const { error } = await new Resend(apiKey).emails.send({ from, to, replyTo, subject: mail.subject, text: mail.text, html: mail.html, ...(attachments?.length ? { attachments } : {}) });
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
