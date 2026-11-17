// The e-mails of team invitations. Pure, so the wording is tested and the routes only build the data and send.
//   invitation   to someone with no WayTara account yet: who invited them, what they can do, and the button that opens the page where a code is sent to this very address
//   shared       to someone who already has a WayTara customer account: access was added, sign in
//   code         the 6-digit code that confirms the address
//   welcome      after the account is made: where to sign in (never a password)

import type { Mail } from "./support-mail";
import { renderMail } from "@waytara/ui/mail-layout";
import { TEAM_INVITE_DAYS, roleLabel } from "@waytara/supabase/team";

const first = (name: string | null | undefined) => (name ?? "").trim().split(/\s+/)[0] || "there";

export interface TeamAccessSummary {
  role: string;
  deviceCount: number;
  operateCount: number;
  pageCount: number;
  canSchedule: boolean;
}

/** "view 2 devices and operate 1 of them, on 5 pages, and manage scheduled reports": the same plain sentence in the e-mail as the owner saw when they chose it. */
export function accessSentence(a: TeamAccessSummary): string {
  const devices = `${a.deviceCount} ${a.deviceCount === 1 ? "device" : "devices"}`;
  const operate = a.operateCount > 0 ? (a.operateCount === a.deviceCount ? " and operate " + (a.deviceCount === 1 ? "it" : "them") : ` and operate ${a.operateCount} of them`) : "";
  const pages = `${a.pageCount} ${a.pageCount === 1 ? "page" : "pages"} of the dashboard`;
  return `You can view ${devices}${operate}, on ${pages}${a.canSchedule ? ", and manage the scheduled reports" : ""}.`;
}

/** To a person with no account yet. Opening the button sends a code to this address; that, and a password they choose, is all it takes. */
export function buildTeamInviteMail(a: { memberName: string | null; ownerName: string; summary: TeamAccessSummary; link: string }): Mail {
  const owner = a.ownerName.trim() || "A WayTara customer";
  const { html, text } = renderMail({
    preheader: `${owner} invited you to see their energy system on WayTara.`,
    title: `${owner} invited you to WayTara`,
    greeting: `Hi ${first(a.memberName)},`,
    blocks: [
      { type: "p", text: `${owner} has added you to their WayTara team, so you can see their integrated energy system (solar, battery and EV charging) and experience how WayTara runs it.` },
      { type: "p", text: `Your role: ${roleLabel(a.summary.role)}. ${accessSentence(a.summary)}` },
      { type: "p", text: `Open the page below. We send a 6-digit code to this e-mail address to confirm it is yours, then you choose a password. The link works for ${TEAM_INVITE_DAYS} days and only for this address.` },
      { type: "note", text: "If you do not know this person, ignore this e-mail and nothing happens." },
    ],
    button: { label: "Accept the invitation", url: a.link },
    why: "You get this e-mail because a WayTara customer entered your address to add you to their team.",
    audience: "public",
  });
  return { subject: `${owner} invited you to WayTara`, text, html };
}

/** To a person who already has a WayTara customer account: the access is added; they sign in as usual. */
export function buildTeamSharedMail(a: { memberName: string | null; ownerName: string; summary: TeamAccessSummary; signInUrl: string }): Mail {
  const owner = a.ownerName.trim() || "A WayTara customer";
  const { html, text } = renderMail({
    preheader: `${owner} gave you access on WayTara.`,
    title: `${owner} added you to their team`,
    greeting: `Hi ${first(a.memberName)},`,
    blocks: [
      { type: "p", text: `${owner} has added you to their WayTara team. You already have a WayTara account, so there is nothing to set up: sign in as usual and you will see their system.` },
      { type: "p", text: `Your role: ${roleLabel(a.summary.role)}. ${accessSentence(a.summary)}` },
      { type: "note", text: "If you do not know this person, you can ignore this e-mail, or tell us at hello@waytaraenergy.com." },
    ],
    button: { label: "Sign in to WayTara", url: a.signInUrl },
    why: "You get this e-mail because a WayTara customer added your account to their team.",
    audience: "public",
  });
  return { subject: `${owner} added you to their WayTara team`, text, html };
}

export function buildTeamCodeMail(memberName: string | null, code: string): Mail {
  const { html, text } = renderMail({
    preheader: `Your WayTara code is ${code}.`,
    title: `Your code is ${code}`,
    greeting: `Hi ${first(memberName)},`,
    blocks: [
      { type: "p", text: "Type this code on the WayTara page to confirm your e-mail address. It works for 10 minutes." },
      { type: "p", text: "If you did not ask for it, ignore this e-mail. No one can use it without your address." },
    ],
    why: "You get this e-mail because someone invited this address to a WayTara team and the invitation was opened.",
    audience: "public",
  });
  return { subject: `${code} is your WayTara code`, text, html };
}

/** After the account is made: where to sign in. Never contains a password; if it was not them, they are told what to do. */
export function buildTeamWelcomeMail(a: { memberName: string | null; ownerName: string; signInUrl: string }): Mail {
  const owner = a.ownerName.trim() || "the account owner";
  const { html, text } = renderMail({
    preheader: "Your WayTara account is ready.",
    title: "Your WayTara account is ready",
    greeting: `Hi ${first(a.memberName)},`,
    blocks: [
      { type: "p", text: `You can now sign in to WayTara with this e-mail address and the password you chose, and see the system ${owner} shared with you.` },
      { type: "note", text: "If you did not create this account, write to hello@waytaraenergy.com and we will close it." },
    ],
    button: { label: "Sign in to WayTara", url: a.signInUrl },
    why: "You get this e-mail because an account was just created for this address on WayTara.",
    audience: "public",
  });
  return { subject: "Your WayTara account is ready", text, html };
}
