import type { createClient as createBrowserClient } from "@waytara/supabase/client";
import { rowToBucket } from "./combine";
import type { Bucket, SeriesRow } from "./types";

type Sb = ReturnType<typeof createBrowserClient>;

const PAGE_SIZE = 1000;      // PostgREST's per-request row cap
const MAX_PAGES = 30;
const TIMEOUT_MS = 8000;
const RETRIES = 2;

export class TelemetryError extends Error {
  constructor(message: string, readonly retryable: boolean) {
    super(message);
    this.name = "TelemetryError";
  }
}

export interface SeriesRequest {
  deviceId: string;
  keys: string[];
  fromMs: number;
  toMs: number;
  /** 15, 30, 60, 120 or 1440 - what the database should return. */
  minutes: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function withTimeout(signal: AbortSignal | undefined, ms: number): AbortSignal {
  const timeout = AbortSignal.timeout(ms);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

/** One telemetry_series call, paged past PostgREST's row cap, with a timeout and a couple of retries for
 *  transient failures. Aborting (the caller moved on) rejects with the signal's reason and is never retried. */
export async function fetchSeries(sb: Sb, req: SeriesRequest, signal?: AbortSignal): Promise<Map<string, Bucket[]>> {
  let attempt = 0;
  for (;;) {
    try {
      return await fetchOnce(sb, req, withTimeout(signal, TIMEOUT_MS));
    } catch (e) {
      if (signal?.aborted) throw e;
      const retryable = !(e instanceof TelemetryError) || e.retryable;
      if (!retryable || attempt >= RETRIES) throw e;
      await sleep(400 * 3 ** attempt);
      attempt++;
    }
  }
}

async function fetchOnce(sb: Sb, req: SeriesRequest, signal: AbortSignal): Promise<Map<string, Bucket[]>> {
  const out = new Map<string, Bucket[]>(req.keys.map((k) => [k, []]));
  for (let page = 0; page < MAX_PAGES; page++) {
    const { data, error } = await sb
      .rpc("telemetry_series", {
        p_equipment_id: req.deviceId,
        p_keys: req.keys,
        p_from: new Date(req.fromMs).toISOString(),
        p_to: new Date(req.toMs).toISOString(),
        p_interval_minutes: req.minutes,
      })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
      .abortSignal(signal);
    if (error) {
      // 4xx-style problems (bad interval, too many points, no access) won't get better by retrying.
      const clientSide = /^(22|42|PGRST1)/.test(error.code ?? "") || /too many points|interval must be/i.test(error.message);
      throw new TelemetryError(error.message, !clientSide);
    }
    const rows = (data ?? []) as unknown as SeriesRow[];
    for (const r of rows) out.get(r.key_name)?.push(rowToBucket(r));
    if (rows.length < PAGE_SIZE) break;
  }
  return out;
}
