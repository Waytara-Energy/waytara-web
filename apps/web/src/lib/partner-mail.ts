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

/** To the admins: an applicant has sent their onboarding (details and documents) and it is waiting to be verified. */
export function buildPartnerSubmittedAdminMail(a: { id: string; reference: string; company_name: string; partner_type: string; documents: number }, adminAppUrl: string): Mail {
  const url = `${trimSlash(adminAppUrl)}/partners/${a.id}`;
  const kind = PARTNER_TYPE_LABEL[a.partner_type] ?? a.partner_type;
  const { html, text } = renderMail({
    preheader: `${a.company_name} sent their onboarding. It is ready to verify.`,
    title: "Onboarding sent for verification",
    blocks: [
      { type: "p", text: `${a.company_name} has sent their business details and documents, and the application has moved to Verification.` },
      {
        type: "facts",
        rows: [
          ["Reference", a.reference],
          ["Applying as", kind],
          ["Documents sent", String(a.documents)],
        ],
      },
    ],
    button: { label: "Open the application", url },
    why: "You get this e-mail because you are on the team that looks after partner applications.",
    audience: "team",
    adminUrl: adminAppUrl,
  });
  return { subject: `Onboarding sent: ${a.company_name} (${a.reference})`, text, html };
}

/** To the applicant, once they have sent their onboarding: it is with us, what happens next, and no promise about the outcome. No link: they already have theirs. */
export function buildPartnerSubmittedAckMail(contactName: string, reference: string): Mail {
  const first = contactName.trim().split(/\s+/)[0] || "there";
  const { html, text } = renderMail({
    preheader: `We have your onboarding details. Your reference is ${reference}.`,
    title: "We have your onboarding details",
    greeting: `Hi ${first},`,
    blocks: [
      { type: "p", text: "We have your business details and documents, and our team will now verify them. We will write with the outcome, and may ask for something more first." },
      { type: "facts", rows: [["Reference", reference]] },
      { type: "p", text: "We use your documents only to verify you, and share them with no one outside WayTara. Sending them does not guarantee a partnership or any projects." },
    ],
    why: "You get this e-mail because you applied to join the WayTara Partner Network.",
    audience: "public",
  });
  return { subject: `We received your onboarding details (${reference})`, text, html };
}

/** To the partnerships team: a message from a partner or an applicant. the caller sends it with the sender's address as Reply-To. */
export function buildPartnerMessageMail(a: { name: string; email: string; company: string; reference: string | null; subject: string; message: string; adminUrl: string; applicationId: string }): Mail {
  const { html, text } = renderMail({
    preheader: `${a.company}: ${a.subject}`,
    title: "Message from a partner",
    blocks: [
      {
        type: "facts",
        rows: [
          ["From", `${a.name} (${a.company})`],
          ["E-mail", a.email],
          ...(a.reference ? ([["Reference", a.reference]] as [string, string][]) : []),
          ["Subject", a.subject],
        ],
      },
      { type: "quote", label: "Message", text: a.message },
    ],
    button: { label: "Open the partner", url: `${trimSlash(a.adminUrl)}/partners/${a.applicationId}` },
    why: "You get this e-mail because you are on the team that looks after partners. Reply to answer them directly.",
    audience: "team",
    adminUrl: a.adminUrl,
  });
  return { subject: `Partner message: ${a.subject} (${a.company})`, text, html };
}

/** To an approved partner: one or more licences have run out or are about to. Short: which ones and when, and one button to renew. */
export function buildLicenceReminderMail(contactName: string, licences: { label: string; number: string; days: number }[], portalUrl: string): Mail {
  const first = contactName.trim().split(/\s+/)[0] || "there";
  const expired = licences.some((l) => l.days <= 0);
  const when = (d: number) => (d < 0 ? `expired ${Math.abs(d)} day${Math.abs(d) === 1 ? "" : "s"} ago` : d === 0 ? "runs out today" : `runs out in ${d} day${d === 1 ? "" : "s"}`);
  const { html, text } = renderMail({
    preheader: expired ? "A licence of yours has run out." : "A licence of yours is about to run out.",
    title: expired ? "A licence needs renewing" : "A licence runs out soon",
    greeting: `Hi ${first},`,
    blocks: [
      { type: "p", text: "Please renew it and send us the new document." },
      { type: "facts", rows: licences.map((l): [string, string] => [`${l.label} ${l.number}`, when(l.days)]) },
    ],
    button: { label: "Update your licences", url: portalUrl },
    why: "You get this e-mail because you are a WayTara partner and your licence date is on file.",
    audience: "public",
  });
  return { subject: expired ? "A WayTara partner licence has run out" : "A WayTara partner licence runs out soon", text, html };
}

/** The 6-digit code that proves the address is theirs. Short on purpose: the code, how long it lasts, and what to do if it was not them. */
export function buildPartnerCodeMail(contactName: string, code: string): Mail {
  const first = contactName.trim().split(/\s+/)[0] || "there";
  const { html, text } = renderMail({
    preheader: `Your WayTara code is ${code}.`,
    title: `Your code is ${code}`,
    greeting: `Hi ${first},`,
    blocks: [
      { type: "p", text: "Type this code on the WayTara page to confirm your e-mail address. It works for 10 minutes." },
      { type: "p", text: "If you did not ask for it, ignore this e-mail. No one can use it without your address." },
    ],
    why: "You get this e-mail because you applied to join the WayTara Partner Network.",
    audience: "public",
  });
  return { subject: `${code} is your WayTara code`, text, html };
}

/** To a partner who has just created their account: it exists, where to sign in. Never contains a password. A safety net too: if it was not them, they are told what to do. */
export function buildPartnerAccountMail(contactName: string, signInUrl: string): Mail {
  const first = contactName.trim().split(/\s+/)[0] || "there";
  const { html, text } = renderMail({
    preheader: "Your WayTara partner account is ready.",
    title: "Your partner account is ready",
    greeting: `Hi ${first},`,
    blocks: [
      { type: "p", text: "Sign in with this e-mail address and the password you chose." },
      { type: "p", text: "If you did not create this account, reply to this e-mail and we will close it." },
    ],
    button: { label: "Sign in", url: signInUrl },
    why: "You get this e-mail because an account was created for this address in the WayTara Partner Network.",
    audience: "public",
  });
  return { subject: "Your WayTara partner account is ready", text, html };
}

/**
 * To the applicant: we have it, their reference, and that our team will call them. No button and no link: nothing is asked of them until the screening call is done,
 * and the onboarding link is sent only then. No promise about timing, projects or approval.
 */
export function buildPartnerAckMail(contactName: string, reference: string): Mail {
  const first = contactName.trim().split(/\s+/)[0] || "there";
  const { html, text } = renderMail({
    preheader: `We have your application. Your reference is ${reference}.`,
    title: "We have your application",
    greeting: `Hi ${first},`,
    blocks: [
      { type: "p", text: "Thank you for applying to the WayTara Partner Network. Our partnerships team will call you on the number you gave us. You do not need to do anything now." },
      { type: "facts", rows: [["Reference", reference]] },
      { type: "p", text: "Please keep the reference to hand for the call. Applying does not guarantee a partnership or any projects." },
    ],
    why: "You get this e-mail because you applied to join the WayTara Partner Network.",
    audience: "public",
  });
  return { subject: `We received your WayTara partner application (${reference})`, text, html };
}
