import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
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

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const first = (name: string | null) => (name ?? "").trim().split(/\s+/)[0] ?? "";

/** The e-mail with the code, sent to the new address. */
export function buildEmailCodeMail(input: { name: string | null; code: string }): Mail {
  const hello = first(input.name) ? `Hi ${first(input.name)},` : "Hi,";
  const text = [hello, "", `Your WayTara verification code is ${input.code}.`, "", "Enter it in Application Settings to use this address for your account. It works for 10 minutes.", "", "If you did not ask for this, ignore this e-mail: nothing changes.", "- The WayTara Team"].join("\n");
  const html = `<div style="font-family:Segoe UI,Arial,sans-serif;color:#0f172a;max-width:520px">
<p>${esc(hello)}</p>
<p>Your WayTara verification code is:</p>
<p style="font-size:30px;letter-spacing:8px;font-weight:600;background:#f1f5f9;border-radius:10px;padding:12px 18px;display:inline-block;margin:4px 0">${esc(input.code)}</p>
<p style="color:#475569;font-size:13px">Enter it in Application Settings to use this address for your account. It works for 10 minutes.</p>
<p style="color:#64748b;font-size:12px">If you did not ask for this, ignore this e-mail: nothing changes.<br>- The WayTara Team</p>
</div>`;
  return { subject: `${input.code} is your WayTara verification code`, text, html };
}

/** The e-mail with the code for changing the password, sent to the account's own address. */
export function buildPasswordCodeMail(input: { name: string | null; code: string }): Mail {
  const hello = first(input.name) ? `Hi ${first(input.name)},` : "Hi,";
  const text = [hello, "", `Your WayTara code for changing your password is ${input.code}.`, "", "Enter it in Application Settings, with your new password. It works for 10 minutes. When the password changes, every device is signed out.", "", "If you did not ask for this, ignore this e-mail and your password stays as it is. If you keep getting these, change your password from the sign-in page.", "- The WayTara Team"].join("\n");
  const html = `<div style="font-family:Segoe UI,Arial,sans-serif;color:#0f172a;max-width:520px">
<p>${esc(hello)}</p>
<p>Your WayTara code for changing your password is:</p>
<p style="font-size:30px;letter-spacing:8px;font-weight:600;background:#f1f5f9;border-radius:10px;padding:12px 18px;display:inline-block;margin:4px 0">${esc(input.code)}</p>
<p style="color:#475569;font-size:13px">Enter it in Application Settings, with your new password. It works for 10 minutes. When the password changes, every device is signed out.</p>
<p style="color:#64748b;font-size:12px">If you did not ask for this, ignore this e-mail and your password stays as it is.<br>- The WayTara Team</p>
</div>`;
  return { subject: `${input.code} is your WayTara password code`, text, html };
}

/** The notice to the OLD address once the e-mail has changed. */
export function buildEmailChangedMail(input: { name: string | null; newEmail: string }): Mail {
  const hello = first(input.name) ? `Hi ${first(input.name)},` : "Hi,";
  const text = [hello, "", `The e-mail address of your WayTara account was changed to ${input.newEmail}.`, "", "If this was not you, contact WayTara support straight away.", "- The WayTara Team"].join("\n");
  const html = `<div style="font-family:Segoe UI,Arial,sans-serif;color:#0f172a;max-width:520px">
<p>${esc(hello)}</p>
<p>The e-mail address of your WayTara account was changed to <strong>${esc(input.newEmail)}</strong>.</p>
<p style="color:#475569;font-size:13px">If this was not you, contact WayTara support straight away.</p>
<p style="color:#64748b;font-size:12px">- The WayTara Team</p>
</div>`;
  return { subject: "The e-mail address of your WayTara account was changed", text, html };
}
