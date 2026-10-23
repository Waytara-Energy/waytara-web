// The account activity list (Application Settings > Security and the Account tab): what each kind of event is called and how it reads.

export type AccountEventKind = "signin" | "signout" | "signout_idle" | "signout_limit" | "signout_closed" | "signout_others" | "signout_all" | "session_revoked" | "password_changed" | "email_changed" | "mfa_enabled" | "mfa_disabled";

export interface EventStyle {
  title: string;
  /** good: something the person does to be safe; info: ordinary; warn: worth a look if it was not them */
  tone: "good" | "info" | "warn";
}

const STYLE: Record<AccountEventKind, EventStyle> = {
  signin: { title: "Signed in", tone: "info" },
  signout: { title: "Signed out", tone: "info" },
  signout_idle: { title: "Signed out for being idle", tone: "info" },
  signout_limit: { title: "Signed out at the session time limit", tone: "info" },
  signout_closed: { title: "Signed out when the browser closed", tone: "info" },
  signout_others: { title: "Signed out the other devices", tone: "good" },
  signout_all: { title: "Signed out of every device", tone: "good" },
  session_revoked: { title: "A device was signed out", tone: "good" },
  password_changed: { title: "Password changed", tone: "warn" },
  email_changed: { title: "E-mail address changed", tone: "warn" },
  mfa_enabled: { title: "Two-factor sign-in turned on", tone: "good" },
  mfa_disabled: { title: "Two-factor sign-in turned off", tone: "warn" },
};

export const isAccountEventKind = (v: string): v is AccountEventKind => v in STYLE;
export const describeEvent = (kind: string): EventStyle => (isAccountEventKind(kind) ? STYLE[kind] : { title: kind.replace(/_/g, " "), tone: "info" });

/** "Chrome on Windows · Chennai, Tamil Nadu, IN · 103.21.4.18": the parts that are known. */
export const eventWhere = (e: { device: string | null; place: string | null; ip: string | null }): string => [e.device, e.place, e.ip].filter(Boolean).join(" · ");

/** How long account activity is kept: the person chooses (Application Settings > Privacy & data); 90 days unless they did. */
export const RETENTION_CHOICES: { days: number; label: string }[] = [
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
  { days: 365, label: "1 year" },
];
export const EVENT_RETENTION_DAYS = 90;
export const parseActivityDays = (raw: unknown): number => {
  const v = raw && typeof raw === "object" ? (raw as Record<string, unknown>).activity_days : undefined;
  return typeof v === "number" && RETENTION_CHOICES.some((c) => c.days === v) ? v : EVENT_RETENTION_DAYS;
};

/** What "Clear my history" removes: sign-ins and sign-outs. A changed password or e-mail and two-factor changes stay for the whole time, so that
 *  somebody who got into the account cannot wipe the trace of what they changed. */
export const CLEARABLE_KINDS: AccountEventKind[] = ["signin", "signout", "signout_idle", "signout_limit", "signout_closed", "signout_others", "signout_all", "session_revoked"];
export const isClearable = (kind: string): boolean => (CLEARABLE_KINDS as string[]).includes(kind);

/** "just now", "5 min ago", "3 h ago", "Yesterday, 4:10 pm", "12 Oct, 9:30 am": when an event happened, relative to `now` (passed in so a render never reads the clock). */
export function whenText(iso: string, now: number): string {
  const t = Date.parse(iso);
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)} h ago`;
  const clock = new Date(t).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });
  if (s < 2 * 86_400) return `Yesterday, ${clock}`;
  return `${new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })}, ${clock}`;
}
