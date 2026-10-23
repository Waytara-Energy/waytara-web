// Starting and stopping a charge from the dashboard: the request the hub wants, what its refusals mean in plain words, and the small bits of text the
// Overview's charging strip shows. Pure, so the rules are tested. (The hub: POST /v1/ev/:charger/remote-start and /remote-stop, see
// features/ocpp/routes.ts in the backend; the charger answers through its monitoring unit.)

/** How often the page asks the server again after a start, and for how long, while it waits for the charge to begin. */
export const START_POLL_MS = 3_000;
export const START_WAIT_MS = 30_000;

export interface StartRequest {
  connector_id: number;
  id_tag: string;
  target_kwh?: number;
}

/** The body of a remote start; `targetKwh` (a positive number up to 1000) makes the charge stop by itself after that many units. */
export function startBody(targetKwh: number | null): StartRequest {
  const body: StartRequest = { connector_id: 1, id_tag: "WAYTARA" };
  if (targetKwh !== null && Number.isFinite(targetKwh) && targetKwh > 0) body.target_kwh = Math.min(1000, Math.round(targetKwh * 100) / 100);
  return body;
}

/** The target typed in the field: empty is "no target"; anything that is not a positive number is refused. */
export function parseTarget(text: string): { ok: true; kwh: number | null } | { ok: false } {
  const t = text.trim();
  if (t === "") return { ok: true, kwh: null };
  const n = Number(t);
  return Number.isFinite(n) && n > 0 && n <= 1000 ? { ok: true, kwh: n } : { ok: false };
}

/** A refusal or failure from the hub, in words for the person. `said` is the hub's own message when it sent one. */
export function hubMessage(status: number, said?: string | null): string {
  if (status === 0) return "Could not reach WayTara. Check your connection and try again.";
  if (status === 401) return "Please sign in again.";
  if (status === 404) return "This charger is not available to your account.";
  if (status === 409) return said && said.length < 200 ? said : "The charger is not connected right now.";
  if (status === 429) return "Too many tries. Wait a moment and try again.";
  if (status === 504) return "The charger did not answer. Check that it is on and connected.";
  return said && said.length < 200 ? said : "Something went wrong. Try again.";
}

/** "Just started", "12 min", "1 h 05 min": how long a charge has been going. */
export function elapsedText(startedAtMs: number, nowMs: number): string {
  const min = Math.max(0, Math.floor((nowMs - startedAtMs) / 60_000));
  if (min < 1) return "Just started";
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")} min`;
}

/** What the strip under the energy flow shows. */
export type StripKind = "start" | "details" | "offline" | "unknown";

/**
 * `open`: a charging session is open. `connected`: the charger answers through its unit (null = not known yet). A charge that is open is always shown as
 * details (with Stop), even when the charger has just gone quiet; a charger that is not connected cannot be started.
 */
export function stripKind(a: { open: boolean; connected: boolean | null }): StripKind {
  if (a.open) return "details";
  if (a.connected === false) return "offline";
  if (a.connected === null) return "unknown";
  return "start";
}

/** Units delivered so far in a session, from the meter at its start and the meter now, never negative. */
export function sessionKwh(startKwh: number | null, nowKwh: number | null): number | null {
  if (startKwh === null || nowKwh === null) return null;
  return Math.max(0, nowKwh - startKwh);
}
