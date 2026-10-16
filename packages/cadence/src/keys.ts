// Talks to the WayTara backend's key endpoints (create, rotate, revoke a board's or charger's secret), signed in as the person using
// the page. Runs in the browser. The backend decides who may manage which device; this only asks and reports what it answered.
// A secret comes back exactly once, in the answer to create or rotate: the caller shows it and never stores it.

export interface IssuedKey {
  key_id: string;
  equipment_id: string;
  kind: "gateway" | "charger";
  fingerprint: string;
  /** shown once */
  secret: string;
  created_at: string;
  replaces?: string;
}

export class KeysApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "KeysApiError";
    this.status = status;
  }
}

export interface KeysClientOptions {
  baseUrl: string;
  getToken: () => Promise<string | null>;
  fetch?: typeof fetch;
}

const plainMessage = (status: number): string =>
  status === 401
    ? "Please sign in again."
    : status === 404
      ? "You can't manage keys for this device, or it no longer exists."
      : status === 409
        ? "That conflicts with the current state. Refresh the page and look again."
        : status === 429
          ? "Too many requests. Wait a minute and try again."
          : status >= 500
            ? "The service is unavailable right now. Try again in a moment."
            : "The request was not accepted.";

export function createKeysClient(o: KeysClientOptions) {
  const base = o.baseUrl.replace(/\/+$/, "");
  const doFetch = o.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a));

  async function call<T>(method: "POST" | "DELETE", path: string, body: unknown): Promise<T> {
    const token = await o.getToken();
    if (!token) throw new KeysApiError(401, plainMessage(401));
    let res: Response;
    try {
      res = await doFetch(`${base}${path}`, {
        method,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      });
    } catch {
      throw new KeysApiError(0, "Could not reach the service. Check your connection and try again.");
    }
    if (!res.ok) throw new KeysApiError(res.status, plainMessage(res.status));
    return (await res.json()) as T;
  }

  return {
    /** A new secret for a device that has none (a charger key for a charger, a gateway key for anything else). */
    create(equipmentId: string, kind: "gateway" | "charger", label?: string): Promise<IssuedKey> {
      return call("POST", `/v1/equipment/${encodeURIComponent(equipmentId)}/keys`, label?.trim() ? { kind, label: label.trim() } : { kind });
    },
    /** A new secret in place of the current one; the old one stops working after `graceSeconds` (0 = at once). */
    rotate(keyId: string, graceSeconds = 0): Promise<IssuedKey> {
      return call("POST", `/v1/keys/${encodeURIComponent(keyId)}/rotate`, { grace_seconds: graceSeconds });
    },
    /** A single-use ticket (valid 15 minutes) that lets one board, named by its hardware id, collect the key of this equipment. */
    issueClaimTicket(equipmentId: string, hardwareId: string): Promise<{ ticket: string; expires_at: string }> {
      return call("POST", `/v1/equipment/${encodeURIComponent(equipmentId)}/claim-tickets`, { hardware_id: hardwareId });
    },
    /** Unlinks the monitoring unit from this device and cuts its key off, so the unit can be set up for another device. `released` is false when no unit was linked. */
    releaseBoard(equipmentId: string): Promise<{ released: boolean }> {
      return call("POST", `/v1/equipment/${encodeURIComponent(equipmentId)}/release`, {});
    },
    /** Stops a secret working at once. */
    revoke(keyId: string, reason?: string): Promise<{ revoked: boolean }> {
      return call("DELETE", `/v1/keys/${encodeURIComponent(keyId)}`, reason?.trim() ? { reason: reason.trim() } : {});
    },
  };
}

export type KeysClient = ReturnType<typeof createKeysClient>;

/** The address to type into a charger's app: the secret and the charger's name in the path. The name is limited to what an address
 *  can carry, so a label like "ECR Villa #2" becomes "ECR-Villa-2". */
export function chargerAddress(host: string, secret: string, name: string): string {
  const cleaned = name.trim().replace(/[^A-Za-z0-9_.-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "charger";
  return `wss://${host.replace(/^(?:wss?|https?):\/\//, "").replace(/\/+$/, "")}/ocpp/${secret}/${cleaned}`;
}
