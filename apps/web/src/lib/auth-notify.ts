import "server-only";
import { headers } from "next/headers";
import { after } from "next/server";
import { createServiceRoleClient } from "@waytara/supabase/service-role";
import { EVENT_RETENTION_DAYS, type AccountEventKind } from "./account-events";
import { buildAuthEmail, type AuthKind } from "./auth-mail";
import { wants, type NotificationKey } from "./notification-prefs";
import { sendMail } from "./send-mail";
import { describeDevice } from "./user-agent";

/** Who an account e-mail is for (the fields of the person's profile it needs). */
export interface AuthPerson {
  id: string;
  email: string | null;
  full_name: string | null;
  notification_preferences: unknown;
}

/** Which switch in Settings > Notifications controls the e-mail; null means it is always sent. */
const SWITCH: Record<AuthKind, NotificationKey | null> = {
  signin: "auth_signin",
  signout: "auth_signout",
  signout_idle: "auth_signout",
  signout_limit: "auth_signout",
  signout_closed: "auth_signout",
  signout_others: "auth_signout",
  signout_all: "auth_signout",
  session_revoked: "auth_signout",
  password_changed: null,
  mfa_enabled: null,
  mfa_disabled: null,
};

const decode = (v: string | null): string | null => {
  if (!v) return null;
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
};

interface RequestContext {
  device: string;
  place: string | null;
  ip: string | null;
}

/** Where and on what the request came from: the browser, the address, and the place when the host (Vercel) tells us. Read before `after`. */
async function requestContext(): Promise<RequestContext> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
  const place = [decode(h.get("x-vercel-ip-city")), decode(h.get("x-vercel-ip-country-region")), h.get("x-vercel-ip-country")].filter(Boolean).join(", ") || null;
  return { device: describeDevice(h.get("user-agent")).label, place, ip };
}

/** Writes one line of the person's account activity (and drops the ones older than the retention time). Never throws. */
async function writeEvent(personId: string, kind: AccountEventKind, context: RequestContext): Promise<void> {
  try {
    const service = createServiceRoleClient();
    await service.from("account_events").insert({ customer_id: personId, kind, device: context.device, place: context.place, ip: context.ip });
    const cutoff = new Date(Date.now() - EVENT_RETENTION_DAYS * 86_400_000).toISOString();
    await service.from("account_events").delete().eq("customer_id", personId).lt("created_at", cutoff);
  } catch (error) {
    console.error("[auth-notify] could not record the account event:", error);
  }
}

/** Records an account event that has no e-mail of its own here (the e-mail address changing has its own notice). Runs after the response. */
export async function recordAccountEvent(kind: AccountEventKind, personId: string): Promise<void> {
  try {
    const context = await requestContext();
    after(() => writeEvent(personId, kind, context));
  } catch (error) {
    console.error("[auth-notify] could not schedule the account event:", error);
  }
}

/**
 * Records the event in the person's account activity and e-mails them about it, if their notification settings allow it. It runs after the
 * response is sent, so it never slows the page down, and it never throws. Call it from a server action or route handler, after the event
 * itself succeeded.
 */
export async function notifyAuthEvent(kind: AuthKind, person: AuthPerson, options: { target?: string | null } = {}): Promise<void> {
  try {
    const key = SWITCH[kind];
    const mail = !!person.email && (!key || wants(person.notification_preferences, key));
    const context = await requestContext();
    const whenMs = Date.now();
    const url = `${process.env.CUSTOMER_APP_URL || "https://www.waytaraenergy.com"}/dashboard/settings#security`;
    after(async () => {
      await writeEvent(person.id, kind, context);
      if (!mail) return;
      await sendMail(person.email as string, buildAuthEmail({ kind, name: person.full_name, device: context.device, place: context.place, ip: context.ip, whenMs, url, target: options.target }));
    });
  } catch (error) {
    console.error("[auth-notify] could not schedule the e-mail:", error);
  }
}
