import "server-only";
import { createClient } from "@waytara/supabase/server";
import { createCadenceClient } from "@waytara/cadence/client";
import type { CadenceSeriesMap } from "./cadence-parse";
import { addRows, keyChunks, splitKnown, timeChunks } from "./cadence-hub-parse";

// Reads the cadence history (every reading at its own 5 s / 10 s / 30 s rhythm, kept 28 days) from the WayTara readings service, signed
// in as the person who asked. The service decides what that person may read, so a value or a device they may not see is simply not
// there. This replaces the old weekly Google spreadsheets and their Apps Script: nothing here needs a secret.
//
// The service's address is the same one the Cadence tab uses (GATEWAY_URL or NEXT_PUBLIC_GATEWAY_URL, default https://hub.waytaraenergy.com).

const GATEWAY_URL = process.env.GATEWAY_URL ?? process.env.NEXT_PUBLIC_GATEWAY_URL ?? "https://hub.waytaraenergy.com";
/** at 5 s a reading, 12 hours are about 8,600 moments: well inside the service's 20,000-row answer */
const CHUNK_MS = 12 * 3_600_000;
const KEYS_PER_CALL = 40;
const ROW_LIMIT = 20_000;
/** a safety stop: one page view never makes more calls than this (the service allows 30 a minute) */
const MAX_CALLS = 20;
const RECENT_TTL_MS = 15_000;
const PAST_TTL_MS = 10 * 60_000;
const MAX_CACHE_ENTRIES = 100;

type Entry = { at: number; ttl: number; value: Promise<CadenceSeriesMap> };
const cache = new Map<string, Entry>();

/** The readings service needs no per-server secret, so this is always on. */
export function cadenceConfigured(): boolean {
  return true;
}

export interface CadenceResult {
  series: CadenceSeriesMap;
  /** Values the service does not offer this person for this device (for example the ones only kept in the 15-minute rollups). */
  unknown: string[];
}

function cached(key: string, ttl: number, load: () => Promise<CadenceSeriesMap>): Promise<CadenceSeriesMap> {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.at < hit.ttl) return hit.value;
  const value = load();
  cache.set(key, { at: now, ttl, value });
  value.catch(() => cache.delete(key)); // a failure is never remembered
  if (cache.size > MAX_CACHE_ENTRIES) {
    for (const [k, e] of cache) if (now - e.at >= e.ttl) cache.delete(k);
    if (cache.size > MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value as string);
  }
  return value;
}

/** Every reading of these values between two times (epoch ms), one series per value. Throws a message fit to show a person. */
export async function readCadence(equipmentId: string, keys: string[], fromMs: number, toMs: number): Promise<CadenceResult> {
  const supabase = await createClient();
  const token = (await supabase.auth.getSession()).data.session?.access_token ?? null;
  const client = createCadenceClient({ baseUrl: GATEWAY_URL, getToken: async () => token });

  // Which values this person may read for this device. This is also the access check: no access is a plain "not available".
  const offered = await client.keys(equipmentId);
  const { use, unknown } = splitKnown(keys, offered.keys.map((k) => k.key));
  const series: CadenceSeriesMap = {};
  for (const k of use) series[k] = [];

  const now = Date.now();
  const oldest = now - offered.retention_days * 86_400_000 + 60_000;
  const from = Math.max(fromMs, oldest);
  const to = Math.min(toMs, now);
  if (use.length === 0 || to <= from) return { series, unknown };

  const recent = to > now - 60_000;
  const pieces = timeChunks(from, to, CHUNK_MS);
  const groups = keyChunks(use, Math.min(KEYS_PER_CALL, offered.max_keys));
  if (pieces.length * groups.length > MAX_CALLS) throw new Error("That period is too long to show at once. Pick a shorter one.");

  for (const group of groups) {
    for (const [a, b] of pieces) {
      // a range that reaches "now" is cut to 15 s steps so that many viewers share one request
      const f = recent && b === to ? Math.floor(a / 15_000) * 15_000 : a;
      const t = recent && b === to ? Math.ceil(b / 15_000) * 15_000 : b;
      const sorted = [...group].sort();
      const part = await cached(`${equipmentId}|${sorted.join(",")}|${f}|${t}`, recent && b === to ? RECENT_TTL_MS : PAST_TTL_MS, async () => {
        const answer = await client.preview({ equipmentId, fromMs: f, toMs: t, keys: sorted }, ROW_LIMIT);
        const out: CadenceSeriesMap = {};
        for (const k of sorted) out[k] = [];
        addRows(out, answer);
        return out;
      });
      for (const k of group) series[k]!.push(...(part[k] ?? []));
    }
  }
  for (const k of use) series[k]!.sort((p, q) => p[0] - q[0]);
  return { series, unknown };
}
