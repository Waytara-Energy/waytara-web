import { createClient } from "@waytara/supabase/server";
import { requireCustomer } from "@waytara/supabase/auth";
import { SettingsBoard } from "@/components/dashboard/settings/settings-board";
import type { SignedInDevice } from "@/components/dashboard/devices-setting";
import type { ActivityEvent } from "@/components/dashboard/settings/activity-list";
import type { PlanSummary } from "@/components/dashboard/settings/plan-card";
import type { RecentAlert } from "@/components/dashboard/settings/alerts-section";
import { effectiveRules, type RuleRow } from "@/lib/alert-rules";
import { profileCompleteness, type HealthInput } from "@/lib/account-health";
import { addressLine, isEmptyAddress, parseAddress } from "@/lib/address";
import { parseAppearance } from "@/lib/appearance-prefs";
import { NOTIFICATION_KEYS, pausedUntil, resolveNotificationPrefs } from "@/lib/notification-prefs";
import { parseOverviewPrefs } from "@/lib/overview-prefs";
import { defaultLayout } from "@/lib/overview-layout";
import { periodProgress, summarisePayments, type PaymentRow } from "@/lib/billing-summary";
import { RealtimeRefresh } from "@/components/dashboard/realtime-refresh";
import { getCustomerSites, getSelectedSite } from "@/lib/selected-site";
import { parseSessionPolicy } from "@/lib/session-policy";
import { parseStartPage } from "@/lib/start-page";
import { fetchUnitFields } from "@/lib/unit-fields";
import { parseUnitPrefs } from "@/lib/unit-prefs";

/** The server clock for "5 min ago" and the subscription period (a function, so a render never reads the time itself). */
const serverNow = () => Date.now();

