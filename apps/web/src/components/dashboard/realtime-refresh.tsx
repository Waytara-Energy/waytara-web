"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useRealtimeTable, type PgChangeEvent } from "@waytara/ui/realtime-provider";

/**
 * Mount under `<RealtimeProvider>` to make a Server Component page
 * live-refresh (`router.refresh()`, not a hard reload) whenever a row
 * matching `table`+`event`+`filter` changes — for pages showing
 * joined/derived data that isn't safe to hand-patch from a raw
 * `postgres_changes` payload (see realtime-provider.tsx's own "patch vs.
 * refresh" reasoning: a quotation's plan name, a payment row rendered
 * alongside a customer/subscription join, an onboarding stage next to its
 * quotation — none of that is in the raw row the channel delivers).
 *
 * Renders nothing. Debounces its own `router.refresh()` calls (separately
 * from the channel's own event-coalescing debounce inside
 * RealtimeProvider) so a burst of related writes triggers one refresh, not
 * several — e.g. an admin action that updates both `customer_onboarding`
 * and `quotations` in the same request shouldn't refresh this page twice.
 */
export function RealtimeRefresh({
  table,
  event,
  filter,
  debounceMs = 400,
  throttleMs,
}: {
  table: string;
  event: PgChangeEvent;
  filter?: string;
  /** Override the 400ms default for a table that changes very often (e.g.
   *  Monitoring's `device_readings`, which can insert 20-30 rows per
   *  device "tick") — `router.refresh()` re-runs the whole page's Server
   *  Component, including every query that isn't actually reading-driven
   *  (session history, plan, site), so a table this hot needs a longer
   *  window or the full-page refresh fires almost continuously and starves
   *  everything else (chart fetches, tab switches) of bandwidth/CPU. */
  debounceMs?: number;
  /** For a table that changes *continuously* (equipment_telemetry): refresh
   *  at most once per `throttleMs`, however many events arrive. A debounce
   *  is the wrong tool there — it resets on every event, so a steady stream
   *  either never refreshes or refreshes every quiet gap (i.e. every tick).
   *  The first event after a quiet period refreshes immediately; events
   *  inside the window collapse into one trailing refresh. Takes precedence
   *  over `debounceMs`. */
  throttleMs?: number;
}) {
  const router = useRouter();
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRefreshRef = React.useRef(0);

  useRealtimeTable(
    table,
    event,
    filter,
    React.useCallback(() => {
      if (throttleMs) {
        if (timerRef.current) return; // a trailing refresh is already scheduled
        const wait = Math.max(0, lastRefreshRef.current + throttleMs - Date.now());
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          lastRefreshRef.current = Date.now();
          router.refresh();
        }, wait);
        return;
      }
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => router.refresh(), debounceMs);
    }, [router, debounceMs, throttleMs])
  );

  React.useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  return null;
}
