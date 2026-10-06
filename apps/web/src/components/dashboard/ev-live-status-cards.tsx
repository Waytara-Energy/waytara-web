import { createClient } from "@waytara/supabase/server";
import type { CustomerSite } from "@/lib/selected-site";
import { fetchTodayEvEnergyKwh, fetchTodayEvSessionSparkline } from "@/lib/device-overview";
import { getCustomerPlan } from "@/lib/customer-plan";
import type { SparkPoint } from "./live-status-card";
import { EvLiveCards } from "./ev-live-cards";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

const SPARK_POINTS = 60;
const KEYS = ["power_active_import_kw", "power_offered_kw", "current_import_l1_a", "voltage_l1_n_v", "connector_temperature_c"];

/** The EV charger's live-status row on Overview. The server renders the first numbers (one equipment_latest read
 *  plus today's charging sessions); EvLiveCards keeps the telemetry-driven ones current from the live channel.
 *  Scoped to the site's first ev_charger, the same "one representative device" rule the solar row uses. */
export async function EvLiveStatusCards({ supabase, site }: { supabase: SupabaseServerClient; site: CustomerSite }) {
  const charger = site.devices.find((d) => d.deviceType?.category === "ev_charger");
  if (!charger) return null;

  const [{ data }, customerPlan, todayEnergyKwh, sessionSparkline] = await Promise.all([
    supabase.from("equipment_latest").select("key_name, value").eq("equipment_id", charger.id).in("key_name", KEYS),
    getCustomerPlan(),
    fetchTodayEvEnergyKwh(supabase, [charger.id]),
    fetchTodayEvSessionSparkline(supabase, charger.id, SPARK_POINTS),
  ]);
  const initial: Record<string, number | null> = Object.fromEntries(KEYS.map((k) => [k, null]));
  for (const r of data ?? []) initial[r.key_name] = r.value === null ? null : Number(r.value);

  // Each bucket is either "delivered something in this slice" (green) or "nothing landed here" (gray). A day with
  // no sessions at all shows no bars rather than a flat zero line.
  const energySparkline: SparkPoint[] = sessionSparkline.some((p) => p.value > 0)
    ? sessionSparkline.map((p) => ({ value: p.value, tone: p.value > 0 ? "green" : "gray", ts: p.ts, display: `${p.value.toFixed(2)} kWh` }))
    : [];

  return (
    <EvLiveCards
      chargerId={charger.id}
      initial={initial}
      todayEnergyKwh={todayEnergyKwh}
      energySparkline={energySparkline}
      tariffRate={customerPlan?.tariffRatePerKwh ?? 8}
    />
  );
}
