import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { renderMail } from "@waytara/ui/mail-layout";
import type { Mail } from "./support-mail";

// Proving a new e-mail address is the person's: a 6-digit code goes to the NEW address, and only entering it changes the account's e-mail.
// The code is kept hashed (keyed to the person and the address), lives 10 minutes, allows 5 wrong tries and 1 resend a minute. Server only.

export const CODE_TTL_MS = 10 * 60_000;
export const MAX_ATTEMPTS = 5;
export const RESEND_COOLDOWN_MS = 60_000;

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const normaliseEmail = (v: string): string => v.trim().toLowerCase();

export const generateCode = (): string => String(randomInt(0, 1_000_000)).padStart(6, "0");

export function hashCode(secret: string, userId: string, email: string, code: string): string {
  return createHmac("sha256", secret).update(`${userId}\n${normaliseEmail(email)}\n${code}`).digest("hex");
}

export function codeMatches(secret: string, userId: string, email: string, code: string, storedHash: string): boolean {
  const a = Buffer.from(hashCode(secret, userId, email, code.trim()), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export const codeExpired = (expiresAt: string, now: number): boolean => Date.parse(expiresAt) <= now;
export const canResend = (createdAt: string, now: number): boolean => now - Date.parse(createdAt) >= RESEND_COOLDOWN_MS;
export const secondsUntilResend = (createdAt: string, now: number): number => Math.max(0, Math.ceil((RESEND_COOLDOWN_MS - (now - Date.parse(createdAt))) / 1000));

const first = (name: string | null) => (name ?? "").trim().split(/\s+/)[0] ?? "";
const hello = (name: string | null) => (first(name) ? `Hi ${first(name)},` : "Hi,");

/** The e-mail with the code, sent to the new address. */
export function buildEmailCodeMail(input: { name: string | null; code: string }): Mail {
  const { html, text } = renderMail({
    preheader: "Enter this code in Settings to use this address. It works for 10 minutes.",
    title: "Your verification code",
    greeting: hello(input.name),
    blocks: [
      { type: "p", text: "Enter this code in Application Settings to use this address for your WayTara account. It works for 10 minutes." },
      { type: "code", code: input.code },
      { type: "note", text: "If you did not ask for this, ignore this e-mail: nothing changes." },
    ],
    why: "You get this e-mail because someone asked to use this address for a WayTara account.",
    audience: "public",
  });
  return { subject: `${input.code} is your WayTara verification code`, text, html };
}

/** The e-mail with the code for changing the password, sent to the account's own address. */
export function buildPasswordCodeMail(input: { name: string | null; code: string }): Mail {
  const { html, text } = renderMail({
    preheader: "Your password code works for 10 minutes.",
    title: "Your password code",
    greeting: hello(input.name),
    blocks: [
      { type: "p", text: "Use this code to change the password of your WayTara account. It works for 10 minutes, and once. When the password changes, every device is signed out." },
      { type: "code", code: input.code },
      { type: "note", text: "If you did not ask for this, ignore this e-mail and your password stays as it is." },
    ],
    why: "You get this e-mail because someone asked to change the password of your WayTara account.",
    audience: "public",
  });
  return { subject: `${input.code} is your WayTara password code`, text, html };
}

/** The notice to the OLD address once the e-mail has changed. */
export function buildEmailChangedMail(input: { name: string | null; newEmail: string }): Mail {
  const { html, text } = renderMail({
    preheader: "The e-mail address of your WayTara account was changed.",
    title: "Your e-mail address was changed",
    greeting: hello(input.name),
    blocks: [
      { type: "p", text: `The e-mail address of your WayTara account was changed to ${input.newEmail}.` },
      { type: "note", text: "If this was not you, contact WayTara support straight away." },
    ],
    why: "You get this e-mail because the address of your WayTara account was changed.",
    audience: "public",
  });
  return { subject: "The e-mail address of your WayTara account was changed", text, html };
}
