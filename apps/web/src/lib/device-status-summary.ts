// What the header's device icons say: the worst connection state of a kind of device, and "how long ago" in words. Pure, so it is tested.

import type { ConnectionStatus } from "./device-state";

const SEVERITY: Record<ConnectionStatus, number> = { online: 0, connection_lost: 1, offline: 2 };

/** The state of a group of devices: the worst one in it (no devices counts as online). */
export function worstStatus(statuses: ConnectionStatus[]): ConnectionStatus {
  return statuses.reduce<ConnectionStatus>((worst, s) => (SEVERITY[s] > SEVERITY[worst] ? s : worst), "online");
}

/** "just now", "5m ago", "4h 16m ago", "2d 3h ago" for a number of milliseconds. */
export function agoText(ms: number): string {
  const minutes = Math.max(0, ms) / 60_000;
  if (minutes < 0.5) return "just now";
  if (minutes < 60) return `${Math.round(minutes)}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${Math.round(minutes % 60)}m ago`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h ago`;
}

/** The newest of several ISO times (the most recent reading across devices), or null. */
export function newestIso(times: (string | null)[]): string | null {
  return times.reduce<string | null>((best, t) => (t !== null && (best === null || t > best) ? t : best), null);
}
