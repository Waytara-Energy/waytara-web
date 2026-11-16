// The two e-mails a partner application sends: one to the admins ("a new application"), one to the applicant ("we got it", with their reference). Pure, so
// the wording is tested and the API route only builds the data and sends.

import { PARTNER_TYPE_LABEL } from "./partner-network";
import type { Mail } from "./support-mail";
import { renderMail } from "@waytara/ui/mail-layout";

export interface PartnerApplicationMail {
  id: string;
  /** WTP-YYMM-XXXXX */
  reference: string;
  partner_type: string;
  /** The business, or a technician's own name. */
  company_name: string;
  contact_name: string;
  phone: string;
  email: string;
  /** The main district and any others they cover. */
  district: string;
  otherDistricts: string[];
  /** The questions of their kind and what they answered. */
  answers: { q: string; a: string }[];
  message?: string | null;
}

const trimSlash = (s: string) => s.replace(/\/+$/, "");

/** To the admins: who applied, as which kind of partner, their answers, and how to open the application. */
export function buildPartnerAdminMail(a: PartnerApplicationMail, adminAppUrl: string): Mail {
  const url = `${trimSlash(adminAppUrl)}/partners/${a.id}`;
  const kind = PARTNER_TYPE_LABEL[a.partner_type] ?? a.partner_type;
  const rows: [string, string | null][] = [
    ["Reference", a.reference],
    ["Applying as", kind],
    [a.partner_type === "technician" ? "Name" : "Company", a.company_name],
    ...(a.partner_type === "technician" ? [] : ([["Contact", a.contact_name]] as [string, string][])),
    ["Phone", a.phone],
    ["E-mail", a.email],
    ["Main district", a.district],
    ["Also covers", a.otherDistricts.length ? a.otherDistricts.join(", ") : null],
    ...a.answers.map((x): [string, string] => [x.q, x.a]),
  ];
  const shown = rows.filter((r): r is [string, string] => Boolean(r[1]));
  const { html, text } = renderMail({
    preheader: `${a.company_name} applied to join the WayTara Partner Network as ${kind.toLowerCase()}.`,
    title: "New partner application",
    blocks: [
      { type: "p", text: `${a.company_name} applied to join the WayTara Partner Network as ${kind.toLowerCase()}.` },
      { type: "facts", rows: shown },
      ...(a.message ? ([{ type: "quote", label: "Message", text: a.message }] as const) : []),
    ],
    button: { label: "Open the application", url },
    why: "You get this e-mail because you are on the team that looks after partner applications.",
    audience: "team",
    adminUrl: adminAppUrl,
  });
  return { subject: `New partner application ${a.reference}: ${a.company_name} (${kind})`, text, html };
}

/** To the applicant: we have it, their reference, and what happens next. No promise about timing, projects or approval. */
export function buildPartnerAckMail(contactName: string, reference: string): Mail {
  const first = contactName.trim().split(/\s+/)[0] || "there";
  const { html, text } = renderMail({
    preheader: `We have your application. Your reference is ${reference}.`,
    title: "We have your application",
    greeting: `Hi ${first},`,
    blocks: [
      { type: "p", text: "Thank you for registering your interest in joining the WayTara Partner Network. We have received your initial application." },
      { type: "facts", rows: [["Application reference", reference]] },
      { type: "p", text: "Our partnerships team will review your details and contact you about the next steps. Applicants who are shortlisted receive a personal, secure link to submit their business information, technical capabilities and supporting credentials." },
      { type: "p", text: "This is a partner registration, not a job application. Applying does not guarantee a partnership or any projects, and project allocation depends on verification, capability and availability." },
    ],
    why: "You get this e-mail because you applied to join the WayTara Partner Network.",
    audience: "public",
  });
  return { subject: `We received your WayTara partner application (${reference})`, text, html };
}
