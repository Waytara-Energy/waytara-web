// The support e-mails (task: support v2): what each event says to the customer or to staff, and where its button leads. Pure, so the wording
// is tested and the mailer route only fetches and sends.

export type SupportKind =
  | "ticket_received"
  | "new_ticket"
  | "staff_reply"
  | "customer_reply"
  | "taken"
  | "reassigned"
  | "assigned_to_you"
  | "unassigned_from_you"
  | "resolved"
  | "closed"
  | "reopened"
  | "reopened_by_customer"
  | "closed_by_customer"
  | "rated";

/** What the queue row carries (see waytara.support_notifications.payload). */
export interface SupportPayload {
  actor_name?: string | null;
  assignee_name?: string | null;
  assignee_role?: string | null;
  previous_name?: string | null;
  preview?: string | null;
  rating?: number | null;
  comment?: string | null;
  site_name?: string | null;
  customer_name?: string | null;
  category?: string | null;
  self?: boolean | null;
}

export interface SupportMailInput {
  kind: SupportKind;
  /** the person it is for (first name is used in the greeting) */
  recipientName: string | null;
  ticketNo: number;
  subject: string;
  siteName: string | null;
  payload: SupportPayload;
  /** how many files came with the message (replies only) */
  attachments: number;
  /** where the button leads: the ticket in the customer's dashboard, or in the admin app */
  url: string;
}

export interface Mail {
  subject: string;
  text: string;
  html: string;
}

/** How a person on the team is described to a customer. */
export function roleLabel(role: string | null | undefined): string {
  return role === "site_engineer" ? "site installer" : role === "employee" ? "site employee" : role === "admin" ? "WayTara admin" : "WayTara team";
}

const CATEGORY_LABEL: Record<string, string> = { device: "Device or inverter", installation: "Installation", billing: "Billing", account: "Account", other: "Something else" };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const firstName = (name: string | null) => (name ?? "").trim().split(/\s+/)[0] ?? "";
const stars = (n: number) => `${"★".repeat(n)}${"☆".repeat(Math.max(0, 5 - n))}`;
const ref = (n: number) => `#${n}`;

interface Body {
  subject: string;
  /** one short sentence under the greeting */
  lead: string;
  /** a quoted message or comment, if any */
  quote?: { label: string; text: string };
  /** more plain lines */
  lines?: string[];
  button: string;
  /** why the person gets this e-mail */
  why: string;
}

