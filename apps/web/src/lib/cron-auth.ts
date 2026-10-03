import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

/** Bearer-secret check shared by every `/api/cron/*` route.
 *
 *  Fails CLOSED: with no `CRON_SECRET` configured in production the route
 *  refuses every request (these routes use the service-role key, so an
 *  unauthenticated one would let anyone who finds the URL run privileged
 *  jobs). Outside production an unset secret is tolerated with a warning so
 *  local runs don't need setup. The comparison is constant-time. */
export function isCronAuthorized(req: NextRequest, routeName: string): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.error(`[cron/${routeName}] CRON_SECRET is not set — refusing the request.`);
      return false;
    }
    console.warn(`[cron/${routeName}] CRON_SECRET not set — allowed because NODE_ENV !== "production".`);
    return true;
  }

  const provided = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
