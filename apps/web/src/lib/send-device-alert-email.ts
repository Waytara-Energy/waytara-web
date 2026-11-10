import { sendMail } from "./send-mail";
import { buildAlertEmail, type AlertEmailInput } from "./device-alerts";

/** E-mails the customer about something that happened to one of their devices (it went offline, reported a fault or an
 *  alarm, or recovered). A failed e-mail never breaks the alert check - the alert itself is already saved. Returns whether
 *  the message was accepted. */
export async function sendDeviceAlertEmail(to: string, input: Omit<AlertEmailInput, "dashboardUrl">): Promise<boolean> {
  // A switch to stop all device e-mails without a deploy (for example while testing against real customers).
  if ((process.env.DEVICE_ALERT_EMAILS ?? "on").toLowerCase() === "off") return false;
  const dashboardUrl = `${process.env.CUSTOMER_APP_URL || "https://www.waytaraenergy.com"}/dashboard`;
  return (await sendMail(to, buildAlertEmail({ ...input, dashboardUrl }))) === "sent";
}
