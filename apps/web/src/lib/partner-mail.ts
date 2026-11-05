// The two e-mails a partner application sends: one to the admins ("a new application"), one to the applicant ("we got it"). Pure, so the wording is
// tested and the API route only builds the data and sends.

import { PARTNER_SERVICE_LABEL } from "./partner-options";
import type { Mail } from "./support-mail";

export interface PartnerApplicationMail {
  id: string;
  company_name: string;
  contact_name: string;
  phone: string;
  email: string;
  website?: string | null;
  states: string[];
  cities?: string | null;
  services: string[];
  years_in_business?: number | null;
  installs_completed?: string | null;
  team_size?: string | null;
  certifications?: string | null;
  message?: string | null;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const trimSlash = (s: string) => s.replace(/\/+$/, "");
const serviceNames = (ids: string[]) => ids.map((id) => PARTNER_SERVICE_LABEL[id] ?? id);

function shell(heading: string, bodyHtml: string, button?: { label: string; url: string }, foot?: string): string {
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f1e14">
<h2 style="margin:0 0 16px;font-size:18px">${esc(heading)}</h2>
${bodyHtml}
${button ? `<p style="margin:24px 0"><a href="${esc(button.url)}" style="background:#16a34a;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600;display:inline-block">${esc(button.label)}</a></p>` : ""}
${foot ? `<p style="color:#667;font-size:12px;margin-top:24px">${esc(foot)}</p>` : ""}
</div>`;
}

/** To the admins: who applied and how to open the application. */
export function buildPartnerAdminMail(a: PartnerApplicationMail, adminAppUrl: string): Mail {
  const url = `${trimSlash(adminAppUrl)}/partners/${a.id}`;
  const rows: [string, string | null][] = [
    ["Company", a.company_name],
    ["Contact", a.contact_name],
    ["Phone", a.phone],
    ["E-mail", a.email],
    ["Website", a.website || null],
    ["Works in", a.states.length ? a.states.join(", ") : null],
    ["Cities", a.cities || null],
    ["Services", a.services.length ? serviceNames(a.services).join(", ") : null],
    ["Years in business", a.years_in_business != null ? String(a.years_in_business) : null],
    ["Installations so far", a.installs_completed || null],
    ["Team size", a.team_size || null],
    ["Certifications", a.certifications || null],
  ];
  const shown = rows.filter((r): r is [string, string] => Boolean(r[1]));
  const text = [
    `A new partner application came in from ${a.company_name}.`,
    "",
    ...shown.map(([k, v]) => `${k}: ${v}`),
    ...(a.message ? ["", "Message:", a.message] : []),
    "",
    `Open it: ${url}`,
  ].join("\n");
  const table = `<table style="border-collapse:collapse;width:100%;font-size:14px">${shown
    .map(([k, v]) => `<tr><td style="padding:6px 12px 6px 0;color:#667;vertical-align:top;white-space:nowrap">${esc(k)}</td><td style="padding:6px 0">${esc(v)}</td></tr>`)
    .join("")}</table>${a.message ? `<p style="margin:16px 0 4px;color:#667;font-size:13px">Message</p><p style="margin:0;white-space:pre-wrap;font-size:14px">${esc(a.message)}</p>` : ""}`;
  return {
    subject: `New partner application: ${a.company_name}`,
    text,
    html: shell("New partner application", `<p style="margin:0 0 12px;font-size:14px">${esc(a.company_name)} applied to partner with WayTara.</p>${table}`, { label: "Open the application", url }, "You get this because you are on the WayTara admin team."),
  };
}

/** To the applicant: we have it, and what happens next. No promise about timing or approval. */
export function buildPartnerAckMail(contactName: string, companyName: string): Mail {
  const first = contactName.trim().split(/\s+/)[0] || "there";
  const text = [
    `Hi ${first},`,
    "",
    `Thank you for applying to partner with WayTara. We have the details for ${companyName}.`,
    "",
    "Our team will review your application and get in touch on the phone number or e-mail you gave us. Applying does not guarantee a partnership, and we may ask for more information first.",
    "",
    "WayTara Energy",
  ].join("\n");
  const html = shell(
    "We have your application",
    `<p style="font-size:14px">Hi ${esc(first)},</p>
<p style="font-size:14px">Thank you for applying to partner with WayTara. We have the details for ${esc(companyName)}.</p>
<p style="font-size:14px">Our team will review your application and get in touch on the phone number or e-mail you gave us. Applying does not guarantee a partnership, and we may ask for more information first.</p>`,
    undefined,
    "WayTara Energy",
  );
  return { subject: "We received your WayTara partner application", text, html };
}
