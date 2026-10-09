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

// The server's clock minus this browser's, measured the first time a page's own render data is used (so a clock that is fast or
// slow never makes a healthy device look silent).
const initOffsets = new WeakMap<object, number>();
function initOffset(init: DeviceSyncInit, nowMs: number): number {
  if (!init.verdict) return 0;
  let offset = initOffsets.get(init);
  if (offset === undefined) {
    offset = init.verdict.serverNowMs - nowMs;
    initOffsets.set(init, offset);
  }
  return offset;
}

type LiveInput = {
  lastTickAt: number | null;
  lastReadAt: number | null;
  deviceOnline: boolean | null;
  verdict?: ServerVerdict | null;
  clockOffsetMs?: number | null;
};

/** The server's verdict (online / device unreachable / offline), taken as the truth and only ever made stricter locally: if the
 *  unit has said nothing for longer than the server's own offline limit, by the server's clock, it shows offline even if no
 *  newer verdict has arrived yet. */
function fromVerdict(init: DeviceSyncInit, live: LiveInput, nowMs: number): DeviceState | null {
  const fresher = !!live.verdict && (!init.verdict || live.verdict.serverNowMs >= init.verdict.serverNowMs);
  const verdict = fresher ? live.verdict! : init.verdict;
  if (!verdict) return null;
  const offset = fresher ? (live.clockOffsetMs ?? initOffset(init, nowMs)) : initOffset(init, nowMs);
  const serverNow = nowMs + offset;
  const heardMs = Math.max(verdict.lastSeenMs ?? 0, live.lastTickAt !== null ? live.lastTickAt + offset : 0);
  const silentS = heardMs > 0 ? (serverNow - heardMs) / 1000 : Infinity;
  const iso = (ms: number | null) => (ms === null ? null : new Date(ms).toISOString());
  let status: ConnectionStatus;
  if (verdict.status === "offline" || verdict.status === "never_seen") status = "offline";
  else if (silentS > verdict.offlineAfterS) status = "offline";
  else status = verdict.status === "device_unreachable" ? "connection_lost" : "online";
  return { lastReadAt: newest(init.lastTs, iso(live.lastReadAt)), agentOnline: status !== "offline", offline: status !== "online", status };
}

/** Combines what the server rendered with what the live messages have said since (epoch ms, or null). */
export function computeDeviceState(init: DeviceSyncInit, live: LiveInput, nowMs: number): DeviceState {
  const judged = fromVerdict(init, live, nowMs);
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
