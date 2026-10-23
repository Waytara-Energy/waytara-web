// When a signed-in browser is signed out by itself, chosen in Application Settings, kept in profiles.security_preferences and enforced by the
// dashboard's session watcher (components/dashboard/idle-sign-out.tsx):
//   - after it sits idle for a time (a preset or a time of the person's own), with an optional warning and a way to stay,
//   - when the session reaches a most time (however busy the person is),
//   - when the browser is closed,
// and whether the idle and time-limit sign-outs cover only that device or every device.

export const MIN_IDLE_MINUTES = 5;
export const MAX_IDLE_MINUTES = 43_200; // 30 days
export const MIN_SESSION_MINUTES = 60;
export const MAX_SESSION_MINUTES = 129_600; // 90 days

export const IDLE_OPTIONS: { minutes: number | null; label: string; hint: string }[] = [
  { minutes: null, label: "Never", hint: "Stay signed in until you sign out" },
  { minutes: 5, label: "5 minutes", hint: "For a shared screen" },
  { minutes: 15, label: "15 minutes", hint: "For shared or public computers" },
  { minutes: 30, label: "30 minutes", hint: "" },
  { minutes: 60, label: "1 hour", hint: "" },
  { minutes: 240, label: "4 hours", hint: "" },
  { minutes: 1440, label: "1 day", hint: "" },
  { minutes: 10_080, label: "1 week", hint: "" },
];

export const WARN_OPTIONS: { seconds: number; label: string }[] = [
  { seconds: 0, label: "No warning" },
  { seconds: 30, label: "30 seconds" },
  { seconds: 60, label: "1 minute" },
  { seconds: 300, label: "5 minutes" },
];

export const SESSION_LIMIT_OPTIONS: { minutes: number | null; label: string; hint: string }[] = [
  { minutes: null, label: "No limit", hint: "A session lasts until you sign out" },
  { minutes: 480, label: "8 hours", hint: "A working day" },
  { minutes: 1440, label: "1 day", hint: "" },
  { minutes: 10_080, label: "7 days", hint: "" },
  { minutes: 43_200, label: "30 days", hint: "" },
];

export type IdleScope = "device" | "all";

export interface SessionPolicy {
  /** idle minutes before sign-out; null keeps the session alive all the time */
  idleMinutes: number | null;
  /** whether the sign-out covers only the device, or every device */
  scope: IdleScope;
  /** how many seconds before an idle sign-out a "still there?" warning appears (0: none) */
  warnSeconds: number;
  /** the most minutes a session may last from the moment this browser signed in, whatever the activity; null for no limit */
  maxSessionMinutes: number | null;
  /** sign this browser out when it is closed */
  signOutOnClose: boolean;
}

export const DEFAULT_SESSION_POLICY: SessionPolicy = { idleMinutes: null, scope: "device", warnSeconds: 0, maxSessionMinutes: null, signOutOnClose: false };

const WARN_ALLOWED = WARN_OPTIONS.map((o) => o.seconds);
const wholeIn = (v: unknown, lo: number, hi: number): number | null => (typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi ? v : null);

export function parseSessionPolicy(raw: unknown): SessionPolicy {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    idleMinutes: wholeIn(o.idle_minutes, MIN_IDLE_MINUTES, MAX_IDLE_MINUTES),
    scope: o.idle_scope === "all" ? "all" : "device",
    warnSeconds: typeof o.warn_seconds === "number" && WARN_ALLOWED.includes(o.warn_seconds) ? o.warn_seconds : 0,
    maxSessionMinutes: wholeIn(o.max_session_minutes, MIN_SESSION_MINUTES, MAX_SESSION_MINUTES),
    signOutOnClose: o.sign_out_on_close === true,
  };
}

export const policyToJson = (
  p: SessionPolicy,
): { idle_minutes: number | null; idle_scope: IdleScope; warn_seconds: number; max_session_minutes: number | null; sign_out_on_close: boolean } => ({
  idle_minutes: p.idleMinutes,
  idle_scope: p.scope,
  warn_seconds: p.warnSeconds,
  max_session_minutes: p.maxSessionMinutes,
  sign_out_on_close: p.signOutOnClose,
});

/** Does the policy ask the watcher to do anything at all? */
export const policyActive = (p: SessionPolicy): boolean => p.idleMinutes !== null || p.maxSessionMinutes !== null || p.signOutOnClose;

/** Has the browser been idle for longer than the policy allows? `lastActivity` is when it was last touched (ms), null when never recorded. */
export function idleExpired(lastActivity: number | null, now: number, idleMinutes: number | null): boolean {
  if (idleMinutes === null || lastActivity === null) return false;
  return now - lastActivity >= idleMinutes * 60_000;
}

/** Has the session lasted longer than its most time? `startedAt` is when this browser's session was first seen (ms). */
export function sessionExpired(startedAt: number | null, now: number, maxMinutes: number | null): boolean {
  if (maxMinutes === null || startedAt === null) return false;
  return now - startedAt >= maxMinutes * 60_000;
}

/** The warning is never longer than half the idle time (a 5-minute idle limit with a 5-minute warning would warn at once). */
export const effectiveWarnSeconds = (warnSeconds: number, idleMinutes: number | null): number => (idleMinutes === null ? 0 : Math.min(warnSeconds, Math.floor((idleMinutes * 60) / 2)));

/** Seconds left before the idle sign-out while inside the warning time, otherwise null (no warning to show). */
export function warningSecondsLeft(lastActivity: number | null, now: number, idleMinutes: number | null, warnSeconds: number): number | null {
  const warn = effectiveWarnSeconds(warnSeconds, idleMinutes);
  if (idleMinutes === null || lastActivity === null || warn <= 0) return null;
  const left = idleMinutes * 60_000 - (now - lastActivity);
  return left > 0 && left <= warn * 1000 ? Math.ceil(left / 1000) : null;
}

/** "1 day", "90 minutes", "2 hours": a number of minutes in the person's words. */
export function minutesText(minutes: number): string {
  if (minutes % 1440 === 0) return `${minutes / 1440} ${minutes === 1440 ? "day" : "days"}`;
  if (minutes % 60 === 0) return `${minutes / 60} ${minutes === 60 ? "hour" : "hours"}`;
  return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
}

/** The whole policy in a sentence each, for the summary under the settings. */
export function describePolicy(p: SessionPolicy): string[] {
  const where = p.scope === "all" ? "every device" : "that device";
  const lines: string[] = [];
  if (p.idleMinutes !== null) lines.push(`Signed out of ${where} after ${minutesText(p.idleMinutes)} with no activity${p.warnSeconds > 0 ? `, with a warning ${effectiveWarnSeconds(p.warnSeconds, p.idleMinutes)} seconds before` : ""}.`);
  if (p.maxSessionMinutes !== null) lines.push(`Signed out of ${where} ${minutesText(p.maxSessionMinutes)} after signing in, however busy you are.`);
  if (p.signOutOnClose) lines.push("Signed out when the browser is closed.");
  if (lines.length === 0) lines.push("You stay signed in until you sign out yourself.");
  return lines;
}
