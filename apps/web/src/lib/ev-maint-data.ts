import "server-only";
import type { createClient } from "@waytara/supabase/server";
import type { CustomerDevice } from "@/lib/selected-site";
import { getLastSyncInfo } from "@/lib/device-sync";
import type { DeviceSyncInit } from "@/lib/device-sync-types";
import type { EnumOption } from "@/lib/enum-labels";
import { fetchEnumOptions } from "@/lib/instrument-catalog-data";
import { fetchFieldValues } from "@/lib/template-fields";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export interface EvMaintEvent {
  id: number;
  ts: string;
  kind: string;
  detail: Record<string, unknown> | null;
}

/** What the Maintenance page's Health tab needs about an EV charger, as the server saw it (the live parts follow the device's live channel). */
export interface EvMaintData {
  /** The monitoring unit the charger connects through, and its own connection state; null when none is linked. */
  unit: { id: string; label: string | null; sync: DeviceSyncInit } | null;
  /** The connector's enum code and the charger's error code as of the page. */
  connector: { status: number | null; error: number | null };
  enums: { connector: EnumOption[]; error: EnumOption[] };
  /** How the last charge that ended ended. */
  lastCharge: { status: string; stopReason: string | null } | null;
  /** The firmware from the charger's last BootNotification. */
  firmware: string | null;
  /** The charger's recent events, newest first (the page shows the first twenty that mean something). */
  events: EvMaintEvent[];
}

const asRecord = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);

export async function fetchEvMaintenance(supabase: SupabaseServerClient, device: CustomerDevice): Promise<EvMaintData> {
  const keys = ["connector_status", "error_code"];
  const [link, events, lastEnded, boot, values, enums] = await Promise.all([
    supabase.from("gateway_chargers").select("gateway_equipment_id").eq("charger_equipment_id", device.id).maybeSingle(),
    supabase.from("ev_events").select("id, ts, kind, detail").eq("equipment_id", device.id).order("ts", { ascending: false }).limit(60),
    supabase.from("ev_sessions").select("status, stop_reason").eq("equipment_id", device.id).not("ended_at", "is", null).order("started_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("ev_events").select("detail").eq("equipment_id", device.id).eq("kind", "boot").order("ts", { ascending: false }).limit(1).maybeSingle(),
    fetchFieldValues(supabase, device.id, keys),
    fetchEnumOptions(supabase, keys),
  ]);

  let unit: EvMaintData["unit"] = null;
  const gatewayId = link.data?.gateway_equipment_id;
  if (gatewayId) {
    const [{ data: eq }, sync] = await Promise.all([supabase.from("equipment").select("label").eq("id", gatewayId).maybeSingle(), getLastSyncInfo(gatewayId)]);
    unit = { id: gatewayId, label: eq?.label ?? null, sync };
  }

  const num = (k: string): number | null => {
    const v = values.get(k);
    return typeof v === "number" ? v : null;
  };
  const firmware = asRecord(boot.data?.detail)?.firmware;
  return {
    unit,
    connector: { status: num("connector_status"), error: num("error_code") },
    enums: { connector: enums.get("connector_status") ?? [], error: enums.get("error_code") ?? [] },
    lastCharge: lastEnded.data ? { status: lastEnded.data.status, stopReason: lastEnded.data.stop_reason ?? null } : null,
    firmware: typeof firmware === "string" && firmware !== "" ? firmware : null,
    events: (events.data ?? []).map((e) => ({ id: e.id, ts: e.ts, kind: e.kind, detail: asRecord(e.detail) })),
  };
}
