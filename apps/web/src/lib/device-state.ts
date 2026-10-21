import { isAgentOnline } from "./agent-online";
import type { DeviceSyncInit, ServerVerdict } from "./device-sync-types";

/** online: readings are coming in. connection_lost: the monitoring unit is alive but cannot reach the device (the
 *  inverter's adapter is off or unreachable). offline: nothing is arriving from the unit at all (it lost power or its
 *  internet - for example an adapter fed by an inverter that was switched off). */
export type ConnectionStatus = "online" | "connection_lost" | "offline";

export interface DeviceState {
  /** When the device last answered a reading. */
  lastReadAt: string | null;
  /** The agent is alive (heard from recently). */
  agentOnline: boolean;
  /** Nothing live is coming from the device: the agent is silent, or the agent says the device does not answer. */
  offline: boolean;
  status: ConnectionStatus;
}

export const CONNECTION_LABEL: Record<Exclude<ConnectionStatus, "online">, string> = {
  connection_lost: "Connection lost",
  offline: "Offline",
};

function newest(a: string | null, b: string | null): string | null {
  if (a === null) return b;
  if (b === null) return a;
  return a > b ? a : b;
}

type LiveInput = {
  lastTickAt: number | null;
  lastReadAt: number | null;
  deviceOnline: boolean | null;
  verdict?: ServerVerdict | null;
  clockOffsetMs?: number | null;
};

/** The server's verdict (online / device unreachable / offline), exactly as it stands. The browser never judges silence itself, with its own
 *  clock or any timer: the server marks a silent unit offline (a job every 10 seconds) and announces every CHANGE of status over the live channel
 *  (Supabase realtime); a page that was hidden or lost the channel re-reads the row. The newest verdict, from the page or from the channel, is the truth. */
function fromVerdict(init: DeviceSyncInit, live: LiveInput): DeviceState | null {
  const fresher = !!live.verdict && (!init.verdict || live.verdict.serverNowMs >= init.verdict.serverNowMs);
  const verdict = fresher ? live.verdict! : init.verdict;
  if (!verdict) return null;
  const iso = (ms: number | null) => (ms === null ? null : new Date(ms).toISOString());
  const status: ConnectionStatus = verdict.status === "offline" || verdict.status === "never_seen" ? "offline" : verdict.status === "device_unreachable" ? "connection_lost" : "online";
  return { lastReadAt: newest(init.lastTs, iso(live.lastReadAt)), agentOnline: status !== "offline", offline: status !== "online", status };
}

/** Combines what the server rendered with what the live messages have said since. `nowMs` is read only for a device the server has no verdict for (older setups). */
export function computeDeviceState(init: DeviceSyncInit, live: LiveInput, nowMs: number): DeviceState {
  const judged = fromVerdict(init, live);
  if (judged) return judged;
  // No verdict from the server (before the status migration): the older judgement from the raw check-in times.
  const iso = (ms: number | null) => (ms === null ? null : new Date(ms).toISOString());
  const lastReadAt = newest(init.lastTs, iso(live.lastReadAt));
  const agentSeen = newest(init.agentSeenTs, iso(live.lastTickAt));
  const agentOnline = isAgentOnline(agentSeen, nowMs, init.heartbeatS ?? init.intervalS);
  const explicit = live.deviceOnline ?? init.deviceOnline;
  const deviceSilent = explicit === false || (explicit === null && !isAgentOnline(lastReadAt, nowMs, init.intervalS));
  const status: ConnectionStatus = !agentOnline ? "offline" : deviceSilent ? "connection_lost" : "online";
  return { lastReadAt, agentOnline, offline: status !== "online", status };
}
