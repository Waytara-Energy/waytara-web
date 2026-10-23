// The e-mails WayTara can send a customer, grouped the way the person sees them in Application Settings, and how a stored choice is read.
// Kept in profiles.notification_preferences as one true/false per key. A key never chosen takes its default; an account that switched
// "alert e-mails" off before these categories existed (email_alerts: false) keeps that choice for the device, fault and tariff e-mails.

export type NotificationKey =
  | "auth_signin"
  | "auth_signout"
  | "network_lost"
  | "device_offline"
  | "device_online"
  | "faults"
  | "alarms"
  | "tariff"
  | "support_emails"
  | "rule_alerts";

export interface NotificationItem {
  key: NotificationKey;
  title: string;
  description: string;
  default: boolean;
}

export interface NotificationCategory {
  id: "account" | "devices" | "faults" | "alerts" | "billing" | "support";
  title: string;
  description: string;
  items: NotificationItem[];
  /** Notices that are always sent and cannot be switched off (shown, not toggled). */
  always?: { title: string; description: string }[];
}

export const NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  {
    id: "account",
    title: "Account & security",
    description: "Know when someone uses your account.",
    items: [
      { key: "auth_signin", title: "Signed in", description: "An e-mail each time your account is signed in, with the device, the place and the time, so you can spot anyone who should not be there.", default: true },
      { key: "auth_signout", title: "Signed out", description: "An e-mail when a device is signed out: you signing out, a device you ended from Settings, or being signed out for being idle.", default: false },
    ],
    always: [{ title: "Password or e-mail changed", description: "We always tell you when the password or the e-mail address of your account changes." }],
  },
  {
    id: "devices",
    title: "Devices",
    description: "Whether your inverter and charger are reachable.",
    items: [
      { key: "network_lost", title: "Network connection lost", description: "When your monitoring unit stops reaching WayTara (its Wi-Fi or internet is down, or it lost power), with a reminder while it stays down.", default: true },
      { key: "device_offline", title: "Inverter not answering", description: "When the monitoring unit is online but cannot read your inverter, with a reminder while it lasts.", default: true },
      { key: "device_online", title: "Back online", description: "When a unit or inverter that was down reports again.", default: true },
    ],
  },
  {
    id: "faults",
    title: "Faults & alarms",
    description: "What your inverter reports about itself.",
    items: [
      { key: "faults", title: "Fault e-mails", description: "When the inverter raises a fault, with reminders until it clears and a note when it does.", default: true },
      { key: "alarms", title: "Alarm e-mails", description: "When the inverter raises an alarm (a warning that is not yet a fault).", default: true },
    ],
  },
  {
    id: "alerts",
    title: "My alerts",
    description: "Alerts you set up yourself, and the ready-made ones for your battery, solar, grid, consumption and cost (below).",
    items: [{ key: "rule_alerts", title: "E-mail for my alerts", description: "An e-mail when one of your alerts goes off. Each alert also has its own e-mail and app choices below.", default: true }],
  },
  {
    id: "billing",
    title: "Billing & plan",
    description: "Changes that affect what you pay.",
    items: [{ key: "tariff", title: "Tariff changes", description: "When the electricity rate for your state and type of property changes.", default: true }],
  },
  {
    id: "support",
    title: "Support",
    description: "Help from the WayTara team.",
    items: [{ key: "support_emails", title: "Ticket updates", description: "When the team takes your ticket, replies, or resolves it. We skip a reply e-mail if you already read it in the app.", default: true }],
  },
];

export const NOTIFICATION_KEYS: NotificationKey[] = NOTIFICATION_CATEGORIES.flatMap((c) => c.items.map((i) => i.key));
const DEFAULTS = Object.fromEntries(NOTIFICATION_CATEGORIES.flatMap((c) => c.items.map((i) => [i.key, i.default]))) as Record<NotificationKey, boolean>;

/** The keys the old single "alert e-mails" switch covered. */
const LEGACY_ALERT_KEYS: readonly NotificationKey[] = ["network_lost", "device_offline", "device_online", "faults", "alarms", "tariff"];

const asObject = (raw: unknown): Record<string, unknown> => (raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {});

/** The e-mails that still arrive while notifications are paused: they are about the security of the account. */
const NEVER_PAUSED: readonly NotificationKey[] = ["auth_signin", "auth_signout"];

/** When notifications were paused until (epoch ms), or null when they are not paused (or the pause is over). */
export function pausedUntil(raw: unknown, nowMs: number = Date.now()): number | null {
  const v = asObject(raw).paused_until;
  const t = typeof v === "string" ? Date.parse(v) : NaN;
  return Number.isFinite(t) && t > nowMs ? t : null;
}

/** Does this person want this e-mail? While notifications are paused nothing but the security e-mails; otherwise their own choice if they made
 *  one, else the old alert switch for the keys it covered, else the default. */
export function wants(raw: unknown, key: NotificationKey, nowMs: number = Date.now()): boolean {
  if (pausedUntil(raw, nowMs) !== null && !NEVER_PAUSED.includes(key)) return false;
  const o = asObject(raw);
  if (typeof o[key] === "boolean") return o[key] as boolean;
  if (LEGACY_ALERT_KEYS.includes(key) && o.email_alerts === false) return false;
  return DEFAULTS[key];
}

/** The person's switches as they set them (a pause is not applied here: it is shown and changed on its own). */
export function resolveNotificationPrefs(raw: unknown): Record<NotificationKey, boolean> {
  const unpaused = { ...asObject(raw), paused_until: null };
  return Object.fromEntries(NOTIFICATION_KEYS.map((k) => [k, wants(unpaused, k)])) as Record<NotificationKey, boolean>;
}

/** The stored value after a save: the other keys of the column are kept, the known keys are replaced, and the old `email_alerts` is kept in
 *  step (true while any alert e-mail is on) for anything that still reads it. */
export function mergeNotificationPrefs(raw: unknown, values: Record<NotificationKey, boolean>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...asObject(raw) };
  for (const k of NOTIFICATION_KEYS) out[k] = !!values[k];
  out.email_alerts = LEGACY_ALERT_KEYS.some((k) => values[k]);
  return out;
}

/** Which switch a device alert e-mail (from the alert cron) belongs to. */
export function alertKey(kind: "offline" | "fault" | "alarm", event: "opened" | "reminder" | "resolved"): NotificationKey {
  // a device that went silent is, from the alert job's side, a lost network connection (the unit stopped checking in)
  if (kind === "offline") return event === "resolved" ? "device_online" : "network_lost";
  return kind === "fault" ? "faults" : "alarms";
}

/** Which switch a line of the device status digest belongs to: coming back is one switch; going down is the network (the monitoring unit stopped
 *  checking in) unless the unit is online and only the inverter is not answering. */
export function digestKey(kind: "offline" | "still_offline" | "back_online", cause: "offline" | "device_unreachable" | null = null): NotificationKey {
  if (kind === "back_online") return "device_online";
  return cause === "device_unreachable" ? "device_offline" : "network_lost";
}
