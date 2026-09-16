import "server-only";
import { createClient } from "@waytara/supabase/server";
import type { CustomerDevice, CustomerSite } from "./selected-site";
import { TODAY_ENERGY_FIELDS } from "./telemetry-catalog";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// Instruments a device's full detail view needs — filtered explicitly
// rather than "most recent N readings across every instrument" (the old
// approach), since the catalog now has 29 instruments and a flat top-50
// window could miss one that just hasn't reported as often as the others.
export const OVERVIEW_KEYS = [
  "inverter_power_w",
  "battery_power_w",
  "grid_power_w",
  "load_power_w",
  "battery_soc_pct",
  "inverter_state",
  "active_fault_code",
  ...TODAY_ENERGY_FIELDS.map((f) => f.key),
];

export interface AlertRow {
  id: string;
  device_id: string;
  severity: string;
  message: string;
  ts: string;
  acknowledged_at: string | null;
}

export interface DeviceOverviewData {
  get: (key: string) => number | null;
  /** The site's EV charger reading in W, or null when the site has no
   *  charger at all (distinct from a charger reporting 0 W). */
  evW: number | null;
  recentAlerts: AlertRow[];
}

/** Shared by the site Overview page (for its primary device) and a
 *  device's own detail page — both render the exact same energy-flow
 *  diagram / fault banner / today-so-far / recent-alerts block, just
 *  reached two different ways, so the data-fetching lives in one place
 *  rather than drifting between two copies. */
export async function fetchDeviceOverview(supabase: SupabaseServerClient, site: CustomerSite, device: CustomerDevice): Promise<DeviceOverviewData> {
  // The EV charger, if this site has one — a separate device from
  // `device` (could even be this same device), so its charging power is
  // fetched alongside `device`'s own readings rather than folded into
  // OVERVIEW_KEYS, which is scoped to the inverter's registers. Only the
  // *first* charger is shown if a site somehow had more than one — same
  // "one representative reading" simplification as everything else here.
  const evCharger = site.devices.find((d) => d.deviceType?.category === "ev_charger");

  // Simplification: takes the most recent readings within a bounded window
  // (per the fixed key list above, not every instrument) rather than a
  // true "latest value per instrument" query (needs a DISTINCT ON not
  // easily expressed through the query builder). Fine for an overview
  // snapshot.
  const [{ data: recentReadings }, { data: recentAlerts }, { data: evReadings }] = await Promise.all([
    supabase
      .from("device_readings")
      .select("instrument_key, value, unit, ts")
      .eq("device_id", device.id)
      .in("instrument_key", OVERVIEW_KEYS)
      .order("ts", { ascending: false })
      .limit(OVERVIEW_KEYS.length * 5),
    supabase
      .from("alerts")
      .select("id, device_id, severity, message, ts, acknowledged_at")
      .eq("device_id", device.id)
      .is("acknowledged_at", null)
      .order("ts", { ascending: false })
      .limit(5),
    evCharger
      ? supabase
          .from("device_readings")
          .select("value, ts")
          .eq("device_id", evCharger.id)
          .eq("instrument_key", "charging_power_kw")
          .order("ts", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const latest = new Map<string, number | null>();
  for (const r of recentReadings ?? []) {
    if (!latest.has(r.instrument_key)) latest.set(r.instrument_key, r.value);
  }

  return {
    get: (key: string) => latest.get(key) ?? null,
    // kW (how the charger reports it) -> W (what the diagram's other
    // readings are already in) — null (not 0) when there's no charger at
    // all, so the diagram knows to leave it off entirely rather than show
    // a charger reading 0 W.
    evW: evCharger ? Math.round((evReadings?.value ?? 0) * 1000) : null,
    recentAlerts: (recentAlerts ?? []) as AlertRow[],
  };
}
