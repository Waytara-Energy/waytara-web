// Talks to the WayTara backend's cadence report endpoints (GET /v1/reports/cadence...), signed in as the person using the page.
// Runs in the browser. The backend decides who may read what; this only asks and reports what it answered.

import { CADENCE_MAX_KEYS } from "./range";
import type { CadenceKey } from "./pick";

export interface KeysAnswer {
  scope: "staff" | "customer";
  retention_days: number;
  max_span_days: number;
  max_keys: number;
  keys: CadenceKey[];
}

export interface PreviewAnswer {
  columns: { key: string; label: string; unit: string | null }[];
  /** [epoch milliseconds, value or null, ...] */
  rows: (number | null)[][];
  truncated: boolean;
  from: number;
  to: number;
}

export interface CadenceRequest {
  equipmentId: string;
  fromMs: number;
  toMs: number;
  keys: string[];
}

export class CadenceApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "CadenceApiError";
    this.status = status;
  }
}

export interface CadenceClientOptions {
  /** the backend's address, for example https://hub.waytaraenergy.com */
  baseUrl: string;
  /** the signed-in person's access token */
  getToken: () => Promise<string | null>;
  fetch?: typeof fetch;
}

const plainMessage = (status: number): string =>
  status === 401 ? "Please sign in again." : status === 404 ? "No readings are available for this device." : status === 429 ? "Too many requests. Wait a minute and try again." : status >= 500 ? "The readings are unavailable right now. Try again in a moment." : "The request was not accepted.";

export function createCadenceClient(o: CadenceClientOptions) {
  const base = o.baseUrl.replace(/\/+$/, "");
  const doFetch = o.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a));

  async function call(path: string, params: Record<string, string>, signal?: AbortSignal): Promise<Response> {
    const token = await o.getToken();
    if (!token) throw new CadenceApiError(401, plainMessage(401));
    let res: Response;
    try {
      res = await doFetch(`${base}${path}?${new URLSearchParams(params).toString()}`, { headers: { Authorization: `Bearer ${token}` }, signal, cache: "no-store" });
    } catch (error) {
      if ((error as Error).name === "AbortError") throw error;
      throw new CadenceApiError(0, "Could not reach the readings service. Check your connection and try again.");
    }
    if (res.ok) return res;
    let message = plainMessage(res.status);
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      // The service's own message is written for people on a bad request (for example "One download covers at most 7 days.").
      if (res.status === 400 && body.error?.message) message = body.error.message;
    } catch {
      /* keep the plain message */
    }
    throw new CadenceApiError(res.status, message);
  }

  const reportParams = (r: CadenceRequest): Record<string, string> => {
    if (r.keys.length === 0 || r.keys.length > CADENCE_MAX_KEYS) throw new CadenceApiError(400, `Pick between 1 and ${CADENCE_MAX_KEYS} values.`);
    return { equipment: r.equipmentId, from: String(Math.floor(r.fromMs)), to: String(Math.ceil(r.toMs)), keys: r.keys.join(",") };
  };

  return {
    /** The values this person may pick for this device. */
    async keys(equipmentId: string, signal?: AbortSignal): Promise<KeysAnswer> {
      return (await (await call("/v1/reports/cadence/keys", { equipment: equipmentId }, signal)).json()) as KeysAnswer;
    },

    /** The first rows of the period, to look at before downloading. */
    async preview(r: CadenceRequest, limit = 40, signal?: AbortSignal): Promise<PreviewAnswer> {
      return (await (await call("/v1/reports/cadence", { ...reportParams(r), format: "json", limit: String(limit) }, signal)).json()) as PreviewAnswer;
    },

    /** The whole file. */
    async download(r: CadenceRequest, signal?: AbortSignal): Promise<{ blob: Blob; filename: string }> {
      const res = await call("/v1/reports/cadence", { ...reportParams(r), format: "csv" }, signal);
      const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? "waytara-cadence.csv";
      return { blob: await res.blob(), filename: name };
    },
  };
}

export type CadenceClient = ReturnType<typeof createCadenceClient>;

/** Hands a file to the browser as a download. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
