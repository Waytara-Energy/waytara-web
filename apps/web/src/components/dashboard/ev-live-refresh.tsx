"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useLiveNumbers } from "@/lib/telemetry/live-values";

/**
 * Shows nothing. It follows the charger's live channel, and when the connector's state changes (a charge starts or ends) it fetches the page's
 * session data again (once now and once a few seconds later, when the charger's final report has been written), so the live tiles, today's curve
 * and today's list never sit on what was true before the change.
 */
export function EvLiveRefresh({ deviceId, initialCode }: { deviceId: string; initialCode: number | null }) {
  const router = useRouter();
  const n = useLiveNumbers([deviceId], ["connector_status"], { connector_status: initialCode });

  const last = React.useRef(n.connector_status);
  React.useEffect(() => {
    if (last.current === n.connector_status) return;
    last.current = n.connector_status;
    router.refresh();
    const t = setTimeout(() => router.refresh(), 4_000);
    return () => clearTimeout(t);
  }, [n.connector_status, router]);

  return null;
}
