import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";
import { createServiceRoleClient } from "@waytara/supabase/service-role";
import { categoryForPropertyType, matchState, type TariffCategory } from "@/lib/tariff";
import { sendTariffEmail } from "@/lib/tariff-email";

// The daily rate check (pg_cron calls this at 06:00 India time; see migration 20261009000000_electricity_tariffs.sql).
// Electricity rates change by regulator's order, on a stated date, so the rates table holds each rate with the date it takes
// effect (a staff member enters the order ahead of time, or on the day). Each morning this job:
//   1. turns every rate whose date has arrived into a recorded change (what it changed from, and to);
//   2. e-mails the customers it affects - the ones with a site in that state of that kind of property - once.
// A first-ever rate for a state, or one equal to the rate before it, is recorded but nobody is told: nothing changed for them.
// No signed-in user exists for a scheduled job, so this is one of the legitimate service_role cases.

const istToday = () => new Date(Date.now() + 19_800_000).toISOString().slice(0, 10);

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req, "update-tariffs")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServiceRoleClient();
  const today = istToday();

  const [rates, recorded] = await Promise.all([
    supabase.from("electricity_tariffs").select("id, state, category, rate_per_kwh, effective_from").lte("effective_from", today).order("effective_from"),
    supabase.from("tariff_changes").select("tariff_id"),
  ]);
  if (rates.error) return NextResponse.json({ error: rates.error.message }, { status: 500 });
  if (recorded.error) return NextResponse.json({ error: recorded.error.message }, { status: 500 });

  // 1. rates that have taken effect and are not recorded yet
  const done = new Set((recorded.data ?? []).map((r) => r.tariff_id));
  const byKey = new Map<string, NonNullable<typeof rates.data>>();
  for (const r of rates.data ?? []) {
    const k = `${r.state}|${r.category}`;
    byKey.set(k, [...(byKey.get(k) ?? []), r]);
  }
  const toRecord: { tariff_id: string; state: string; category: string; old_rate: number | null; new_rate: number; effective_from: string; notified_at: string | null }[] = [];
  for (const list of byKey.values()) {
    list.forEach((r, i) => {
      if (done.has(r.id)) return;
      const before = i > 0 ? Number(list[i - 1].rate_per_kwh) : null;
      const changed = before !== null && before !== Number(r.rate_per_kwh);
      toRecord.push({ tariff_id: r.id, state: r.state, category: r.category, old_rate: before, new_rate: Number(r.rate_per_kwh), effective_from: r.effective_from, notified_at: changed ? null : new Date().toISOString() });
    });
  }
  if (toRecord.length > 0) {
    const { error } = await supabase.from("tariff_changes").insert(toRecord);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 2. tell the customers a change affects
  const { data: pending, error: pendingError } = await supabase.from("tariff_changes").select("id, state, category, old_rate, new_rate, effective_from").is("notified_at", null);
  if (pendingError) return NextResponse.json({ error: pendingError.message }, { status: 500 });

  let emails = 0;
  let announced = 0;
  if ((pending ?? []).length > 0) {
    const { data: sites } = await supabase.from("sites").select("name, property_type, address, customer_id");
    const customerIds = [...new Set((sites ?? []).map((s) => s.customer_id))];
    const { data: profiles } = customerIds.length
      ? await supabase.from("profiles").select("id, email, full_name, notification_preferences, deactivated_at, deleted_at").in("id", customerIds)
      : { data: [] };
    const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

    for (const change of pending ?? []) {
      const affected = new Map<string, string[]>(); // customer -> their sites
      for (const s of sites ?? []) {
        const state = matchState((s.address as { state?: string } | null)?.state);
        if (state !== change.state || categoryForPropertyType(s.property_type) !== (change.category as TariffCategory)) continue;
        affected.set(s.customer_id, [...(affected.get(s.customer_id) ?? []), s.name]);
      }
      let allSent = true;
      for (const [customerId, siteNames] of affected) {
        const p = profileById.get(customerId);
        const prefs = (p?.notification_preferences as { email_alerts?: boolean } | null) ?? {};
        if (!p || !p.email || p.deactivated_at || p.deleted_at || prefs.email_alerts === false) continue;
        const sent = await sendTariffEmail(p.email, { customerName: p.full_name, state: change.state, category: change.category as TariffCategory, oldRate: Number(change.old_rate), newRate: Number(change.new_rate), effectiveFrom: change.effective_from, siteNames });
        if (sent) emails += 1;
        else allSent = false;
      }
      // A change nobody could be e-mailed about (no one affected, or no mail key yet) is settled; one whose sends failed is retried tomorrow.
      if (allSent || process.env.RESEND_API_KEY === undefined) {
        await supabase.from("tariff_changes").update({ notified_at: new Date().toISOString() }).eq("id", change.id);
        announced += 1;
      }
    }
  }

  return NextResponse.json({ today, recorded: toRecord.length, announced, emails });
}
