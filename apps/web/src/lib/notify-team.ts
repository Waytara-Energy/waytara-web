import { renderMail } from "@waytara/ui/mail-layout";
import { sendMail } from "./send-mail";

// Deliberately not the full `leads` Row type: the `anon` role that inserts
// these can't SELECT afterward (by design — see the migration), so the
// route never reads the row back. This is just what's needed for the email.
export interface Lead {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  message: string | null;
  address: { city?: string; pincode?: string } | null;
  source: string;
}

/**
 * Notifies the WayTara team by e-mail when a new lead comes in from any of the website's forms. Non-fatal by design: if e-mail is not set up or the send
 * fails, this logs and returns rather than throwing: the lead is already saved in `leads` by the time this runs, which matters more than the notification.
 */
export async function notifyTeamOfNewLead(lead: Lead): Promise<void> {
  const to = process.env.LEADS_NOTIFICATION_EMAIL || "hello@waytaraenergy.com";

  const address =
    lead.address && typeof lead.address === "object"
      ? Object.entries(lead.address as Record<string, unknown>)
          .filter(([, v]) => v)
          .map(([k, v]) => `${k}: ${v}`)
          .join(", ")
      : null;

  const rows: [string, string][] = [
    ["Name", lead.full_name],
    ["E-mail", lead.email],
  ];
  if (lead.phone) rows.push(["Phone", lead.phone]);
  if (address) rows.push(["Address", address]);
  rows.push(["Source", lead.source ?? "unknown"]);

  const adminUrl = (process.env.ADMIN_APP_URL || "https://admin.waytaraenergy.com").replace(/\/+$/, "");
  const { html, text } = renderMail({
    preheader: `${lead.full_name} sent a request from the website.`,
    title: `New lead: ${lead.full_name}`,
    blocks: [
      { type: "p", text: "A new request came in from the website." },
      { type: "facts", rows },
      ...(lead.message ? ([{ type: "quote", label: "Message", text: lead.message }] as const) : []),
      { type: "note", text: `Lead ID: ${lead.id}` },
    ],
    button: { label: "Open the leads", url: `${adminUrl}/leads` },
    why: "You get this e-mail because you are on the team that looks after new leads.",
    audience: "team",
    adminUrl,
  });

  const result = await sendMail(to, { subject: `New lead: ${lead.full_name}`, text, html });
  if (result === "failed") console.error("[notify-team] the new-lead e-mail could not be sent for lead", lead.id);
}
