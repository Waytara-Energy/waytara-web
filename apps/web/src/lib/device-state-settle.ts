import type { ConnectionStatus, DeviceState } from "./device-state";

// A device is shown as inactive (offline, or connection lost) only when it really is. The server's verdict can flip for a moment when a check-in is a few seconds late,
// and a page that has only just loaded has not yet re-read it. So the dashboard keeps showing what it last knew until (1) the page has finished loading and re-read the
// status, and (2) a device that was working has stayed inactive for a short grace period, after which the status is read again from the server. Coming back online is
// never delayed. Pure, so the rules are tested.

/** How long a device that was working must stay inactive before the dashboard shows it as inactive. */
export const SETTLE_GRACE_MS = 20_000;

export interface SettleMemory {
  /** What the dashboard last showed for this device (kept between visits), or null when it never has. */
  shown: ConnectionStatus | null;
  /** When the device was first seen inactive in the current stretch (ms), or null. */
  since: number | null;
}

export interface Settled {
  shown: ConnectionStatus;
  mem: SettleMemory;
  /** How long until the decision should be looked at again, or null when nothing is pending. */
  waitMs: number | null;
}

/**
 * `raw` is the status as the server's verdict and the live channel say it now. `ready` is true once the page has finished loading and re-read the status.
 *  - online: shown at once.
 *  - not ready yet: the last status shown (or online when there is none): nothing inactive is announced from a half-loaded page.
 *  - nothing known before: the status as it is.
 *  - already shown as inactive: follows the raw status at once (offline <-> connection lost).
 *  - was working and is now inactive: stays "online" for the grace period, then becomes inactive if it still is.
 */
export function settleStatus(raw: ConnectionStatus, ready: boolean, now: number, mem: SettleMemory): Settled {
  if (raw === "online") return { shown: "online", mem: { shown: "online", since: null }, waitMs: null };
  if (!ready) return { shown: mem.shown ?? "online", mem, waitMs: null };
  if (mem.shown === null) return { shown: raw, mem: { shown: raw, since: null }, waitMs: null };
  if (mem.shown !== "online") return { shown: raw, mem: { shown: raw, since: null }, waitMs: null };
  const since = mem.since ?? now;
  const waited = now - since;
  if (waited >= SETTLE_GRACE_MS) return { shown: raw, mem: { shown: raw, since: null }, waitMs: null };
  return { shown: "online", mem: { shown: "online", since }, waitMs: SETTLE_GRACE_MS - waited };
}

/** The raw state with the status that is to be shown put in its place (the other fields follow it). */
export function applyShown(raw: DeviceState, shown: ConnectionStatus): DeviceState {
  if (raw.status === shown) return raw;
  return { ...raw, status: shown, offline: shown !== "online", agentOnline: shown !== "offline" };
}
