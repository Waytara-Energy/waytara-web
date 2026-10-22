// The e-mails WayTara can send a customer, grouped the way the person sees them in Application Settings, and how a stored choice is read.
// Kept in profiles.notification_preferences as one true/false per key. A key never chosen takes its default; an account that switched
// "alert e-mails" off before these categories existed (email_alerts: false) keeps that choice for the device, fault and tariff e-mails.

export type NotificationKey =
  | "auth_signin"
  | "auth_signout"
  | "device_offline"
  | "device_online"
  | "faults"
  | "alarms"
  | "tariff"
  | "support_emails";

export interface NotificationItem {
  key: NotificationKey;
  title: string;
  description: string;
  default: boolean;
}

export interface NotificationCategory {
  id: "account" | "devices" | "faults" | "billing" | "support";
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
      { key: "device_offline", title: "Device offline", description: "When a device stops reporting, and a reminder while it stays offline.", default: true },
      { key: "device_online", title: "Back online", description: "When a device that was offline reports again.", default: true },
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
const LEGACY_ALERT_KEYS: readonly NotificationKey[] = ["device_offline", "device_online", "faults", "alarms", "tariff"];

const asObject = (raw: unknown): Record<string, unknown> => (raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {});

/** Does this person want this e-mail? Their own choice if they made one, else the old alert switch for the keys it covered, else the default. */
export function wants(raw: unknown, key: NotificationKey): boolean {
  const o = asObject(raw);
  if (typeof o[key] === "boolean") return o[key] as boolean;
  if (LEGACY_ALERT_KEYS.includes(key) && o.email_alerts === false) return false;
  return DEFAULTS[key];
}

export function resolveNotificationPrefs(raw: unknown): Record<NotificationKey, boolean> {
  return Object.fromEntries(NOTIFICATION_KEYS.map((k) => [k, wants(raw, k)])) as Record<NotificationKey, boolean>;
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
  if (kind === "offline") return event === "resolved" ? "device_online" : "device_offline";
  return kind === "fault" ? "faults" : "alarms";
}

/** Which switch a line of the device status digest belongs to. */
export function digestKey(kind: "offline" | "still_offline" | "back_online"): NotificationKey {
  return kind === "back_online" ? "device_online" : "device_offline";
}
