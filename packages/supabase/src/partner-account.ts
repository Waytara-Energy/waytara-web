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

/** The reminders a licence gets, as days left: at 60, at 30, at 7, and once it has run out (0). */
export const REMINDER_THRESHOLDS = [60, 30, 7, 0] as const;
export type ReminderThreshold = (typeof REMINDER_THRESHOLDS)[number];

/**
 * Which reminder a licence is due for today, or null when it is further than 60 days away (or has no date). It is the tightest one it has reached: 20 days left is the
 * 30-day reminder, 5 days left the 7-day one, a licence that has run out the final one. The caller sends it once (it remembers what it sent), so a licence first seen
 * late still gets one reminder, not three at once.
 */
export function reminderDue(days: number | null): ReminderThreshold | null {
  if (days === null) return null;
  if (days <= 0) return 0;
  if (days <= 7) return 7;
  if (days <= 30) return 30;
  if (days <= 60) return 60;
  return null;
}

/** What tells one licence from another for reminders: kind, number and valid-until date, so a renewal (new date) starts a fresh set. */
export const licenceReminderKey = (l: { type: string; number: string; validUntil: string }): string => `${l.type}|${l.number.toLowerCase()}|${l.validUntil}`;
