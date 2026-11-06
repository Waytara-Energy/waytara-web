// The two e-mails a partner application sends: one to the admins ("a new application"), one to the applicant ("we got it"). Pure, so the wording is
// tested and the API route only builds the data and sends.

import { PARTNER_SERVICE_LABEL } from "./partner-options";
import type { Mail } from "./support-mail";
import { renderMail } from "@waytara/ui/mail-layout";

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

const trimSlash = (s: string) => s.replace(/\/+$/, "");
const serviceNames = (ids: string[]) => ids.map((id) => PARTNER_SERVICE_LABEL[id] ?? id);

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
  const { html, text } = renderMail({
    preheader: `${a.company_name} applied to partner with WayTara.`,
    title: "New partner application",
    blocks: [
      { type: "p", text: `${a.company_name} applied to partner with WayTara.` },
      { type: "facts", rows: shown },
      ...(a.message ? ([{ type: "quote", label: "Message", text: a.message }] as const) : []),
    ],
    button: { label: "Open the application", url },
    why: "You get this e-mail because you are on the team that looks after partner applications.",
    audience: "team",
    adminUrl: adminAppUrl,
  });
  return { subject: `New partner application: ${a.company_name}`, text, html };
}

/** To the applicant: we have it, and what happens next. No promise about timing or approval. */
export function buildPartnerAckMail(contactName: string, companyName: string): Mail {
  const first = contactName.trim().split(/\s+/)[0] || "there";
  const { html, text } = renderMail({
    preheader: "We have your application and will be in touch.",
    title: "We have your application",
    greeting: `Hi ${first},`,
    blocks: [
      { type: "p", text: `Thank you for applying to partner with WayTara. We have the details for ${companyName}.` },
      { type: "p", text: "Our team will review your application and get in touch on the phone number or e-mail you gave us. Applying does not guarantee a partnership, and we may ask for more information first." },
    ],
    why: "You get this e-mail because you applied to partner with WayTara.",
    audience: "public",
  });
  return { subject: "We received your WayTara partner application", text, html };
}
