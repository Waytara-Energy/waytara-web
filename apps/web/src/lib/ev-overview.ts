import type { createClient } from "@waytara/supabase/server";
import { fetchTodayChargingSessions } from "@/lib/device-overview";
import { getLastSyncInfo } from "@/lib/device-sync";
import { getConnectorStatusLabel } from "@/lib/ev-charger-catalog";
import { fetchEnumOptions, type EnumOption } from "@/lib/instrument-catalog-data";
import { sessionKwh } from "@/lib/ev-control";
import { EV_LIVE_KEYS } from "@/lib/ev-live-keys";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/** A charging session that is open right now. */
export interface OpenCharge {
  id: string;
  /** the charger's own number for it (needed to stop it), when the charger has given one */
  transactionId: number | null;
  startedAt: string;
  /** the charger's energy register when the charge began, so a live reading of the register gives the energy so far */
  startEnergyKwh: number | null;
  /** the "stop after" the person asked for when starting it, kWh (null = no limit) */
  targetKwh: number | null;
  kwh: number | null;
  kw: number | null;
}

/** What the Overview needs about the site's charger: its connection, its connector status, the day's energy and the charge that is open. */
export interface EvOverview {
  chargerId: string;
  /** the charger answers through its unit (null = no verdict yet) */
  connected: boolean | null;
  /** the connector status in words, or "Offline" */
  status: string | null;
  /** energy of today's sessions, kWh */
  todayKwh: number | null;
  open: OpenCharge | null;
  /** the live table's newest value for each of the keys the Overview follows (the live channel keeps them current afterwards) */
  latest: Record<string, number | null>;
  /** connector_status codes and their words, so the page can name a status it hears live */
  connectorOptions: EnumOption[];
}

export async function fetchEvOverview(supabase: SupabaseServerClient, chargerId: string): Promise<EvOverview> {
  const [today, sync, options, openRow, latestRows] = await Promise.all([
    fetchTodayChargingSessions(supabase, chargerId),
    getLastSyncInfo(chargerId).catch(() => null),
    fetchEnumOptions(supabase, ["connector_status"]).then((m) => m.get("connector_status") ?? []),
    supabase.from("ev_sessions").select("id, ocpp_transaction_id, started_at, start_energy_kwh, target_kwh").eq("equipment_id", chargerId).is("ended_at", null).order("started_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("equipment_latest").select("key_name, value").eq("equipment_id", chargerId).in("key_name", EV_LIVE_KEYS),
  ]);
  const latest: Record<string, number | null> = Object.fromEntries(EV_LIVE_KEYS.map((k) => [k, null]));
  for (const r of latestRows.data ?? []) latest[r.key_name] = r.value === null ? null : Number(r.value);

  const verdict = sync?.verdict?.status ?? null;
  const connected = verdict === null ? null : verdict === "online";
  const label = today.connectorStatus === null ? null : getConnectorStatusLabel(today.connectorStatus, options).label;
  const status = connected === false ? "Offline" : label;

  const energies = today.sessions.map((s) => s.energyKwh).filter((v): v is number => v !== null);
  const todayKwh = energies.length > 0 ? energies.reduce((a, b) => a + b, 0) : today.sessions.length > 0 ? null : 0;

  let open: OpenCharge | null = null;
  const row = openRow.data;
  if (row) {
    const live = today.sessions.find((s) => s.id === row.id);
    open = {
      id: row.id,
      transactionId: row.ocpp_transaction_id,
      startedAt: row.started_at,
      startEnergyKwh: row.start_energy_kwh,
      targetKwh: row.target_kwh,
      kwh: live?.energyKwh ?? sessionKwh(row.start_energy_kwh, null),
      kw: today.currentPowerW === null ? null : today.currentPowerW / 1000,
    };
  }
  return { chargerId, connected, status, todayKwh, open, latest, connectorOptions: options };
}
