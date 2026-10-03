import { createServiceRoleClient } from "@waytara/supabase/service-role";

/** Per-process fallback used only if the database limiter is unreachable —
 *  best-effort, resets on cold start, not shared across instances. */
const fallbackLog = new Map<string, number[]>();

function fallbackAllow(bucket: string, key: string, max: number, windowSeconds: number): boolean {
  const k = `${bucket}:${key}`;
  const now = Date.now();
  const recent = (fallbackLog.get(k) ?? []).filter((t) => now - t < windowSeconds * 1000);
  recent.push(now);
  fallbackLog.set(k, recent);
  return recent.length <= max;
}

/** Returns true when the request is ALLOWED. Backed by
 *  `waytara.consume_rate_limit` (Postgres, atomic, shared by every
 *  serverless instance); the key is hashed server-side so raw IPs are not
 *  stored. Falls back to an in-memory window if the RPC errors, so a
 *  database blip degrades protection instead of taking the form down. */
export async function allowRequest(bucket: string, key: string, max: number, windowSeconds: number): Promise<boolean> {
  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase.rpc("consume_rate_limit", {
      p_bucket: bucket,
      p_key: key,
      p_max: max,
      p_window_seconds: windowSeconds,
    });
    if (error) throw error;
    return data === true;
  } catch (err) {
    console.error(`[rate-limit:${bucket}] database limiter unavailable, using in-memory fallback:`, err);
    return fallbackAllow(bucket, key, max, windowSeconds);
  }
}

/** Best-effort client IP. On Vercel `x-forwarded-for` / `x-real-ip` are set by
 *  the platform edge (a client-supplied value is overwritten). */
export function clientIp(headers: Headers): string {
  return headers.get("x-real-ip") ?? headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}
