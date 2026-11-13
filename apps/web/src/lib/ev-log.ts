import type { createClient } from "@waytara/supabase/server";
import { stopReasonLabel } from "@/lib/ev-sessions";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type EvLogTone = "good" | "warn" | "bad" | "info";

/** One line of the charger's log, as the Overview shows it. */
export interface EvLogEntry {
  id: number;
  ts: string;
  text: string;
  tone: EvLogTone;
}

type Detail = Record<string, unknown> | null;
const str = (d: Detail, k: string): string | null => (d && typeof d[k] === "string" && (d[k] as string).trim() !== "" ? (d[k] as string).trim() : null);
const num = (d: Detail, k: string): number | null => (d && typeof d[k] === "number" && Number.isFinite(d[k] as number) ? (d[k] as number) : null);
const asRecord = (v: unknown): Detail => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);

/** Who asked for it, when the event carries a name ("by Manoj"); nothing when it does not. */
function by(d: Detail): string {
  const who = str(d, "by") ?? str(d, "user") ?? str(d, "actor") ?? str(d, "requested_by");
  return who ? ` · by ${who}` : "";
}

/**
 * One charger event as a short line for the Overview's log, or null for the ones that are not worth a line there (connector status steps that are not
 * trouble, card swipes, raw data transfers). The detailed log is the Maintenance page's.
 */
export function evLogLine(kind: string, d: Detail): { text: string; tone: EvLogTone } | null {
  switch (kind) {
    case "command": {
      const c = (str(d, "command") ?? "").toLowerCase();
      if (c.includes("start")) return { text: `Start requested${by(d)}`, tone: "info" };
      if (c.includes("stop")) return { text: `Stop requested${by(d)}`, tone: "info" };
      return c ? { text: `Command: ${c.replace(/[-_]/g, " ")}${by(d)}`, tone: "info" } : null;
    }
    case "transaction_start": {
      const t = num(d, "target_kwh");
      return { text: `Charge started${t !== null ? ` · ${t} kWh limit` : " · no limit"}${by(d)}`, tone: "good" };
    }
    case "transaction_stop": {
      const kwh = num(d, "energy_kwh");
      const why = stopReasonLabel(str(d, "reason"));
      return { text: `Charge ended${kwh !== null ? ` · ${kwh.toFixed(2)} kWh` : ""}${why ? ` · ${why.toLowerCase()}` : ""}${by(d)}`, tone: "info" };
    }
    case "target_reached": {
      const t = num(d, "target_kwh");
      return { text: t !== null ? `Reached the ${t} kWh limit` : "Reached the kWh limit", tone: "info" };
    }
    case "target_stop_failed":
      return { text: "Did not stop at the limit: stop it from the app", tone: "bad" };
    case "connected":
      return { text: "Charger connected", tone: "good" };
    case "disconnected":
      return { text: "Charger disconnected", tone: "warn" };
    case "status": {
      const status = str(d, "status");
      const error = str(d, "error");
      if (status === "Faulted") return { text: `Fault${error && error !== "NoError" ? `: ${error}` : ""}`, tone: "bad" };
      if (status === "Unavailable") return { text: "Connector unavailable", tone: "warn" };
      return null;
    }
    case "session_suspect":
      return { text: "A charge was marked to be checked", tone: "warn" };
    case "session_closed_without_stop":
    case "stop_without_session":
      return { text: "A charge was closed: the charger did not report its end", tone: "warn" };
    default:
      return null;
  }
}

/** The charger's latest log lines, newest first (the Overview shows as many as fit; the rest are on the Maintenance page). */
export async function fetchEvLog(supabase: SupabaseServerClient, chargerId: string, limit = 12): Promise<EvLogEntry[]> {
  const { data } = await supabase.from("ev_events").select("id, ts, kind, detail").eq("equipment_id", chargerId).order("ts", { ascending: false }).limit(80);
  const out: EvLogEntry[] = [];
  for (const e of data ?? []) {
    const line = evLogLine(e.kind, asRecord(e.detail));
    if (line) out.push({ id: e.id, ts: e.ts, ...line });
    if (out.length >= limit) break;
  }
  return out;
}
