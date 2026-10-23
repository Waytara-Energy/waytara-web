import { NextResponse } from "next/server";
import { createClient } from "@waytara/supabase/server";
import { getCurrentProfile } from "@waytara/supabase/auth";
import { isCustomerRole } from "@waytara/supabase/roles";

// "Download my data" (Application Settings > Privacy & data): everything the signed-in customer's own account holds that they can read, as one JSON
// file: their profile and settings, billing details, sites, devices, alerts, support tickets and messages, payments, subscriptions and account
// activity. Every read goes through the customer's own session, so row-level security keeps it to their rows; readings (the time series) are not
// included, they are available as reports.

const LIMIT = 5000;

export async function GET() {
  const supabase = await createClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile || !isCustomerRole(profile.role)) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const [account, customer, sites, equipment, rules, alerts, tickets, messages, payments, subscriptions, events] = await Promise.all([
    supabase.from("profiles").select("id, email, full_name, phone, avatar_url, created_at, notification_preferences, ui_preferences, security_preferences").eq("id", profile.id).maybeSingle(),
    supabase.from("customers").select("address, billing_address, billing_email, gstin, status, plan_started_at, tariff_rate_per_kwh, plan:plans(name, price_monthly)").eq("id", profile.id).maybeSingle(),
    supabase.from("sites").select("*").limit(LIMIT),
    supabase.from("equipment").select("*").limit(LIMIT),
    supabase.from("alert_rules").select("*").limit(LIMIT),
    supabase.from("alerts").select("*").order("ts", { ascending: false }).limit(LIMIT),
    supabase.from("support_tickets").select("ticket_no, subject, status, category, created_at, closed_at, rating, rating_comment").order("created_at", { ascending: false }).limit(LIMIT),
    supabase.from("support_messages").select("ticket_id, sender_role, sender_name, body, created_at").eq("internal", false).order("created_at").limit(LIMIT),
    supabase.from("payments").select("payment_type, amount, status, method, paid_at, created_at").order("created_at", { ascending: false }).limit(LIMIT),
    supabase.from("subscriptions").select("status, current_period_start, current_period_end, created_at").order("created_at", { ascending: false }).limit(LIMIT),
    supabase.from("account_events").select("kind, device, place, ip, created_at").order("created_at", { ascending: false }).limit(LIMIT),
  ]);

  const body = {
    exported_at: new Date().toISOString(),
    note: "Everything WayTara holds for your account that you can read yourself. Readings (the time series from your devices) are not included: download them as reports.",
    account: account.data,
    customer: customer.data,
    sites: sites.data ?? [],
    devices: equipment.data ?? [],
    alert_rules: rules.data ?? [],
    alerts: alerts.data ?? [],
    support_tickets: tickets.data ?? [],
    support_messages: messages.data ?? [],
    payments: payments.data ?? [],
    subscriptions: subscriptions.data ?? [],
    account_activity: events.data ?? [],
  };

  const day = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="waytara-my-data-${day}.json"`, "Cache-Control": "no-store" },
  });
}
