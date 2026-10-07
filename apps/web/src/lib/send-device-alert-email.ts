import { Resend } from "resend";
import { buildAlertEmail, type AlertEmailInput } from "./device-alerts";

/** E-mails the customer about something that happened to one of their devices (it went offline, reported a fault or an
 *  alarm, or recovered). Same non-fatal-if-unconfigured, explicit-error-check pattern as every other Resend sender in
 *  this codebase: a failed e-mail never breaks the alert check - the alert itself is already saved. Returns whether
 *  Resend accepted the message. */
export async function sendDeviceAlertEmail(to: string, input: Omit<AlertEmailInput, "dashboardUrl">): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[send-device-alert-email] RESEND_API_KEY not set - skipping send.");
    return false;
  }
  // A switch to stop all device e-mails without a deploy (for example while testing against real customers).
  if ((process.env.DEVICE_ALERT_EMAILS ?? "on").toLowerCase() === "off") return false;

  const from = process.env.RESEND_FROM_EMAIL || "WayTara Energy <onboarding@resend.dev>";
  const dashboardUrl = `${process.env.CUSTOMER_APP_URL || "https://www.waytaraenergy.com"}/dashboard`;
  const { subject, text, html } = buildAlertEmail({ ...input, dashboardUrl });

  try {
    const { error } = await new Resend(apiKey).emails.send({ from, to, subject, text, html });
    if (error) {
      console.error("[send-device-alert-email] Resend rejected the send:", error);
      return false;
    }
    return true;
  } catch (error) {
    console.error("[send-device-alert-email] Resend send failed:", error);
    return false;
  }
}
