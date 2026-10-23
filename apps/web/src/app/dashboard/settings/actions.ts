"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@waytara/supabase/server";
import { createServiceRoleClient } from "@waytara/supabase/service-role";
import { getCurrentProfile, requireCustomer } from "@waytara/supabase/auth";
import type { Json } from "@waytara/supabase/types";
import { EMAIL_PATTERN, MAX_ATTEMPTS, CODE_TTL_MS, buildEmailChangedMail, buildEmailCodeMail, buildPasswordCodeMail, canResend, codeExpired, codeMatches, generateCode, hashCode, normaliseEmail, secondsUntilResend } from "@/lib/email-otp";
import { GSTIN, addressProblems, addressToJson, normaliseGstin, type Address } from "@/lib/address";
import { isBackgroundPathOf, overviewToJson, parseOverviewPrefs, type OverviewPrefs } from "@/lib/overview-prefs";
import { layoutToJson, parseLayout, type WidgetItem } from "@/lib/overview-layout";
import { policyToJson, parseSessionPolicy, type SessionPolicy } from "@/lib/session-policy";
import { sendMail } from "@/lib/send-mail";
import { passwordStrength } from "@/lib/password-strength";
import { maskEmail } from "@/lib/mask-email";
import { parseUnitPrefs, type UnitPrefs } from "@/lib/unit-prefs";
import { metricOf, presetOf } from "@/lib/alert-rules";
import { notifyAuthEvent, recordAccountEvent } from "@/lib/auth-notify";
import { describeDevice } from "@/lib/user-agent";
import { NOTIFICATION_KEYS, mergeNotificationPrefs, type NotificationKey } from "@/lib/notification-prefs";

const SETTINGS = "/dashboard/settings";
/** What a password code is bound to (the same hashing as the e-mail change codes, a different purpose, so one cannot stand in for the other). */
const PASSWORD_CODE_SCOPE = "password-change";
const asJson = (v: unknown): Json => v as Json;

// ---- profile: name and phone ------------------------------------------------------------------------------------------------------------

/** Saves the person's name and phone. Only the columns granted to `authenticated` can change here (the e-mail goes through the code check below). */
export async function saveProfile(input: { fullName: string; phone: string }): Promise<void> {
  const profile = await requireCustomer();
  const fullName = input.fullName.trim();
  const phone = input.phone.trim();
  if (!fullName) throw new Error("Name can't be empty.");
  if (fullName.length > 100) throw new Error("That name is too long.");
  if (phone && !/^\+?[0-9][0-9 ()-]{6,18}$/.test(phone)) throw new Error("Enter a phone number with digits, and optionally + at the start.");

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ full_name: fullName, phone: phone || null }).eq("id", profile.id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard", "layout");
}

/** Sets or clears the profile picture. The picture itself was uploaded by the browser to the person's own folder; the address is checked here. */
export async function saveAvatar(path: string | null): Promise<void> {
  const profile = await requireCustomer();
  const supabase = await createClient();
  let url: string | null = null;
  if (path !== null) {
    if (!new RegExp(`^${profile.id}/avatar-\\d{10,16}\\.(jpg|jpeg|png|webp)$`).test(path)) throw new Error("That picture is not allowed.");
    url = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
  }
  const { data: old } = await supabase.from("profiles").select("avatar_url").eq("id", profile.id).maybeSingle();
  const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", profile.id);
  if (error) throw new Error(error.message);

  // the previous picture is no longer needed
  const oldPath = old?.avatar_url?.split("/avatars/")[1];
  if (oldPath && oldPath !== path && oldPath.startsWith(`${profile.id}/`)) await supabase.storage.from("avatars").remove([oldPath]);
  revalidatePath("/dashboard", "layout");
}

// ---- e-mail address, proved with a code sent to the new address ----------------------------------------------------------------------------

function codeSecret(): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("The server is not set up to send codes.");
  return secret;
}

