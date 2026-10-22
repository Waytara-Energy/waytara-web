import "server-only";
import { headers } from "next/headers";
import { after } from "next/server";
import { buildAuthEmail, type AuthKind } from "./auth-mail";
import { wants, type NotificationKey } from "./notification-prefs";
import { sendMail } from "./send-mail";
import { describeDevice } from "./user-agent";

/** Who an account e-mail is for (the fields of the person's profile it needs). */
export interface AuthPerson {
  email: string | null;
  full_name: string | null;
  notification_preferences: unknown;
}

/** Which switch in Settings > Notifications controls the e-mail; null means it is always sent. */
const SWITCH: Record<AuthKind, NotificationKey | null> = {
  signin: "auth_signin",
  signout: "auth_signout",
  signout_idle: "auth_signout",
  signout_others: "auth_signout",
  signout_all: "auth_signout",
  session_revoked: "auth_signout",
  password_changed: null,
};

const decode = (v: string | null): string | null => {
  if (!v) return null;
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
};

/** Where and on what the request came from: the browser, the address, and the place when the host (Vercel) tells us. Read before `after`. */
async function requestContext(): Promise<{ device: string; place: string | null; ip: string | null }> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
  const place = [decode(h.get("x-vercel-ip-city")), decode(h.get("x-vercel-ip-country-region")), h.get("x-vercel-ip-country")].filter(Boolean).join(", ") || null;
  return { device: describeDevice(h.get("user-agent")).label, place, ip };
}

/**
 * E-mails the person about something that happened to their account (a sign-in, a sign-out, a changed password), if their notification
 * settings allow it. It runs after the response is sent, so it never slows the page down, and it never throws. Call it from a server
 * action or route handler, after the event itself succeeded.
 */
export async function notifyAuthEvent(kind: AuthKind, person: AuthPerson, options: { target?: string | null } = {}): Promise<void> {
  try {
    const key = SWITCH[kind];
    if (!person.email || (key && !wants(person.notification_preferences, key))) return;
    const context = await requestContext();
    const whenMs = Date.now();
    const url = `${process.env.CUSTOMER_APP_URL || "https://www.waytaraenergy.com"}/dashboard/settings#security`;
    after(async () => {
      const mail = buildAuthEmail({ kind, name: person.full_name, device: context.device, place: context.place, ip: context.ip, whenMs, url, target: options.target });
      await sendMail(person.email as string, mail);
    });
  } catch (error) {
    console.error("[auth-notify] could not schedule the e-mail:", error);
  }
}
