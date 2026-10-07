import { createClient } from "@waytara/supabase/server";
import type { CustomerSite } from "@/lib/selected-site";
import type { DeviceSyncInit } from "@/lib/device-sync-types";
import { SolarLiveCards } from "./solar-live-cards";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

const KEYS = ["inverter_output_power_w", "load_total_power_w", "battery_soc_pct", "grid_total_power_w", "battery_power_w"];

/** Overview's live-status row (Solar Generated / Consumption / Battery / Grid Interaction). The server only
 *  renders the first numbers - one equipment_latest read for the site's first solar inverter; SolarLiveCards
 *  then keeps them current from the live channel with no page refresh. Renders nothing if the site has no
 *  inverter. Solar generation here is the inverter's output power (what the energy-flow diagram also shows). */
export async function SolarLiveStatusCards({ supabase, site, sync }: { supabase: SupabaseServerClient; site: CustomerSite; sync: DeviceSyncInit }) {
  const inverter = site.devices.find((d) => d.deviceType?.category === "solar_inverter");
  if (!inverter) return null;

  const { data } = await supabase.from("equipment_latest").select("key_name, value").eq("equipment_id", inverter.id).in("key_name", KEYS);
  const initial: Record<string, number | null> = Object.fromEntries(KEYS.map((k) => [k, null]));
  for (const r of data ?? []) initial[r.key_name] = r.value === null ? null : Number(r.value);

  return <SolarLiveCards inverterId={inverter.id} initial={initial} sync={sync} />;
}
