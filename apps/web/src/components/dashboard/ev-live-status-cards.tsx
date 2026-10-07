import { createClient } from "@waytara/supabase/server";
import type { CustomerSite } from "@/lib/selected-site";
import { fetchTodayEvEnergyKwh } from "@/lib/device-overview";
import { getCustomerPlan } from "@/lib/customer-plan";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

const KEYS = ["power_active_import_kw", "power_offered_kw", "current_import_l1_a", "voltage_l1_n_v", "connector_temperature_c"];

export interface EvCardsProps {
  chargerId: string;
  initial: Record<string, number | null>;
  todayEnergyKwh: number | null;
  tariffRate: number;
}

/** The first numbers of the EV charger's cards on Overview (one equipment_latest read plus today's charging sessions);
 *  EvLiveCards keeps the telemetry-driven ones current from the live channel. Scoped to the site's first ev_charger,
 *  the same "one representative device" rule the solar cards use. Null if the site has no charger. */
export async function fetchEvCardsProps(supabase: SupabaseServerClient, site: CustomerSite): Promise<EvCardsProps | null> {
  const charger = site.devices.find((d) => d.deviceType?.category === "ev_charger");
  if (!charger) return null;

  const [{ data }, customerPlan, todayEnergyKwh] = await Promise.all([
    supabase.from("equipment_latest").select("key_name, value").eq("equipment_id", charger.id).in("key_name", KEYS),
    getCustomerPlan(),
    fetchTodayEvEnergyKwh(supabase, [charger.id]),
  ]);
  const initial: Record<string, number | null> = Object.fromEntries(KEYS.map((k) => [k, null]));
  for (const r of data ?? []) initial[r.key_name] = r.value === null ? null : Number(r.value);
  return { chargerId: charger.id, initial, todayEnergyKwh, tariffRate: customerPlan?.tariffRatePerKwh ?? 8 };
}
