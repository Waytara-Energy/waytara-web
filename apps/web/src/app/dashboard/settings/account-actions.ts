"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@waytara/supabase/server";
import { createServiceRoleClient } from "@waytara/supabase/service-role";
import { getCurrentProfile, requireCustomer } from "@waytara/supabase/auth";
import type { Json } from "@waytara/supabase/types";
import { CLEARABLE_KINDS, RETENTION_CHOICES } from "@/lib/account-events";
import { buildAlertEmail } from "@/lib/alert-rule-mail";
import { appearanceToJson, parseAppearance, type AppearancePrefs } from "@/lib/appearance-prefs";
import { notifyAuthEvent } from "@/lib/auth-notify";
import { needsSecondFactor } from "@/lib/mfa";
import { sendMail } from "@/lib/send-mail";
import { START_PAGES, parseStartPage, startPath, type StartPageId } from "@/lib/start-page";
import { selectSite } from "@/app/dashboard/actions";

const SETTINGS = "/dashboard/settings";
const asJson = (v: unknown): Json => v as Json;
const asObject = (v: unknown): Record<string, Json> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, Json>) : {});

/** How long a test e-mail or alert may be asked for again. */
const TEST_COOLDOWN_MS = 30_000;
/** The lengths of pause offered, in minutes. */
const PAUSES = [60, 480, 1440, 10_080];

// ---- pausing notifications ---------------------------------------------------------------------------------------------------------------

/** Pauses the e-mails for a while (security e-mails still arrive), or ends the pause (`null`). */
export async function pauseNotifications(minutes: number | null): Promise<void> {
  const profile = await requireCustomer();
  if (minutes !== null && !PAUSES.includes(minutes)) throw new Error("Choose one of the lengths offered.");
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("notification_preferences").eq("id", profile.id).maybeSingle();
  const next = { ...asObject(data?.notification_preferences), paused_until: minutes === null ? null : new Date(Date.now() + minutes * 60_000).toISOString() };
  const { error } = await supabase.from("profiles").update({ notification_preferences: asJson(next) }).eq("id", profile.id);
  if (error) throw new Error(error.message);
  revalidatePath(SETTINGS);
}

// ---- test e-mail and test alert -----------------------------------------------------------------------------------------------------------

async function claimTest(profileId: string): Promise<void> {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("notification_preferences").eq("id", profileId).maybeSingle();
  const prefs = asObject(data?.notification_preferences);
  const last = typeof prefs.last_test_at === "string" ? Date.parse(prefs.last_test_at) : 0;
  if (Date.now() - last < TEST_COOLDOWN_MS) throw new Error("Wait a few seconds before sending another test.");
  const { error } = await supabase.from("profiles").update({ notification_preferences: asJson({ ...prefs, last_test_at: new Date().toISOString() }) }).eq("id", profileId);
  if (error) throw new Error(error.message);
}

/** Sends a short test e-mail to the person's address, so they can see that e-mails arrive. */
export async function sendTestEmail(): Promise<{ to: string }> {
  const profile = await requireCustomer();
  if (!profile.email) throw new Error("There is no e-mail address on your account.");
  await claimTest(profile.id);
  const first = (profile.full_name ?? "").trim().split(/\s+/)[0];
  const sent = await sendMail(profile.email, {
    subject: "A test e-mail from WayTara",
    text: [`Hi${first ? ` ${first}` : ""},`, "", "This is a test: e-mails from WayTara reach you here.", "", "You asked for it in Settings > Notifications. Nothing else was changed.", "- The WayTara Team"].join("\n"),
    html: `<div style="font-family:Segoe UI,Arial,sans-serif;color:#0f172a;max-width:520px"><p>Hi${first ? ` ${first.replace(/</g, "&lt;")}` : ""},</p><p>This is a test: e-mails from WayTara reach you here.</p><p style="color:#64748b;font-size:12px">You asked for it in Settings &gt; Notifications. Nothing else was changed.<br>- The WayTara Team</p></div>`,
  });
  if (sent !== "sent") throw new Error("The test e-mail could not be sent. Try again in a moment.");
  return { to: profile.email };
}

/** Raises a sample alert: one in the bell and one e-mail, so the person sees what their alerts look like. */
export async function sendTestAlert(): Promise<void> {
  const profile = await requireCustomer();
  await claimTest(profile.id);
  const supabase = await createClient();
  const { data: devices } = await supabase.from("equipment").select("id, site:sites(name)").is("parent_id", null).limit(1);
  const device = devices?.[0];
  if (!device) throw new Error("Set up a device first, then you can test an alert.");

  const service = createServiceRoleClient();
  const { error } = await service.from("alerts").insert({ device_id: device.id, severity: "warning", message: "Test alert: this is how your alerts look in the bell" });
  if (error) throw new Error("The test alert could not be raised. Try again.");

  if (profile.email) {
    const base = (process.env.CUSTOMER_APP_URL || "https://www.waytaraenergy.com").replace(/\/+$/, "");
    await sendMail(
      profile.email,
      buildAlertEmail({
        name: profile.full_name,
        alerts: [{ title: "Test alert", metricLabel: "Battery level", valueText: "18%", limitText: "below 20% (a sample)", siteName: (device.site as { name: string | null } | null)?.name ?? null, severity: "warning" }],
        dashboardUrl: `${base}/dashboard`,
        settingsUrl: `${base}${SETTINGS}#alerts`,
      }),
    );
  }
  revalidatePath("/dashboard", "layout");
}

