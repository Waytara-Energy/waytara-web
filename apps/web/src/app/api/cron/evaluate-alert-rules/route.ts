import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@waytara/supabase/service-role";
import { isCronAuthorized } from "@/lib/cron-auth";
import { ALERT_READING_KEYS, siteMetricValues } from "@/lib/alert-values";
import { buildAlertEmail, type FiredAlert } from "@/lib/alert-rule-mail";
import { decide, effectiveRules, formatMetricValue, metricOf, type EffectiveRule, type RuleRow } from "@/lib/alert-rules";
import { wants } from "@/lib/notification-prefs";
import { sendMail } from "@/lib/send-mail";

// The customers' own alerts ("tell me when the battery is below 20%"), every 5 minutes (pg_cron calls this route; see migration
// 20261023080000_alert_rules.sql). For every customer it takes the ready-made alerts (as WayTara set them up, or as the customer changed them)
// and the customer's own, works out each metric for each of their sites from the latest readings of the site's inverters, and:
//   - a limit just crossed (and not fired within its cooldown): an alert row for the bell and one e-mail listing everything that fired;
//   - a value back in range: the rule is armed again and its bell alert is marked cleared.
// A reading older than STALE_MS is ignored (a device that stopped reporting must not fire on its last number).
// No signed-in user exists for a scheduled job, so this is one of the legitimate service_role cases (see service-role.ts).

const STALE_MS = 30 * 60_000;
const BATCH = 25;

