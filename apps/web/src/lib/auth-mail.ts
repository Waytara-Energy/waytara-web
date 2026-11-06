import { renderMail } from "@waytara/ui/mail-layout";
import type { Mail } from "./support-mail";

// The account-security e-mails: someone signed in, a device was signed out, the password changed. Pure, so the wording is tested; the sender
// (auth-notify.ts) works out who, where and when. Each says what happened, on which device, and what to do if it was not the person.

export type AuthKind = "signin" | "signout" | "signout_idle" | "signout_limit" | "signout_closed" | "signout_others" | "signout_all" | "session_revoked" | "password_changed" | "mfa_enabled" | "mfa_disabled";

export interface AuthMailInput {
  kind: AuthKind;
  name: string | null;
  /** "Chrome on Windows" */
  device: string;
  /** "Chennai, Tamil Nadu, IN" when the host tells us, else null */
  place: string | null;
  ip: string | null;
  whenMs: number;
  /** where the button leads: Settings > Account & security */
  url: string;
  /** for session_revoked: the device that was signed out */
  target?: string | null;
}

const first = (name: string | null) => (name ?? "").trim().split(/\s+/)[0] ?? "";

export const istText = (ms: number): string => new Date(ms + 19_800_000).toLocaleString("en-IN", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true }) + " IST";

interface Body {
  subject: string;
  lead: string;
  worry: string;
  button: string;
}

function bodyFor(i: AuthMailInput): Body {
  switch (i.kind) {
    case "signin":
      return { subject: "New sign-in to your WayTara account", lead: "Your WayTara account was just signed in.", worry: "If this was you, there is nothing to do. If not, change your password and sign out of all devices now.", button: "Review your devices" };
    case "signout":
      return { subject: "You signed out of WayTara", lead: "This device was signed out of your WayTara account.", worry: "If this was not you, someone may have access to your account: change your password.", button: "Review your devices" };
    case "signout_idle":
      return { subject: "You were signed out of WayTara", lead: "This device was signed out of your WayTara account because it was idle for the time you chose.", worry: "You can change how long that is in Settings.", button: "Open Settings" };
    case "signout_limit":
      return { subject: "You were signed out of WayTara at your session limit", lead: "This device was signed out of your WayTara account because the session reached the time limit you chose.", worry: "You can change the limit in Settings.", button: "Open Settings" };
    case "signout_closed":
      return { subject: "You were signed out of WayTara when the browser closed", lead: "This device was signed out of your WayTara account because the browser was closed, as you chose.", worry: "You can change that in Settings.", button: "Open Settings" };
    case "signout_others":
      return { subject: "Your other devices were signed out of WayTara", lead: "All the other devices were signed out of your WayTara account. This one stayed signed in.", worry: "If this was not you, change your password now.", button: "Review your devices" };
    case "signout_all":
      return { subject: "You were signed out of WayTara everywhere", lead: "Every device was signed out of your WayTara account.", worry: "If this was not you, change your password now.", button: "Open Settings" };
    case "session_revoked":
      return { subject: "A device was signed out of your WayTara account", lead: `${i.target ? `${i.target} was` : "A device was"} signed out of your WayTara account.`, worry: "If this was not you, change your password now.", button: "Review your devices" };
    case "mfa_enabled":
      return { subject: "Two-factor sign-in is on for your WayTara account", lead: "Two-factor sign-in was turned on for your WayTara account. From now on, signing in needs a code from your authenticator app as well as your password.", worry: "If this was not you, contact WayTara support straight away.", button: "Review your security" };
    case "mfa_disabled":
      return { subject: "Two-factor sign-in was turned off for your WayTara account", lead: "Two-factor sign-in was turned off for your WayTara account. Signing in needs only your password again.", worry: "If this was not you, change your password and contact WayTara support straight away.", button: "Review your security" };
    case "password_changed":
      return { subject: "Your WayTara password was changed", lead: "The password of your WayTara account was changed.", worry: "If this was not you, contact WayTara support straight away.", button: "Open Settings" };
  }
}

export function buildAuthEmail(input: AuthMailInput): Mail {
  const b = bodyFor(input);
  const facts: [string, string][] = [["Device", input.device], ...(input.place ? ([["Place", input.place]] as [string, string][]) : []), ...(input.ip ? ([["Address", input.ip]] as [string, string][]) : []), ["Time", istText(input.whenMs)]];
  const { html, text } = renderMail({
    preheader: b.lead,
    title: b.subject,
    greeting: first(input.name) ? `Hi ${first(input.name)},` : "Hi,",
    blocks: [
      { type: "p", text: b.lead },
      { type: "facts", rows: facts },
      { type: "note", text: b.worry },
    ],
    button: { label: b.button, url: input.url },
    why: "You can choose which of these e-mails you get in Settings > Notifications.",
    audience: "customer",
  });
  return { subject: b.subject, text, html };
}