/** Sends a 6-digit code to the new address. Nothing changes until the code is entered (confirmEmailChange). */
export async function requestEmailChange(newEmailRaw: string): Promise<{ sentTo: string }> {
  const profile = await requireCustomer();
  const email = normaliseEmail(newEmailRaw);
  if (!EMAIL_PATTERN.test(email) || email.length > 200) throw new Error("Enter a valid e-mail address.");
  if (email === normaliseEmail(profile.email ?? "")) throw new Error("That is already your e-mail address.");

  const service = createServiceRoleClient();
  const { data: taken } = await service.from("profiles").select("id").ilike("email", email).neq("id", profile.id).limit(1);
  if (taken && taken.length > 0) throw new Error("That address cannot be used. Try another one.");

  const { data: pending } = await service.from("email_change_codes").select("created_at").eq("user_id", profile.id).maybeSingle();
  if (pending && !canResend(pending.created_at, Date.now())) throw new Error(`Wait ${secondsUntilResend(pending.created_at, Date.now())} seconds before asking for another code.`);

  const code = generateCode();
  const { error } = await service.from("email_change_codes").upsert({
    user_id: profile.id,
    new_email: email,
    code_hash: hashCode(codeSecret(), profile.id, email, code),
    expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
    attempts: 0,
    created_at: new Date().toISOString(),
  });
  if (error) throw new Error("Could not start the change. Try again.");

  const sent = await sendMail(email, buildEmailCodeMail({ name: profile.full_name, code }));
  if (sent !== "sent") {
    await service.from("email_change_codes").delete().eq("user_id", profile.id);
    throw new Error("We could not send the code. Check the address and try again.");
  }
  return { sentTo: email };
}

/** Checks the code and, if it is right, changes the e-mail address the account signs in with. */
export async function confirmEmailChange(codeRaw: string): Promise<{ email: string }> {
  const profile = await requireCustomer();
  const code = codeRaw.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(code)) throw new Error("The code is 6 digits.");

  const service = createServiceRoleClient();
  const { data: row } = await service.from("email_change_codes").select("new_email, code_hash, expires_at, attempts").eq("user_id", profile.id).maybeSingle();
  if (!row) throw new Error("Ask for a new code first.");
  if (codeExpired(row.expires_at, Date.now())) {
    await service.from("email_change_codes").delete().eq("user_id", profile.id);
    throw new Error("That code has expired. Ask for a new one.");
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    await service.from("email_change_codes").delete().eq("user_id", profile.id);
    throw new Error("Too many wrong tries. Ask for a new code.");
  }
  if (!codeMatches(codeSecret(), profile.id, row.new_email, code, row.code_hash)) {
    await service.from("email_change_codes").update({ attempts: row.attempts + 1 }).eq("user_id", profile.id);
    const left = MAX_ATTEMPTS - row.attempts - 1;
    throw new Error(left > 0 ? `That code is not right. ${left} ${left === 1 ? "try" : "tries"} left.` : "Too many wrong tries. Ask for a new code.");
  }

  const oldEmail = profile.email;
  const { error: authError } = await service.auth.admin.updateUserById(profile.id, { email: row.new_email, email_confirm: true });
  if (authError) throw new Error("Could not change the address. Try again.");
  const { error: profileError } = await service.from("profiles").update({ email: row.new_email }).eq("id", profile.id);
  if (profileError) throw new Error("The address changed for signing in, but the profile could not be updated. Contact support.");
  await service.from("email_change_codes").delete().eq("user_id", profile.id);

  // a notice to the old address, and a fresh token so this browser carries the new address
  if (oldEmail) await sendMail(oldEmail, buildEmailChangedMail({ name: profile.full_name, newEmail: row.new_email }));
  await recordAccountEvent("email_changed", profile.id);
  const supabase = await createClient();
  await supabase.auth.refreshSession();
  revalidatePath("/dashboard", "layout");
  return { email: row.new_email };
}

