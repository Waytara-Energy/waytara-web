// The e-mails of team invitations, in the quiet compact look and with as little text as will do. Pure, so the wording is tested and the routes only build the data and send.
//   invitation   to someone with no WayTara account yet: who invited them, what they get (a small table), and the button that opens the page where a code is sent to this address
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

/** What the person gets, as a small table: "Role / Operator", "Devices / 2 (you operate 1)", "Pages / 5". */
export function accessFacts(a: TeamAccessSummary): [string, string][] {
  const devices = `${a.deviceCount}${a.operateCount > 0 ? (a.operateCount === a.deviceCount ? " (you can operate " + (a.deviceCount === 1 ? "it" : "them") + ")" : ` (you can operate ${a.operateCount})`) : " (view only)"}`;
  const rows: [string, string][] = [
    ["Role", roleLabel(a.role)],
    ["Devices", devices],
    ["Pages", String(a.pageCount)],
  ];
  if (a.canSchedule) rows.push(["Scheduled reports", "You can manage them"]);
  return rows;
}

/** To a person with no account yet. Opening the button sends a code to this address; that, and a password they choose, is all it takes. */
export function buildTeamInviteMail(a: { memberName: string | null; ownerName: string; summary: TeamAccessSummary; link: string }): Mail {
  const owner = a.ownerName.trim() || "A WayTara customer";
  const { html, text } = renderMail({
    variant: "compact",
    preheader: `${owner} invited you to see their energy system on WayTara.`,
    title: `${owner} invited you to WayTara`,
    greeting: `Hi ${first(a.memberName)},`,
    blocks: [
      { type: "p", text: `${owner} added you to their team, so you can follow their energy system. This is what you get:` },
      { type: "facts", rows: accessFacts(a.summary) },
      { type: "note", text: `We will e-mail a 6-digit code to confirm it is you. The link works for ${TEAM_INVITE_DAYS} days, for this address only. Not expecting this? Ignore this e-mail.` },
    ],
    button: { label: "Accept invitation", url: a.link },
    why: "A WayTara customer entered your address to add you to their team.",
  });
  return { subject: `${owner} invited you to WayTara`, text, html };
}

/** To a person who already has a WayTara customer account: the access is added; they sign in as usual. */
export function buildTeamSharedMail(a: { memberName: string | null; ownerName: string; summary: TeamAccessSummary; signInUrl: string }): Mail {
  const owner = a.ownerName.trim() || "A WayTara customer";
  const { html, text } = renderMail({
    variant: "compact",
    preheader: `${owner} gave you access on WayTara.`,
    title: `${owner} added you to their team`,
    greeting: `Hi ${first(a.memberName)},`,
    blocks: [
      { type: "p", text: "You already have a WayTara account, so there is nothing to set up. Sign in as usual to see their system:" },
      { type: "facts", rows: accessFacts(a.summary) },
      { type: "note", text: "Not expecting this? Ignore this e-mail, or write to hello@waytaraenergy.com." },
    ],
    button: { label: "Sign in", url: a.signInUrl },
    why: "A WayTara customer added your account to their team.",
  });
  return { subject: `${owner} added you to their WayTara team`, text, html };
}

export function buildTeamCodeMail(memberName: string | null, code: string): Mail {
  const { html, text } = renderMail({
    variant: "compact",
    preheader: `Your WayTara code is ${code}.`,
    title: "Your WayTara code",
    greeting: `Hi ${first(memberName)},`,
    blocks: [
      { type: "p", text: "Enter this code on the WayTara page to confirm your e-mail address. It works for 10 minutes." },
      { type: "code", code },
      { type: "note", text: "Did not ask for it? Ignore this e-mail. No one can use it without your address." },
    ],
    why: "Someone invited this address to a WayTara team and the invitation was opened.",
  });
  return { subject: `${code} is your WayTara code`, text, html };
}

/** After the account is made: where to sign in. Never contains a password; if it was not them, they are told what to do. */
export function buildTeamWelcomeMail(a: { memberName: string | null; ownerName: string; signInUrl: string }): Mail {
  const owner = a.ownerName.trim() || "the account owner";
  const { html, text } = renderMail({
    variant: "compact",
    preheader: "Your WayTara account is ready.",
    title: "You are all set",
    greeting: `Hi ${first(a.memberName)},`,
    blocks: [
      { type: "p", text: `Sign in with this e-mail address and the password you chose to see the system ${owner} shared with you.` },
      { type: "note", text: "Did not create this account? Write to hello@waytaraenergy.com and we will close it." },
    ],
    button: { label: "Sign in", url: a.signInUrl },
    why: "An account was just created for this address on WayTara.",
  });
  return { subject: "Your WayTara account is ready", text, html };
}
