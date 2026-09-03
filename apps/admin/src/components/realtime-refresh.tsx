"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useRealtimeTable, type PgChangeEvent } from "@waytara/ui/realtime-provider";

/**
 * Mount under `<RealtimeProvider>` to make a Server Component page
 * live-refresh (`router.refresh()`, not a hard reload) whenever a row
 * matching `table`+`event`+`filter` changes — for pages showing
 * joined/derived data that isn't safe to hand-patch from a raw
 * `postgres_changes` payload. Same component as apps/web's own
 * realtime-refresh.tsx (not cross-app importable, so duplicated here —
 * see support-thread.tsx's doc comment for why this app's small
 * client-side pieces are hand-rolled rather than shared).
 *
 * Renders nothing. Debounces its own `router.refresh()` calls so a burst
 * of related writes triggers one refresh, not several.
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
