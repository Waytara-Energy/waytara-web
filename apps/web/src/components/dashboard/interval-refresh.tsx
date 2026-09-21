"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

/** Mount under a Server Component page to `router.refresh()` on a fixed
 *  interval — for data that changes on its own schedule rather than in
 *  response to a realtime table event (see RealtimeRefresh for that case).
 *  Weather is the first user: it's fetched from an external API, not
 *  `device_readings`, so there's no table to subscribe to — this is what
 *  keeps it current for a customer who leaves the tab open. Renders
 *  nothing. */
export function IntervalRefresh({ intervalMs }: { intervalMs: number }) {
  const router = useRouter();

  React.useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
