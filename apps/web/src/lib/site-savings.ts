import "server-only";
import type { createClient } from "@waytara/supabase/server";
import { getCustomerPlan } from "@/lib/customer-plan";
import { fetchDailyMaxReadings } from "@/lib/device-readings-fetch";
import { DAY_KEYS, LIFETIME_KEYS } from "@/lib/performance-metrics";
import { daysFromRows, lifetimeBillFor, lifetimeFrom, pricedMonths, type Lifetime } from "@/lib/reports/solar-history";
import { paybackMonths, recentSavedPerDay, type DayEnergy } from "@/lib/savings";
import type { CustomerSite } from "@/lib/selected-site";
import { sessionEnergyKwh } from "@/lib/ev-sessions";
import { fetchResolvedTariff } from "@/lib/tariff-server";
import { getTotalInvested } from "@/lib/total-invested";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

const HISTORY_DAYS = 365;

/** What the Overview's "cost and savings" and "CO2 saved" tiles show: the whole life of the site so far, not one day. */
export interface SiteSavings {
  /** What the solar has saved on the electricity bill since it started (the same sum as Performance's Cost & Savings), rupees; null when the counters are not available. */
  savedTotal: number | null;
  /** This month's bill without the solar and with it, rupees. */
  month: { label: string; withoutSolar: number; withSolar: number; saved: number } | null;
  /** What was paid for the system (every paid payment), rupees. */
  invested: number;
  /** Months until the savings have paid for it at the recent pace: 0 = already, null = not known yet. */
  paybackMonths: number | null;
  /** The solar energy made since it started, kWh (the inverters' own lifetime counters). */
  solarKwh: number | null;
  /** Everything the chargers have delivered, kWh, and the part of it drawn from the grid (what the meters could not place is not counted as grid). */
  evKwh: number;
  evGridKwh: number;
}

/** The days of several inverters at one site, added day by day. */
function mergeDays(all: DayEnergy[][]): DayEnergy[] {
  const byDay = new Map<string, DayEnergy>();
  for (const days of all)
    for (const d of days) {
      const m = byDay.get(d.day);
      if (!m) byDay.set(d.day, { ...d });
      else {
        m.loadKwh += d.loadKwh;
        m.importKwh += d.importKwh;
        m.exportKwh += d.exportKwh;
        m.pvKwh = (m.pvKwh ?? 0) + (d.pvKwh ?? 0);
      }
    }
  return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
}

/**
 * The site's savings so far, from the same sources as the Performance page (the daily rollups, the inverters' lifetime counters, the tariff in force and the
 * payments), so the figures agree with it. Null when the site has nothing to work from or a read fails: the Overview then leaves the tiles' figures empty and
 * never breaks.
 */
export async function fetchSiteSavings(supabase: SupabaseServerClient, site: CustomerSite): Promise<SiteSavings | null> {
  try {
    const inverters = site.devices.filter((d) => d.deviceType?.category === "solar_inverter");
    const chargers = site.devices.filter((d) => d.deviceType?.category === "ev_charger");
    if (inverters.length === 0 && chargers.length === 0) return null;
    const plan = await getCustomerPlan();
    const tariff = await fetchResolvedTariff(supabase, site, plan?.tariffRatePerKwh ?? 8);
    const rates = { rate: tariff.rate, exportRate: tariff.exportRate, schedule: tariff.schedule, netMetering: tariff.netMetering };
    const today = new Date(Date.now() + 19_800_000).toISOString().slice(0, 10);
    const since = new Date(Date.now() - HISTORY_DAYS * 86_400_000).toISOString();
    const lifetimeKeys = [LIFETIME_KEYS.pv, LIFETIME_KEYS.load, LIFETIME_KEYS.imported, LIFETIME_KEYS.exported];

    const [invested, perInverter, sessions] = await Promise.all([
      getTotalInvested(supabase),
      Promise.all(
        inverters.map(async (d) => {
          const [rows, { data: latestRows }] = await Promise.all([
            fetchDailyMaxReadings(supabase, d.id, [DAY_KEYS.pv, DAY_KEYS.load, DAY_KEYS.imported, DAY_KEYS.exported], since),
            supabase.from("equipment_latest").select("key_name, value").eq("equipment_id", d.id).in("key_name", lifetimeKeys),
          ]);
          const latest = new Map((latestRows ?? []).map((r) => [r.key_name, r.value]));
          const pv = latest.get(LIFETIME_KEYS.pv);
          return { days: daysFromRows(rows), lifetime: lifetimeFrom(latest), pvKwh: typeof pv === "number" ? pv : null };
        })
      ),
      chargers.length === 0
        ? Promise.resolve([])
        : supabase
            .from("ev_sessions")
            .select("start_energy_kwh, end_energy_kwh, meter_start_wh, meter_stop_wh, energy_from_grid_kwh")
            .in("equipment_id", chargers.map((c) => c.id))
            .not("ended_at", "is", null)
            .limit(5000)
            .then((r) => r.data ?? []),
    ]);

    let savedTotal: number | null = null;
    let month: SiteSavings["month"] = null;
    let payback: number | null = null;
    let solarKwh: number | null = null;
    if (inverters.length > 0) {
      const days = mergeDays(perInverter.map((p) => p.days));
      const months = pricedMonths(days, tariff.timeline, rates, today);
      const parts = perInverter.flatMap((p) => (p.lifetime ? [p.lifetime] : []));
      const lifetime: Lifetime | null =
        parts.length === 0 || parts.length < perInverter.length
          ? null
          : parts.reduce((a, b) => ({ loadKwh: a.loadKwh + b.loadKwh, importKwh: a.importKwh + b.importKwh, exportKwh: a.exportKwh + b.exportKwh, pvKwh: a.pvKwh + b.pvKwh }));
      savedTotal = lifetimeBillFor(days, months, lifetime, rates)?.saved ?? null;
      const current = months.find((m) => m.month === today.slice(0, 7));
      month = current ? { label: current.label, withoutSolar: current.bill.withoutSolar, withSolar: current.bill.withSolar, saved: current.bill.saved } : null;
      payback = paybackMonths(invested, savedTotal ?? 0, recentSavedPerDay(days, rates));
      const pvs = perInverter.map((p) => p.pvKwh);
      solarKwh = pvs.every((v) => v !== null) ? (pvs as number[]).reduce((a, b) => a + b, 0) : null;
    }

    let evKwh = 0;
    let evGridKwh = 0;
    for (const s of sessions) {
      const kwh = sessionEnergyKwh(s);
      if (kwh === null) continue;
      evKwh += kwh;
      // a charge whose source split is not on file counts as drawn from the grid (the cautious way round)
      evGridKwh += s.energy_from_grid_kwh !== null ? Math.min(kwh, s.energy_from_grid_kwh) : kwh;
    }
    return { savedTotal, month, invested, paybackMonths: payback, solarKwh, evKwh, evGridKwh };
  } catch {
    return null;
  }
}