// ---- notifications ---------------------------------------------------------------------------------------------------------------------

export type NotificationPrefs = Record<NotificationKey, boolean>;

export async function saveNotifications(prefs: NotificationPrefs): Promise<void> {
  const profile = await requireCustomer();
  const supabase = await createClient();
  const { data: current } = await supabase.from("profiles").select("notification_preferences").eq("id", profile.id).maybeSingle();
  const values = Object.fromEntries(NOTIFICATION_KEYS.map((k) => [k, !!prefs[k]])) as NotificationPrefs;
  const { error } = await supabase.from("profiles").update({ notification_preferences: asJson(mergeNotificationPrefs(current?.notification_preferences, values)) }).eq("id", profile.id);
  if (error) throw new Error(error.message);
  revalidatePath(SETTINGS);
}

// ---- addresses and billing details -----------------------------------------------------------------------------------------------------

export interface AddressesInput {
  address: Address;
  /** null: the billing address is the same as the address */
  billing: Address | null;
  billingEmail: string;
  gstin: string;
}

export async function saveAddresses(input: AddressesInput): Promise<void> {
  const profile = await requireCustomer();
  const problems = [...addressProblems(input.address, "Address"), ...(input.billing ? addressProblems(input.billing, "Billing address") : [])];
  const billingEmail = input.billingEmail.trim().toLowerCase();
  const gstin = normaliseGstin(input.gstin);
  if (billingEmail && !EMAIL_PATTERN.test(billingEmail)) problems.push("Billing e-mail: enter a valid address.");
  if (gstin && !GSTIN.test(gstin)) problems.push("GST number: it is 15 letters and digits, like 33AABCU9603R1ZX.");
  if (problems.length > 0) throw new Error(problems[0]);

  const supabase = await createClient();
  const { error } = await supabase
    .from("customers")
    .update({
      address: input.address ? asJson(addressToJson(input.address)) : null,
      billing_address: input.billing ? asJson(addressToJson(input.billing)) : null,
      billing_email: billingEmail || null,
      gstin: gstin || null,
    })
    .eq("id", profile.id);
  if (error) throw new Error(error.message);
  revalidatePath(SETTINGS);
}

// ---- Overview: the background, and the widget layout -------------------------------------------------------------------------------------

/** Saves the Overview background. A picture is accepted only if it is in the person's own folder; the one it replaces is deleted. */
export async function saveOverview(prefs: Pick<OverviewPrefs, "background" | "dim">): Promise<void> {
  const profile = await requireCustomer();
  const clean = parseOverviewPrefs(overviewToJson(prefs));
  if (clean.background.kind === "image" && !isBackgroundPathOf(clean.background.path, profile.id)) throw new Error("That picture is not allowed.");

  const supabase = await createClient();
  const { data: current } = await supabase.from("profiles").select("ui_preferences").eq("id", profile.id).maybeSingle();
  const base = current?.ui_preferences && typeof current.ui_preferences === "object" && !Array.isArray(current.ui_preferences) ? (current.ui_preferences as Record<string, Json>) : {};
  const before = parseOverviewPrefs(base).background;

  const { error } = await supabase.from("profiles").update({ ui_preferences: asJson({ ...base, ...overviewToJson(clean) }) }).eq("id", profile.id);
  if (error) throw new Error(error.message);

  if (before.kind === "image" && (clean.background.kind !== "image" || clean.background.path !== before.path)) await supabase.storage.from("avatars").remove([before.path]);
  revalidatePath("/dashboard", "layout");
}

/** Saves the widgets of the Overview and where they sit (null puts the standard layout back). Checked on the way in: an unknown widget, a
 *  repeated id or a layout that had to be repaired is refused rather than silently changed. */
