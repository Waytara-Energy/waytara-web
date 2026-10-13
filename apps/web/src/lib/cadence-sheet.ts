import "server-only";
import { parseCadenceAnswer, type CadenceSeriesMap } from "./cadence-parse";
import { splitByGroup, type CadenceGroup } from "./cadence-keys";

// Reads the cadence history (the readings at their own 5 s / 10 s / 30 s rhythm) from the weekly Google spreadsheets through the
// Apps Script web app. The browser never talks to Google or to the script: it asks /api/cadence, which first checks that the person
// can see the device. Two server-only environment variables:
//   CADENCE_SCRIPT_URL    the web app's /exec URL
//   CADENCE_READ_SECRET   the script's READ_SECRET (never sent to the browser)

const REQUEST_TIMEOUT_MS = 25_000;
const RECENT_TTL_MS = 15_000;          // a range that reaches "now" changes every few seconds
const PAST_TTL_MS = 10 * 60_000;       // a range that is over does not change
const MAX_CACHE_ENTRIES = 200;

type Entry = { at: number; ttl: number; value: Promise<CadenceSeriesMap> };
const cache = new Map<string, Entry>();

export function cadenceConfigured(): boolean {
  return Boolean(process.env.CADENCE_SCRIPT_URL && process.env.CADENCE_READ_SECRET);
}

async function readGroup(equipmentId: string, group: CadenceGroup, keys: string[], fromMs: number, toMs: number): Promise<CadenceSeriesMap> {
  const url = process.env.CADENCE_SCRIPT_URL;
  const secret = process.env.CADENCE_READ_SECRET;
  if (!url || !secret) throw new Error("The cadence history is not set up on this server.");
  // The script is a Google web app: it answers a POST with a redirect to the answer, which fetch follows with a GET.
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify({
      action: "read",
      secret,
      equipment_id: equipmentId,
      group,
      keys,
      from: Math.floor(fromMs / 1000),
      to: Math.ceil(toMs / 1000),
      from_ms: fromMs,
      to_ms: toMs,
    }),
    redirect: "follow",
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`The cadence service answered ${res.status}.`);
  const parsed = parseCadenceAnswer(await res.json().catch(() => null), keys);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.series;
}

function cached(key: string, ttl: number, load: () => Promise<CadenceSeriesMap>): Promise<CadenceSeriesMap> {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.at < hit.ttl) return hit.value;
  const value = load();
  cache.set(key, { at: now, ttl, value });
  value.catch(() => cache.delete(key));   // a failure is never remembered
  if (cache.size > MAX_CACHE_ENTRIES) {
    for (const [k, e] of cache) if (now - e.at >= e.ttl) cache.delete(k);
    if (cache.size > MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value as string);
  }
  return value;
}

export interface CadenceResult {
  series: CadenceSeriesMap;
  /** Metrics that have no cadence history (they are only kept in the 15-minute rollups). */
  unknown: string[];
}

/** Every reading of these metrics between two times (epoch ms), one series per metric. Groups are read in parallel. */
export async function readCadence(equipmentId: string, keys: string[], fromMs: number, toMs: number): Promise<CadenceResult> {
  const { groups, unknown } = splitByGroup(keys);
  const ttl = toMs > Date.now() - 60_000 ? RECENT_TTL_MS : PAST_TTL_MS;
  // A range that reaches now is cut to 15 s steps so that many viewers share one request.
  const f = toMs > Date.now() - 60_000 ? Math.floor(fromMs / 15_000) * 15_000 : fromMs;
  const t = toMs > Date.now() - 60_000 ? Math.ceil(toMs / 15_000) * 15_000 : toMs;
  const parts = await Promise.all(
    (Object.entries(groups) as [CadenceGroup, string[]][]).map(([group, ks]) => {
      const sorted = [...ks].sort();
      return cached(`${equipmentId}|${group}|${sorted.join(",")}|${f}|${t}`, ttl, () => readGroup(equipmentId, group, sorted, f, t));
    })
  );
  const series: CadenceSeriesMap = {};
  for (const part of parts) Object.assign(series, part);
  return { series, unknown };
}