// ---- appearance, start page, default site -------------------------------------------------------------------------------------------------

async function mergeUiPreferences(profileId: string, patch: Record<string, Json>): Promise<void> {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("ui_preferences").eq("id", profileId).maybeSingle();
  const { error } = await supabase.from("profiles").update({ ui_preferences: asJson({ ...asObject(data?.ui_preferences), ...patch }) }).eq("id", profileId);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard", "layout");
}

/** Saves the text size and the reduced-motion choice. */
export async function saveAppearance(prefs: AppearancePrefs): Promise<void> {
  const profile = await requireCustomer();
  const clean = parseAppearance({ appearance: appearanceToJson(prefs) });
  if (clean.textSize !== prefs.textSize) throw new Error("Choose one of the sizes offered.");
  await mergeUiPreferences(profile.id, { appearance: asJson(appearanceToJson(clean)) });
}

/** Saves the page the dashboard opens on after signing in. */
export async function saveStartPage(id: StartPageId): Promise<void> {
  const profile = await requireCustomer();
  if (!START_PAGES.some((p) => p.id === id)) throw new Error("Choose one of the pages offered.");
  await mergeUiPreferences(profile.id, { start_page: id });
}

/** Makes this the site the dashboard shows (the same choice as the site switcher in the header). */
export async function saveDefaultSite(siteId: string): Promise<void> {
  await requireCustomer();
  await selectSite(siteId);
  revalidatePath("/dashboard", "layout");
}

// ---- two-factor sign-in -------------------------------------------------------------------------------------------------------------------

/** After the browser turned two-factor sign-in on or off, checks with the auth service that it really did, records it and e-mails the person. */
export async function recordTwoFactorChange(kind: "mfa_enabled" | "mfa_disabled"): Promise<void> {
  const profile = await requireCustomer();
  const supabase = await createClient();
  const { data } = await supabase.auth.mfa.listFactors();
  const on = (data?.totp ?? []).length > 0;
  if ((kind === "mfa_enabled") !== on) throw new Error("The two-factor setting is not what was expected. Reload the page.");
  await notifyAuthEvent(kind, profile);
  revalidatePath(SETTINGS);
}

/** The last step of a sign-in that needed a code: checks the code was accepted, tells the person about the sign-in, and says where to go. */
export async function completeSignIn(): Promise<string> {
  const supabase = await createClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile) throw new Error("Please sign in again.");
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (needsSecondFactor(aal)) throw new Error("The code has not been accepted yet.");
  await notifyAuthEvent("signin", profile);
  return startPath(parseStartPage(profile.ui_preferences));
}

// ---- privacy: how long activity is kept, and clearing it -------------------------------------------------------------------------------

/** How long the account activity is kept (30 days, 90 days or 1 year). Older lines are removed as new ones are written; the other keys of
 *  security_preferences are kept. */
export async function saveActivityRetention(days: number): Promise<void> {
  const profile = await requireCustomer();
  if (!RETENTION_CHOICES.some((c) => c.days === days)) throw new Error("Choose one of the times offered.");
  const supabase = await createClient();
  const { data: current } = await supabase.from("profiles").select("security_preferences").eq("id", profile.id).maybeSingle();
  const { error } = await supabase.from("profiles").update({ security_preferences: asJson({ ...asObject(current?.security_preferences), activity_days: days }) }).eq("id", profile.id);
  if (error) throw new Error(error.message);
  // lines already older than the new time go now
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
  await createServiceRoleClient().from("account_events").delete().eq("customer_id", profile.id).lt("created_at", cutoff);
  revalidatePath("/dashboard/settings");
}

/** Removes the person's sign-in and sign-out history. Password, e-mail and two-factor changes are kept (see CLEARABLE_KINDS). Returns how many went. */
export async function clearActivityHistory(): Promise<{ removed: number }> {
  const profile = await requireCustomer();
  const { data, error } = await createServiceRoleClient().from("account_events").delete().eq("customer_id", profile.id).in("kind", CLEARABLE_KINDS).select("id");
  if (error) throw new Error("Could not clear the history. Try again.");
  revalidatePath("/dashboard/settings");
  return { removed: data?.length ?? 0 };
}