// Application Settings: a hero, then ten tabs - Account (the home: setup, security check, recent activity, plan), Profile, Appearance, Units,
// Dashboard (start page, site, Overview cards and background), Notifications (with a pause), Alerts, Billing, Security (password, two-factor,
// staying signed in, activity, devices) and Privacy & data. The page reads everything it needs together; the board shows one tab at a time.
export default async function SettingsPage() {
  const profile = await requireCustomer();
  const supabase = await createClient();
  const [site, allSites] = await Promise.all([getSelectedSite(), getCustomerSites()]);
  const [{ data: row }, { data: customer }, { data: subscription }, { data: sessionRows }, unitValues, { data: ruleRows }, { data: alertRows }, { data: eventRows }, factors, { data: paymentRows }] = await Promise.all([
    supabase.from("profiles").select("full_name, phone, email, avatar_url, created_at, notification_preferences, ui_preferences, security_preferences").eq("id", profile.id).maybeSingle(),
    supabase.from("customers").select("status, address, billing_address, billing_email, gstin, plan_started_at, plan:plans(name, price_monthly)").eq("id", profile.id).maybeSingle(),
    supabase.from("subscriptions").select("status, current_period_start, current_period_end").eq("customer_id", profile.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.rpc("my_sessions"),
    // the readings of the selected site's devices whose unit can be changed (for the "particular values" list of Units)
    fetchUnitFields(supabase, (site?.devices ?? []).map((d) => d.id)),
    // the customer's own alerts and their changes to the ready-made ones (RLS: only their rows)
    supabase.from("alert_rules").select("id, preset_id, name, metric, op, threshold, site_id, notify_email, notify_app, cooldown_minutes, enabled").order("created_at"),
    supabase.from("alerts").select("id, severity, message, ts, resolved_at").order("ts", { ascending: false }).limit(8),
    supabase.from("account_events").select("id, kind, device, place, ip, created_at").order("created_at", { ascending: false }).limit(20),
    supabase.auth.mfa.listFactors(),
    // the payments of the Billing tab (RLS scopes them to this customer; the limit keeps a very old account from an unbounded read)
    supabase.from("payments").select("id, payment_type, amount, status, method, paid_at, created_at").order("created_at", { ascending: false }).limit(500),
  ]);

  const now = serverNow();
  const prefs = resolveNotificationPrefs(row?.notification_preferences);
  const paused = pausedUntil(row?.notification_preferences, now);
  const pausedIso = paused ? new Date(paused).toISOString() : null;
  const overview = parseOverviewPrefs(row?.ui_preferences);
  const imageUrl = overview.background.kind === "image" ? supabase.storage.from("avatars").getPublicUrl(overview.background.path).data.publicUrl : null;
  const policy = parseSessionPolicy(row?.security_preferences);
  const devices: SignedInDevice[] = (sessionRows ?? []).map((s) => ({ id: s.id, lastActive: s.last_active, createdAt: s.created_at, userAgent: s.user_agent, ip: s.ip, isCurrent: s.is_current }));
  const events: ActivityEvent[] = (eventRows ?? []).map((e) => ({ id: e.id, kind: e.kind, device: e.device, place: e.place, ip: e.ip, created_at: e.created_at }));
  const rules = effectiveRules((ruleRows ?? []) as unknown as RuleRow[]);
  const recent: RecentAlert[] = (alertRows ?? []).map((a) => ({ id: a.id, severity: a.severity, message: a.message, ts: a.ts, resolved_at: a.resolved_at }));
  const siteList = allSites.map((s) => ({ id: s.id, name: s.name }));
  const deviceCount = allSites.reduce((n, s) => n + s.devices.length, 0);

  const name = row?.full_name ?? "";
  const email = row?.email ?? profile.email ?? "";
  const address = parseAddress(customer?.address);
  const billing = customer?.billing_address ? parseAddress(customer.billing_address) : null;

  const health: HealthInput = {
    hasPhoto: !!row?.avatar_url,
    hasName: name.trim().length > 0,
    hasPhone: !!row?.phone,
    hasAddress: !isEmptyAddress(address),
    hasBillingDetails: !!(billing && !isEmptyAddress(billing)) || !!customer?.billing_email || !!customer?.gstin,
    twoFactor: (factors.data?.totp ?? []).length > 0,
    signInAlerts: prefs.auth_signin,
    idleSignOut: policy.idleMinutes !== null,
    devicesSignedIn: devices.length,
    alertsOn: rules.filter((r) => r.enabled).length,
    allMailOff: paused !== null || NOTIFICATION_KEYS.every((k) => !prefs[k]),
  };

  const plan: PlanSummary | null = customer?.plan
    ? {
        name: customer.plan.name,
        price: Number(customer.plan.price_monthly),
        status: subscription?.status ?? null,
        progress: subscription ? periodProgress(subscription.current_period_start, subscription.current_period_end, now) : null,
        periodEnd: subscription?.current_period_end ?? null,
        since: customer.plan_started_at,
        accountStatus: customer.status,
      }
    : null;

  const payments: PaymentRow[] = paymentRows ?? [];
  const overviewProps = { userId: profile.id, initial: overview, imageUrl, layout: overview.layout ?? defaultLayout(overview.cards, false) };
  const addressesProps = { address, billing, billingEmail: customer?.billing_email ?? "", gstin: customer?.gstin ?? "" };

  return (
    <>
      <RealtimeRefresh table="payments" event="UPDATE" filter={`customer_id=eq.${profile.id}`} />
      <SettingsBoard
      hero={{ name, email, avatarUrl: row?.avatar_url ?? null, completeness: profileCompleteness(health).percent, planName: customer?.plan?.name ?? null, memberSince: row?.created_at ?? null, sites: allSites.length, devices: deviceCount }}
      account={{ health, events, plan, pausedUntil: pausedIso, now }}
      profile={{ userId: profile.id, fullName: name, phone: row?.phone ?? "", email, avatarUrl: row?.avatar_url ?? null, memberSince: row?.created_at ?? null }}
      appearance={{ initial: parseAppearance(row?.ui_preferences) }}
      units={{ initial: parseUnitPrefs(row?.ui_preferences), values: unitValues }}
      dashboard={{ startPage: parseStartPage(row?.ui_preferences), sites: allSites.map((s) => ({ id: s.id, name: s.name, devices: s.devices.length, address: s.address ? addressLine(parseAddress(s.address)) || null : null })), selectedSiteId: site?.id ?? null, overview: overviewProps }}
      notifications={{ initial: prefs, pausedUntil: pausedIso, email }}
      alerts={{ rules, sites: siteList, recent, emailOn: prefs.rule_alerts, paused: paused !== null, now }}
      billing={{ plan, payments, summary: summarisePayments(payments), addresses: addressesProps }}
      security={{ policy, devices, now, email, events }}
      privacy={{ email }}
    />
    </>
  );
}
