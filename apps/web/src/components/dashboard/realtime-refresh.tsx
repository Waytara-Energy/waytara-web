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
}: {
  table: string;
  event: PgChangeEvent;
  filter?: string;
}) {
  const router = useRouter();
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  useRealtimeTable(
    table,
    event,
    filter,
    React.useCallback(() => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => router.refresh(), 400);
    }, [router])
  );

  return null;
}