function bodyFor(i: SupportMailInput): Body {
  const p = i.payload;
  const t = ref(i.ticketNo);
  const actor = p.actor_name?.trim() || "Someone";
  const assignee = p.assignee_name?.trim() || actor;
  const who = p.assignee_role ? `${assignee} (${roleLabel(p.assignee_role)})` : assignee;
  const files = i.attachments > 0 ? `${i.attachments} file${i.attachments === 1 ? "" : "s"} attached` : null;
  const where = i.siteName ? ` at ${i.siteName}` : "";
  const customerWhy = "You get this e-mail because you have a support ticket with WayTara.";
  const staffWhy = "You get this e-mail because you are on the team that looks after this site.";

  switch (i.kind) {
    case "ticket_received":
      return {
        subject: `We got your ticket ${t}: ${i.subject}`,
        lead: `We have your request${where}. Someone from the team will take it and reply here soon. We will e-mail you when that happens.`,
        quote: p.preview ? { label: "Your message", text: p.preview } : undefined,
        button: "View your ticket",
        why: customerWhy,
      };
    case "new_ticket":
      return {
        subject: `New support ticket ${t}: ${i.subject}${i.siteName ? ` (${i.siteName})` : ""}`,
        lead: `${p.customer_name?.trim() || "A customer"} opened a ticket${where}${p.category ? ` about: ${CATEGORY_LABEL[p.category] ?? p.category}` : ""}. Nobody has taken it yet: anyone on the team can.`,
        quote: p.preview ? { label: "Message", text: p.preview } : undefined,
        button: "Open the ticket",
        why: staffWhy,
      };
    case "staff_reply":
      return {
        subject: `${actor} replied to your ticket ${t}`,
        lead: `${actor} wrote to you about "${i.subject}".`,
        quote: p.preview ? { label: "Reply", text: p.preview } : undefined,
        lines: files ? [files] : undefined,
        button: "Read and reply",
        why: customerWhy,
      };
    case "customer_reply":
      return {
        subject: `${actor} replied on ticket ${t}: ${i.subject}`,
        lead: `${actor} wrote back${where}.`,
        quote: p.preview ? { label: "Message", text: p.preview } : undefined,
        lines: files ? [files] : undefined,
        button: "Open the ticket",
        why: staffWhy,
      };
    case "taken":
      return {
        subject: `${assignee} is now handling your ticket ${t}`,
        lead: `${who} has taken your ticket "${i.subject}" and will look into it.`,
        button: "View your ticket",
        why: customerWhy,
      };
    case "reassigned":
      return {
        subject: `Your ticket ${t} is now with ${assignee}`,
        lead: `Your ticket "${i.subject}" is now handled by ${who}${p.previous_name ? `, who took over from ${p.previous_name}` : ""}. You do not need to do anything: everything you wrote is still in the ticket.`,
        button: "View your ticket",
        why: customerWhy,
      };
    case "assigned_to_you":
      return {
        subject: `Ticket ${t} was assigned to you: ${i.subject}`,
        lead: `${actor} assigned this ticket${where} to you.`,
        button: "Open the ticket",
        why: staffWhy,
      };
    case "unassigned_from_you":
      return {
        subject: `Ticket ${t} moved to ${assignee}`,
        lead: `${actor} moved "${i.subject}" from you to ${assignee}. You do not need to do anything.`,
        button: "Open the ticket",
        why: staffWhy,
      };
    case "resolved":
      return {
        subject: `Your ticket ${t} was marked resolved`,
        lead: `${actor} marked "${i.subject}" as resolved. If it is fixed, you can close it and tell us how we did. If not, reopen it and we will carry on.`,
        button: "Close or reopen the ticket",
        why: customerWhy,
      };
    case "closed":
      return {
        subject: `Your ticket ${t} is closed`,
        lead: `${actor} closed "${i.subject}". We would love to know how we did: it takes a few seconds to rate.`,
        button: "Rate your experience",
        why: customerWhy,
      };
    case "reopened":
      return {
        subject: `Your ticket ${t} was reopened`,
        lead: `${actor} reopened "${i.subject}" to look at it again.`,
        button: "View your ticket",
        why: customerWhy,
      };
    case "reopened_by_customer":
      return {
        subject: `Ticket ${t} was reopened by the customer`,
        lead: `${actor} says "${i.subject}" is not resolved yet.`,
        button: "Open the ticket",
        why: staffWhy,
      };
    case "closed_by_customer":
      return {
        subject: `Ticket ${t} was closed by the customer${typeof p.rating === "number" ? `: ${p.rating} out of 5` : ""}`,
        lead: `${actor} closed "${i.subject}"${typeof p.rating === "number" ? ` and rated it ${stars(p.rating)} (${p.rating} out of 5)` : ""}.`,
        quote: p.comment ? { label: "Their comment", text: p.comment } : undefined,
        button: "Open the ticket",
        why: staffWhy,
      };
    case "rated":
      return {
        subject: `Ticket ${t} was rated ${typeof p.rating === "number" ? `${p.rating} out of 5` : ""}`.trim(),
        lead: `${actor} rated "${i.subject}" ${typeof p.rating === "number" ? `${stars(p.rating)} (${p.rating} out of 5)` : ""}.`.trim(),
        quote: p.comment ? { label: "Their comment", text: p.comment } : undefined,
        button: "Open the ticket",
        why: staffWhy,
      };
  }
}

/** One support e-mail: subject, plain text and HTML, with a button to the ticket. */
export function buildSupportEmail(input: SupportMailInput): Mail {
  const b = bodyFor(input);
  const hello = firstName(input.recipientName) ? `Hi ${firstName(input.recipientName)},` : "Hi,";
  const header = `Ticket ${ref(input.ticketNo)} · ${input.subject}`;

  const text = [hello, "", b.lead, ...(b.quote ? ["", `${b.quote.label}:`, `"${b.quote.text}"`] : []), ...(b.lines ? ["", ...b.lines] : []), "", `${b.button}: ${input.url}`, "", b.why, "- WayTara Support"].join("\n");

  const html = `<div style="font-family:Segoe UI,Arial,sans-serif;color:#0f172a;max-width:560px">
<p style="color:#64748b;font-size:12px;margin-bottom:4px">${esc(header)}</p>
<p>${esc(hello)}</p>
<p>${esc(b.lead)}</p>
${b.quote ? `<blockquote style="margin:12px 0;padding:8px 14px;border-left:3px solid #16a34a;background:#f1f5f9;color:#334155"><span style="font-size:12px;color:#64748b">${esc(b.quote.label)}</span><br>${esc(b.quote.text)}</blockquote>` : ""}
${b.lines ? b.lines.map((l) => `<p style="color:#475569;font-size:13px">${esc(l)}</p>`).join("") : ""}
<p><a href="${esc(input.url)}" style="background:#16a34a;color:#fff;padding:9px 16px;border-radius:8px;text-decoration:none;display:inline-block">${esc(b.button)}</a></p>
<p style="color:#64748b;font-size:12px">${esc(b.why)}<br>- The WayTara Team</p>
</div>`;
  return { subject: b.subject, text, html };
}

/** Where the button of an e-mail leads. */
export function ticketUrl(audience: "customer" | "staff", ticketId: string, urls: { customerApp: string; adminApp: string }): string {
  const trim = (u: string) => u.replace(/\/+$/, "");
  return audience === "customer" ? `${trim(urls.customerApp)}/dashboard/support/${ticketId}` : `${trim(urls.adminApp)}/support/${ticketId}`;
}