export async function saveOverviewLayout(items: WidgetItem[] | null): Promise<void> {
  const profile = await requireCustomer();
  let stored: ReturnType<typeof layoutToJson> | null = null;
  if (items !== null) {
    const clean = parseLayout({ overview_layout: layoutToJson(items) });
    if (!clean || clean.length !== items.length || clean.length === 0) throw new Error("That layout could not be saved. Add at least one widget and try again.");
    stored = layoutToJson(clean);
  }

  const supabase = await createClient();
  const { data: current } = await supabase.from("profiles").select("ui_preferences").eq("id", profile.id).maybeSingle();
  const base = current?.ui_preferences && typeof current.ui_preferences === "object" && !Array.isArray(current.ui_preferences) ? { ...(current.ui_preferences as Record<string, Json>) } : {};
  if (stored) base.overview_layout = asJson(stored);
  else delete base.overview_layout;
  const { error } = await supabase.from("profiles").update({ ui_preferences: asJson(base) }).eq("id", profile.id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard", "layout");
}

// ---- units ------------------------------------------------------------------------------------------------------------------------------

/** Saves the units numbers are shown in (one per kind, and per reading). Only units that belong to their kind are accepted. */
export async function saveUnits(prefs: UnitPrefs): Promise<void> {
  const profile = await requireCustomer();
  const clean = parseUnitPrefs({ units: prefs });
  const lost = Object.keys(prefs.defaults).some((k) => (clean.defaults as Record<string, string>)[k] !== (prefs.defaults as Record<string, string>)[k]) || Object.keys(prefs.overrides).length !== Object.keys(clean.overrides).length;
  if (lost) throw new Error("Choose one of the units offered.");

  const supabase = await createClient();
  const { data: current } = await supabase.from("profiles").select("ui_preferences").eq("id", profile.id).maybeSingle();
  const base = current?.ui_preferences && typeof current.ui_preferences === "object" && !Array.isArray(current.ui_preferences) ? (current.ui_preferences as Record<string, Json>) : {};
  const { error } = await supabase.from("profiles").update({ ui_preferences: asJson({ ...base, units: clean }) }).eq("id", profile.id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard", "layout");
}

// ---- password and sign-in policy -------------------------------------------------------------------------------------------------------

/** Sends a 6-digit code to the account's own e-mail. Changing the password needs it (confirmPasswordChange); nothing changes until then. */
export async function requestPasswordChange(): Promise<{ sentTo: string }> {
  const profile = await requireCustomer();
  if (!profile.email) throw new Error("Your account has no e-mail address to send the code to.");

  const service = createServiceRoleClient();
  const { data: pending } = await service.from("password_change_codes").select("created_at").eq("user_id", profile.id).maybeSingle();
  if (pending && !canResend(pending.created_at, Date.now())) throw new Error(`Wait ${secondsUntilResend(pending.created_at, Date.now())} seconds before asking for another code.`);

  const code = generateCode();
  const { error } = await service.from("password_change_codes").upsert({
    user_id: profile.id,
    code_hash: hashCode(codeSecret(), profile.id, PASSWORD_CODE_SCOPE, code),
    expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
    attempts: 0,
    created_at: new Date().toISOString(),
  });
  if (error) throw new Error("Could not start the change. Try again.");

  const sent = await sendMail(profile.email, buildPasswordCodeMail({ name: profile.full_name, code }));
  if (sent !== "sent") {
    await service.from("password_change_codes").delete().eq("user_id", profile.id);
    throw new Error("We could not send the code. Try again in a moment.");
  }
  return { sentTo: maskEmail(profile.email) };
}

/** Checks the code and, if it is right, sets the new password and signs the account out of EVERY device, this one included (the caller then goes
 *  to the sign-in page). */
export async function confirmPasswordChange(codeRaw: string, next: string): Promise<void> {
  const profile = await requireCustomer();
  const code = codeRaw.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(code)) throw new Error("The code is 6 digits.");
  if (next.length < 8) throw new Error("The new password needs at least 8 characters.");
  if (next.length > 200) throw new Error("That password is too long.");
  const strength = passwordStrength(next, profile.email ?? "");
  if (strength.score < 2) throw new Error(strength.tips[0] ?? "Choose a stronger password.");

  const service = createServiceRoleClient();
  const { data: row } = await service.from("password_change_codes").select("code_hash, expires_at, attempts").eq("user_id", profile.id).maybeSingle();
  if (!row) throw new Error("Ask for a code first.");
  if (codeExpired(row.expires_at, Date.now())) {
    await service.from("password_change_codes").delete().eq("user_id", profile.id);
    throw new Error("That code has expired. Ask for a new one.");
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    await service.from("password_change_codes").delete().eq("user_id", profile.id);
    throw new Error("Too many wrong tries. Ask for a new code.");
  }
  if (!codeMatches(codeSecret(), profile.id, PASSWORD_CODE_SCOPE, code, row.code_hash)) {
    await service.from("password_change_codes").update({ attempts: row.attempts + 1 }).eq("user_id", profile.id);
    const left = MAX_ATTEMPTS - row.attempts - 1;
    throw new Error(left > 0 ? `That code is not right. ${left} ${left === 1 ? "try" : "tries"} left.` : "Too many wrong tries. Ask for a new code.");
  }

  const { error } = await service.auth.admin.updateUserById(profile.id, { password: next });
  if (error) throw new Error(error.message);
  await service.from("password_change_codes").delete().eq("user_id", profile.id);

  // the password changed: tell the person, then end every session (this device's too)
  await notifyAuthEvent("password_changed", profile);
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "global" });
}