interface DeviceRow {
  id: string;
  site_id: string | null;
  site: { id: string; name: string | null; customer_id: string } | null;
  device_type: { category: string | null } | null;
}

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req, "evaluate-alert-rules")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServiceRoleClient();
  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  const { data: deviceRows, error: devicesError } = await supabase
    .from("equipment")
    .select("id, site_id, site:sites(id, name, customer_id), device_type:equipment_inventory(category)")
    .eq("device_status", "active")
    .is("parent_id", null);
  if (devicesError) return NextResponse.json({ error: devicesError.message }, { status: 500 });

  // the inverters are where every watched number comes from (battery, solar, grid and load are all read through the inverter)
  const inverters = ((deviceRows ?? []) as unknown as DeviceRow[]).filter((d) => d.site && d.device_type?.category === "solar_inverter");
  if (inverters.length === 0) return NextResponse.json({ customers: 0, fired: 0, rearmed: 0, emails: 0 });

  const customerIds = [...new Set(inverters.map((d) => d.site!.customer_id))];
  const deviceIds = inverters.map((d) => d.id);

  // the latest readings, in batches (the REST API caps one response at 1,000 rows)
  const readings = new Map<string, Record<string, number | null>>();
  for (let i = 0; i < deviceIds.length; i += BATCH) {
    const { data, error } = await supabase
      .from("equipment_latest")
      .select("equipment_id, key_name, value, ts")
      .in("equipment_id", deviceIds.slice(i, i + BATCH))
      .in("key_name", ALERT_READING_KEYS);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    for (const r of data ?? []) {
      if (now - new Date(r.ts).getTime() > STALE_MS) continue;
      const m = readings.get(r.equipment_id) ?? {};
      m[r.key_name] = r.value;
      readings.set(r.equipment_id, m);
    }
  }

  const [customersResult, profilesResult, rulesResult, stateResult] = await Promise.all([
    supabase.from("customers").select("id, tariff_rate_per_kwh").in("id", customerIds),
    supabase.from("profiles").select("id, email, full_name, notification_preferences, deactivated_at, deleted_at").in("id", customerIds),
    supabase.from("alert_rules").select("id, customer_id, preset_id, name, metric, op, threshold, site_id, notify_email, notify_app, cooldown_minutes, enabled").in("customer_id", customerIds),
    supabase.from("alert_rule_state").select("customer_id, rule_key, site_id, active, last_fired_at, alert_id").in("customer_id", customerIds),
  ]);
  for (const r of [customersResult, profilesResult, rulesResult, stateResult]) if (r.error) return NextResponse.json({ error: r.error.message }, { status: 500 });

  const tariff = new Map((customersResult.data ?? []).map((c) => [c.id, Number(c.tariff_rate_per_kwh)]));
  const profiles = new Map((profilesResult.data ?? []).map((p) => [p.id, p]));
  const rulesBy = new Map<string, RuleRow[]>();
  for (const r of rulesResult.data ?? []) rulesBy.set(r.customer_id, [...(rulesBy.get(r.customer_id) ?? []), r as unknown as RuleRow]);
  const stateBy = new Map((stateResult.data ?? []).map((s) => [`${s.customer_id}|${s.rule_key}|${s.site_id}`, s]));

  // each customer's sites, with the devices that have readings
  const sitesBy = new Map<string, Map<string, { name: string | null; deviceIds: string[] }>>();
  for (const d of inverters) {
    const site = d.site!;
    const mine = sitesBy.get(site.customer_id) ?? new Map();
    const entry = mine.get(site.id) ?? { name: site.name, deviceIds: [] };
    entry.deviceIds.push(d.id);
    mine.set(site.id, entry);
    sitesBy.set(site.customer_id, mine);
  }

  interface Fire {
    customerId: string;
    siteId: string;
    siteName: string | null;
    deviceId: string;
    rule: EffectiveRule;
    value: number;
  }
  const fires: Fire[] = [];
  const rearms: { customerId: string; ruleKey: string; siteId: string }[] = [];
  const upserts: { customer_id: string; rule_key: string; site_id: string; active: boolean; last_fired_at: string | null; last_value: number | null; alert_id: string | null }[] = [];

  for (const [customerId, sites] of sitesBy) {
    const rules = effectiveRules(rulesBy.get(customerId) ?? []).filter((r) => r.enabled);
    if (rules.length === 0) continue;
    for (const [siteId, site] of sites) {
      const devices = site.deviceIds.map((id) => readings.get(id)).filter((r): r is Record<string, number | null> => !!r);
      if (devices.length === 0) continue;
      const values = siteMetricValues(devices, tariff.get(customerId) ?? null);
      for (const rule of rules) {
        if (rule.siteId && rule.siteId !== siteId) continue;
        const value = values[rule.metric] ?? null;
        const prior = stateBy.get(`${customerId}|${rule.key}|${siteId}`);
        const state = { active: prior?.active ?? false, lastFiredAt: prior?.last_fired_at ? new Date(prior.last_fired_at).getTime() : null };
        const decision = decide(rule, value, state, now);
        if (decision === "fire" && value !== null) fires.push({ customerId, siteId, siteName: site.name, deviceId: site.deviceIds[0], rule, value });
        else if (decision === "rearm") rearms.push({ customerId, ruleKey: rule.key, siteId });
      }
    }
  }

  // ?dry=1: say what would happen and write nothing (no alert rows, no state, no e-mail), to check the job against real readings
  if (req.nextUrl.searchParams.get("dry") === "1") {
    return NextResponse.json({
      dry: true,
      customers: sitesBy.size,
      readings: readings.size,
      wouldFire: fires.map((f) => ({ customer: f.customerId.slice(0, 8), site: f.siteName, rule: f.rule.key, value: Number(f.value.toFixed(2)), email: f.rule.email, app: f.rule.app })),
      wouldRearm: rearms.length,
    });
  }

  // the bell: one alert row per rule that fired (only for rules that want it)
  const bell = fires.filter((f) => f.rule.app);
  const alertIdOf = new Map<Fire, string>();
  if (bell.length > 0) {
    const { data, error } = await supabase
      .from("alerts")
      .insert(
        bell.map((f) => {
          const label = metricOf(f.rule.metric)?.label ?? f.rule.metric;
          return { device_id: f.deviceId, severity: f.rule.severity === "critical" ? "critical" : "warning", message: `${f.rule.title}: ${label} is ${formatMetricValue(f.rule.metric, f.value)}${f.siteName ? ` at ${f.siteName}` : ""}` };
        })
      )
      .select("id");
    if (error) console.error("[evaluate-alert-rules] inserting alerts failed:", error.message);
    else bell.forEach((f, i) => data?.[i] && alertIdOf.set(f, data[i].id));
  }

  for (const f of fires) upserts.push({ customer_id: f.customerId, rule_key: f.rule.key, site_id: f.siteId, active: true, last_fired_at: nowIso, last_value: f.value, alert_id: alertIdOf.get(f) ?? null });

  // an armed-again rule: its bell alert is marked cleared
  const toResolve: string[] = [];
  for (const r of rearms) {
    const prior = stateBy.get(`${r.customerId}|${r.ruleKey}|${r.siteId}`);
    if (prior?.alert_id) toResolve.push(prior.alert_id);
    upserts.push({ customer_id: r.customerId, rule_key: r.ruleKey, site_id: r.siteId, active: false, last_fired_at: prior?.last_fired_at ?? null, last_value: null, alert_id: null });
  }
  if (toResolve.length > 0) {
    const { error } = await supabase.from("alerts").update({ resolved_at: nowIso }).in("id", toResolve).is("resolved_at", null);
    if (error) console.error("[evaluate-alert-rules] clearing alerts failed:", error.message);
  }
  if (upserts.length > 0) {
    const { error } = await supabase.from("alert_rule_state").upsert(upserts, { onConflict: "customer_id,rule_key,site_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // one e-mail per customer, for the rules that want e-mail, if the customer takes these e-mails
  const customerAppUrl = (process.env.CUSTOMER_APP_URL || "https://www.waytaraenergy.com").replace(/\/+$/, "");
  const byCustomer = new Map<string, Fire[]>();
  for (const f of fires) if (f.rule.email) byCustomer.set(f.customerId, [...(byCustomer.get(f.customerId) ?? []), f]);
  let emails = 0;
  for (const [customerId, list] of byCustomer) {
    const p = profiles.get(customerId);
    if (!p || !p.email || p.deactivated_at || p.deleted_at || !wants(p.notification_preferences, "rule_alerts")) continue;
    const alerts: FiredAlert[] = list.map((f) => {
      const m = metricOf(f.rule.metric);
      return { title: f.rule.title, metricLabel: m?.label ?? f.rule.metric, valueText: formatMetricValue(f.rule.metric, f.value), limitText: `${f.rule.op} ${formatMetricValue(f.rule.metric, f.rule.threshold)}`, siteName: f.siteName, severity: f.rule.severity };
    });
    const mail = buildAlertEmail({ name: p.full_name, alerts, dashboardUrl: `${customerAppUrl}/dashboard`, settingsUrl: `${customerAppUrl}/dashboard/settings#notifications` });
    if ((await sendMail(p.email, mail)) === "sent") emails += 1;
  }

  return NextResponse.json({ customers: sitesBy.size, fired: fires.length, rearmed: rearms.length, emails });
}
