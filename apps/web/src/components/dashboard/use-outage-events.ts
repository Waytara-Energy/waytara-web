"use client";

import * as React from "react";
import { createClient } from "@waytara/supabase/client";
import type { OutageEvent } from "@/lib/data-gaps";

const WINDOW_MS = 10 * 86_400_000;
const TTL_MS = 60_000;

const cache = new Map<string, { at: number; promise: Promise<OutageEvent[]> }>();

/** The recorded outages of a device over the last days (one request is shared by every chart on the page for a minute). */
function load(deviceId: string): Promise<OutageEvent[]> {
  const hit = cache.get(deviceId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.promise;
  const promise = (async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("device_activity_log")
      .select("cause, since, at")
      .eq("equipment_id", deviceId)
      .eq("action", "device_offline")
      .gte("at", new Date(Date.now() - WINDOW_MS).toISOString())
      .order("at", { ascending: false })
      .limit(60);
    return (data ?? [])
      .map((r) => ({ sinceMs: Date.parse(r.since ?? r.at ?? ""), cause: r.cause }))
      .filter((o) => Number.isFinite(o.sinceMs));
  })().catch(() => {
    cache.delete(deviceId);
    return [] as OutageEvent[];
  });
  cache.set(deviceId, { at: Date.now(), promise });
  return promise;
}

/** The device's recorded outages, fetched only while `enabled` (a chart with a gap in it). Empty until they arrive, so a gap is first shown with an unknown reason and then named. */
export function useOutageEvents(deviceId: string | undefined, enabled: boolean): OutageEvent[] {
  const [events, setEvents] = React.useState<OutageEvent[]>([]);
  React.useEffect(() => {
    if (!deviceId || !enabled) return;
    let alive = true;
    void load(deviceId).then((e) => alive && setEvents(e));
    return () => {
      alive = false;
    };
  }, [deviceId, enabled]);
  return events;
}
