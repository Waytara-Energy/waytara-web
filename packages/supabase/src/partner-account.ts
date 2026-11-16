// Rules for a partner's own account that both the website (which creates it) and the admin app (which shows it) need. Pure, so they are tested.

/** The shortest password we accept when a partner sets one. */
export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 72;

/**
 * Why a password cannot be used (in words the partner reads), or null when it can. The sign-in service has its own rules too; this catches the common ones first, with
 * kinder words. It never sees the password again after the check, and never logs it.
 */
export function passwordProblem(password: string, confirm: string, email: string): string | null {
  if (password.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
  if (password.length > PASSWORD_MAX) return `Use at most ${PASSWORD_MAX} characters.`;
  if (password !== confirm) return "The two passwords are not the same.";
  const lower = password.toLowerCase();
  const local = email.toLowerCase().split("@")[0] ?? "";
  if (lower === email.toLowerCase() || (local.length >= 4 && lower.includes(local))) return "Do not use your e-mail address in your password.";
  if (/^(.)\1+$/.test(password) || /^(0123456789|1234567890|password\d*|qwertyuiop)$/i.test(password)) return "That password is too easy to guess. Choose another.";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "Use both letters and numbers.";
  return null;
}

/** How many days before a licence runs out that the partner is reminded. */
export const LICENCE_REMINDER_DAYS = 60;

export type LicenceState = "none" | "ok" | "soon" | "expired";

export interface LicenceStatus {
  state: LicenceState;
  /** Whole days until it runs out (negative once it has). Null when no date was given. */
  days: number | null;
}

/** Where a licence stands today, given its 'valid until' date (yyyy-mm-dd, the last day it is valid). `today` is a yyyy-mm-dd, so the answer does not depend on the clock's zone. */
export function licenceStatus(validUntil: string, today: string): LicenceStatus {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(validUntil)) return { state: "none", days: null };
  const days = Math.round((Date.parse(`${validUntil}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  if (Number.isNaN(days)) return { state: "none", days: null };
  return { state: days < 0 ? "expired" : days <= LICENCE_REMINDER_DAYS ? "soon" : "ok", days };
}

/** Today's date in India as yyyy-mm-dd (the partners are in Tamil Nadu). */
export function todayIst(now: Date = new Date()): string {
  return new Date(now.getTime() + 5.5 * 3_600_000).toISOString().slice(0, 10);
}