/** When a browser is signed out by itself: after being idle (with a warning), at a most session time, when closed, for this device or all. The
 *  other keys of security_preferences (the activity history choice) are kept. */
export async function saveSessionPolicy(policy: SessionPolicy): Promise<void> {
  const profile = await requireCustomer();
  const clean = parseSessionPolicy(policyToJson(policy));
  if (JSON.stringify(clean) !== JSON.stringify(policy)) throw new Error("One of the choices is not allowed. Check the times and try again.");
  const supabase = await createClient();
  const { data: current } = await supabase.from("profiles").select("security_preferences").eq("id", profile.id).maybeSingle();
  const base = current?.security_preferences && typeof current.security_preferences === "object" && !Array.isArray(current.security_preferences) ? (current.security_preferences as Record<string, Json>) : {};
  const { error } = await supabase.from("profiles").update({ security_preferences: asJson({ ...base, ...policyToJson(clean) }) }).eq("id", profile.id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard", "layout");
}

/** The session watcher's sign-out: after being idle, at the session's time limit, or when the browser was closed (this device, or all devices). */
export async function idleSignOut(scope: "device" | "all", reason: "idle" | "limit" | "closed" = "idle"): Promise<void> {
  const supabase = await createClient();
  const profile = await getCurrentProfile(supabase);
  await supabase.auth.signOut({ scope: scope === "all" ? "global" : "local" });
  if (profile) await notifyAuthEvent(reason === "limit" ? "signout_limit" : reason === "closed" ? "signout_closed" : "signout_idle", profile);
}

// ---- signed-in devices ------------------------------------------------------------------------------------------------------------------

/** Ends the sessions on every other device and keeps this one (Supabase's "others" scope). */
export async function signOutOtherDevices(): Promise<void> {
  const profile = await requireCustomer();
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "others" });
  if (error) throw new Error(error.message);
  await notifyAuthEvent("signout_others", profile);
  revalidatePath(SETTINGS);
}

/** Ends every session, this device included (the caller then goes to the sign-in page). */
export async function signOutAllDevices(): Promise<void> {
  const profile = await requireCustomer();
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "global" });
  if (error) throw new Error(error.message);
  await notifyAuthEvent("signout_all", profile);
}

