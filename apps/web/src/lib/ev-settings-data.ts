import "server-only";
import type { createClient } from "@waytara/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** What the Devices page says about how an EV charger is connected: the name in its address, the monitoring unit it goes through, and what it said
 *  about itself when it last started up (vendor, model, serial number, firmware). Anything not known yet is null. */
export interface EvConnectionInfo {
  chargePointId: string | null;
  unitLabel: string | null;
  vendor: string | null;
  model: string | null;
  serial: string | null;
  firmware: string | null;
}

const text = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);

export async function fetchEvConnection(supabase: Supabase, chargerId: string): Promise<EvConnectionInfo> {
  const [bound, boot] = await Promise.all([
    supabase.from("gateway_chargers").select("charge_point_id, gateway_equipment_id").eq("charger_equipment_id", chargerId).maybeSingle(),
    supabase.from("ev_events").select("detail").eq("equipment_id", chargerId).eq("kind", "boot").order("ts", { ascending: false }).limit(1).maybeSingle(),
  ]);
  let unitLabel: string | null = null;
  if (bound.data?.gateway_equipment_id) {
    const { data } = await supabase.from("equipment").select("label").eq("id", bound.data.gateway_equipment_id).maybeSingle();
    unitLabel = text(data?.label);
  }
  const d = (boot.data?.detail ?? {}) as Record<string, unknown>;
  return {
    chargePointId: bound.data?.charge_point_id ?? null,
    unitLabel,
    vendor: text(d.vendor),
    model: text(d.model),
    serial: text(d.serial),
    firmware: text(d.firmware),
  };
}
