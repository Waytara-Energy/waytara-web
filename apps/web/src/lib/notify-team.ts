import { Resend } from "resend";

// Deliberately not the full `leads` Row type: the `anon` role that inserts
// these can't SELECT afterward (by design — see the migration), so the
// route never reads the row back. This is just what's needed for the email.
interface Lead {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  message: string | null;
  address: { city?: string; pincode?: string } | null;
  source: string;
}

/**
 * Notifies the WayTara team by email when a new lead comes in via the
 * public quote-request form. Non-fatal by design: if RESEND_API_KEY isn't
 * set (e.g. local dev without a Resend account) or the send fails, this
 * logs and returns rather than throwing — the lead is already saved in
 * `leads` by the time this runs, which matters more than the notification.
 */
export async function notifyTeamOfNewLead(lead: Lead): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.warn(
      "[notify-team] RESEND_API_KEY not set — skipping team notification email for lead",
      lead.id
    );
    return;
  }

  const to = process.env.LEADS_NOTIFICATION_EMAIL || "contactus@waytaraenergy.com";
  const from = process.env.RESEND_FROM_EMAIL || "WayTara Leads <onboarding@resend.dev>";

  const resend = new Resend(apiKey);

  const address =
    lead.address && typeof lead.address === "object"
      ? Object.entries(lead.address as Record<string, unknown>)
          .filter(([, v]) => v)
          .map(([k, v]) => `${k}: ${v}`)
          .join(", ")
      : null;

  try {
    await resend.emails.send({
      from,
      to,
      subject: `New lead: ${lead.full_name}`,
      text: [
        `New quote request from the landing page.`,
        ``,
        `Name: ${lead.full_name}`,
        `Email: ${lead.email}`,
        lead.phone ? `Phone: ${lead.phone}` : null,
        address ? `Address: ${address}` : null,
        `Source: ${lead.source ?? "unknown"}`,
        ``,
        lead.message ? `Message:\n${lead.message}` : null,
        ``,
        `Lead ID: ${lead.id}`,
      ]
        .filter((line) => line !== null)
        .join("\n"),
    });
  } catch (error) {
    console.error("[notify-team] Resend send failed for lead", lead.id, error);
  }
}
