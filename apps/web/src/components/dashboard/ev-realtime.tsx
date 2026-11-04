"use client";

import { RealtimeRefresh } from "./realtime-refresh";

/**
 * Keeps a page that shows an EV charger's sessions current without a reload: a new charge, or a change to one (it ends, its energy is added up),
 * re-reads the page's data; while a charge runs, its 30-second readings do too (at most once every 30 s), so today's curve grows. Renders nothing.
 * A burst of changes is one refresh, and a continuous stream of them is at most one every 10 s.
 */
export function EvRealtime({ chargerId, charging = false }: { chargerId: string; /** a charge is running: its readings are followed too */ charging?: boolean }) {
  const filter = `equipment_id=eq.${chargerId}`;
  return (
    <>
      <RealtimeRefresh table="ev_sessions" event="INSERT" filter={filter} debounceMs={800} />
      <RealtimeRefresh table="ev_sessions" event="UPDATE" filter={filter} throttleMs={10_000} />
      {charging ? <RealtimeRefresh table="ev_session_samples" event="INSERT" filter={filter} throttleMs={30_000} /> : null}
    </>
  );
}