/** Ends one other device's session (the database function only ever touches the caller's own). */
export async function revokeSession(sessionId: string): Promise<void> {
  const profile = await requireCustomer();
  const supabase = await createClient();
  // what the device was, for the e-mail, read before it is gone
  const { data: mine } = await supabase.rpc("my_sessions");
  const target = describeDevice(mine?.find((s) => s.id === sessionId)?.user_agent).label;
  const { error } = await supabase.rpc("revoke_my_session", { p_id: sessionId });
  if (error) throw new Error(error.message);
  await notifyAuthEvent("session_revoked", profile, { target });
  revalidatePath(SETTINGS);
}

// ---- my alerts ("tell me when the battery is below 20%") -------------------------------------------------------------------------------

export interface AlertInput {
  /** the alert's row, when it is already saved */
  id?: string | null;
  /** set for a ready-made alert: the customer's change to it */
  presetId?: string | null;
  name?: string;
  metric: string;
  op: "above" | "below";
  threshold: number;
  /** null = every site */
  siteId: string | null;
  email: boolean;
  app: boolean;
  cooldownMinutes: number;
  enabled: boolean;
}

/** Saves one alert: a change to a ready-made one (switch, limit, channels, cooldown) or one of the customer's own (made or edited). */
export async function saveAlertRule(input: AlertInput): Promise<void> {
  const profile = await requireCustomer();
  const preset = input.presetId ? presetOf(input.presetId) : null;
  if (input.presetId && !preset) throw new Error("That alert does not exist.");
  const metric = preset ? preset.metric : input.metric;
  const op = preset ? preset.op : input.op;
  if (!metricOf(metric)) throw new Error("Choose what to watch.");
  if (op !== "above" && op !== "below") throw new Error("Choose above or below.");
  if (!Number.isFinite(input.threshold) || Math.abs(input.threshold) > 1_000_000) throw new Error("Enter a limit as a number.");
  if (!Number.isInteger(input.cooldownMinutes) || input.cooldownMinutes < 5 || input.cooldownMinutes > 10_080) throw new Error("Choose how often it may repeat.");
  const name = (input.name ?? "").trim();
  if (name.length > 80) throw new Error("Keep the name under 80 characters.");
  if (!input.email && !input.app && input.enabled) throw new Error("Choose at least one way to be told: e-mail or the app.");

  const supabase = await createClient();
  const values = { metric, op, threshold: input.threshold, notify_email: input.email, notify_app: input.app, cooldown_minutes: input.cooldownMinutes, enabled: input.enabled };

  if (preset) {
    const { data: existing } = await supabase.from("alert_rules").select("id").eq("customer_id", profile.id).eq("preset_id", preset.id).maybeSingle();
    const { error } = existing
      ? await supabase.from("alert_rules").update(values).eq("id", existing.id)
      : await supabase.from("alert_rules").insert({ ...values, customer_id: profile.id, preset_id: preset.id, name: null, site_id: null });
    if (error) throw new Error(error.message);
  } else if (input.id) {
    const { error } = await supabase.from("alert_rules").update({ ...values, name: name || null, site_id: input.siteId }).eq("id", input.id).eq("customer_id", profile.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("alert_rules").insert({ ...values, customer_id: profile.id, preset_id: null, name: name || null, site_id: input.siteId });
    if (error) throw new Error(error.code === "54000" ? "That is the most alerts you can have. Delete one first." : error.message);
  }
  revalidatePath(SETTINGS);
}

/** Deletes one of the customer's own alerts, or puts a ready-made alert back as WayTara set it up. */
export async function deleteAlertRule(id: string): Promise<void> {
  const profile = await requireCustomer();
  const supabase = await createClient();
  const { error } = await supabase.from("alert_rules").delete().eq("id", id).eq("customer_id", profile.id);
  if (error) throw new Error(error.message);
  revalidatePath(SETTINGS);
}
