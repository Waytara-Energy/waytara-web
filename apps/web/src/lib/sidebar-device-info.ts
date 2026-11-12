import type { createClient } from "@waytara/supabase/server";
import { fetchEnumOptions, type EnumOption } from "@/lib/instrument-catalog-data";
import { getConnectorStatusLabel } from "@/lib/ev-charger-catalog";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/** What the sidebar says about an EV charger besides its connection: the connector's status as the server last knew it, and its most recent charging session. */
export interface ChargerSidebarInfo {
  /** The connector status in words (null = none yet). */
  status: string | null;
  /** connector_status codes and their words, so the sidebar can name a status it hears live. */
  connectorOptions: EnumOption[];
  /** The newest charging session, finished or still open (null = the charger has never charged). */
  lastSession: { startedAt: string; endedAt: string | null; kwh: number | null } | null;
}

export async function fetchChargerSidebarInfo(supabase: SupabaseServerClient, chargerId: string): Promise<ChargerSidebarInfo> {
  const [session, latest, options] = await Promise.all([
    supabase
      .from("ev_sessions")
      .select("started_at, ended_at, start_energy_kwh, end_energy_kwh, meter_start_wh, meter_stop_wh")
      .eq("equipment_id", chargerId)
      .eq("is_test", false)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("equipment_latest").select("value").eq("equipment_id", chargerId).eq("key_name", "connector_status").maybeSingle(),
    fetchEnumOptions(supabase, ["connector_status"]).then((m) => m.get("connector_status") ?? []),
  ]);
  const row = session.data;
  // energy delivered: the charger's own energy register when it has one, else its OCPP meter (Wh)
  const kwh = !row
    ? null
    : row.ended_at === null
      ? null
      : row.start_energy_kwh !== null && row.end_energy_kwh !== null
        ? Math.max(0, row.end_energy_kwh - row.start_energy_kwh)
        : row.meter_start_wh !== null && row.meter_stop_wh !== null
          ? Math.max(0, (row.meter_stop_wh - row.meter_start_wh) / 1000)
          : null;
  const code = latest.data?.value ?? null;
  return {
    status: code === null ? null : getConnectorStatusLabel(Number(code), options).label,
    connectorOptions: options,
    lastSession: row ? { startedAt: row.started_at, endedAt: row.ended_at, kwh } : null,
  };
}
