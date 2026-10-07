import { createClient } from "@waytara/supabase/server";
import type { CustomerSite } from "@/lib/selected-site";
import type { DeviceSyncInit } from "@/lib/device-sync-types";
import { TODAY_COUNTER_KEYS } from "@/lib/energy-today";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

const KEYS = Object.values(TODAY_COUNTER_KEYS);

export interface SolarCardsProps {
  inverterId: string;
  initial: Record<string, number | null>;
  sync: DeviceSyncInit;
  pvKeys: string[];
}

/** The first numbers of Overview's four "today" cards (the inverter's own day counters): one equipment_latest read for
 *  the site's first solar inverter. EnergyTodayCards (inside the Overview board) then keeps them current from the live
 *  channel with no page refresh. Null if the site has no inverter. Solar generation is the sum of the device's PV
 *  inputs (see solar-generation.ts), not the inverter's AC output. */
export async function fetchSolarCardsProps(
  supabase: SupabaseServerClient,
  site: CustomerSite,
  sync: DeviceSyncInit,
  pvKeys: string[]
): Promise<SolarCardsProps | null> {
  const inverter = site.devices.find((d) => d.deviceType?.category === "solar_inverter");
  if (!inverter) return null;

  const { data } = await supabase
    .from("equipment_latest")
    .select("key_name, value")
    .eq("equipment_id", inverter.id)
    .in("key_name", [...KEYS, ...pvKeys]);
  const initial: Record<string, number | null> = Object.fromEntries([...KEYS, ...pvKeys].map((k) => [k, null]));
  for (const r of data ?? []) initial[r.key_name] = r.value === null ? null : Number(r.value);
  return { inverterId: inverter.id, initial, sync, pvKeys };
}
