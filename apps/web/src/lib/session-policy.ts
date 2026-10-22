// How long a signed-in browser may sit untouched before it is signed out, and what that sign-out covers. Chosen in Application Settings,
// kept in profiles.security_preferences, enforced by the dashboard's inactivity watcher.

export const IDLE_OPTIONS: { minutes: number | null; label: string; hint: string }[] = [
  { minutes: null, label: "Stay signed in", hint: "Never signed out for being idle" },
  { minutes: 15, label: "15 minutes", hint: "For shared or public computers" },
  { minutes: 30, label: "30 minutes", hint: "" },
  { minutes: 60, label: "1 hour", hint: "" },
  { minutes: 240, label: "4 hours", hint: "" },
  { minutes: 1440, label: "1 day", hint: "" },
];

export type IdleScope = "device" | "all";

export interface SessionPolicy {
  /** idle minutes before sign-out; null keeps the session alive all the time */
  idleMinutes: number | null;
  /** whether the sign-out covers only the idle device, or every device */
  scope: IdleScope;
}

export const DEFAULT_SESSION_POLICY: SessionPolicy = { idleMinutes: null, scope: "device" };

const ALLOWED = IDLE_OPTIONS.map((o) => o.minutes);

export function parseSessionPolicy(raw: unknown): SessionPolicy {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const minutes = typeof o.idle_minutes === "number" && ALLOWED.includes(o.idle_minutes) ? o.idle_minutes : null;
  return { idleMinutes: minutes, scope: o.idle_scope === "all" ? "all" : "device" };
}

export const policyToJson = (p: SessionPolicy): { idle_minutes: number | null; idle_scope: IdleScope } => ({ idle_minutes: p.idleMinutes, idle_scope: p.scope });

/** Has the browser been idle for longer than the policy allows? `lastActivity` is when it was last touched (ms), null when never recorded. */
export function idleExpired(lastActivity: number | null, now: number, idleMinutes: number | null): boolean {
  if (idleMinutes === null || lastActivity === null) return false;
  return now - lastActivity >= idleMinutes * 60_000;
}
