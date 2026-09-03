"use client";

import * as React from "react";
import { createClient } from "@waytara/supabase/client";
import { useRealtimeTable, type RealtimeRowEvent } from "./realtime-provider";

export interface MonitoringDevice {
  id: string;
  label: string | null;
  deviceUid: string;
  typeName: string | null;
}

interface ReadingRow {
  device_id: string;
  instrument_key: string;
  value: number | null;
  unit: string | null;
  ts: string;
  is_test?: boolean;
}

interface MonitoringPanelProps {
  devices: MonitoringDevice[];
  /**
   * When true, only shows is_test=true readings (Task 8.5's connection-test
   * use case). Left false for the customer dashboard's real Monitoring
   * module, which should never see test data.
   */
  isTestOnly?: boolean;
  emptyMessage?: string;
}

// A Postgrest realtime filter can't express "no rows match" directly —
// this nil UUID is a syntactically valid device_id that can never be a
// real one, used when `devices` is empty so the subscription hook (which
// must still be called, same as every render, per the Rules of Hooks)
// simply never matches anything rather than subscribing unfiltered.
const NEVER_MATCH_DEVICE_ID = "00000000-0000-0000-0000-000000000000";

/**
 * Live per-device, per-instrument readings — genuinely shared between
 * apps/web's customer Monitoring module (Task 10.1) and apps/admin's
 * connection-test panel (Task 8.5), not two separate builds of the same
 * idea. Deliberately theme-neutral (plain Tailwind palette, no bg-primary/
 * text-theme-* tokens) so it drops into either app's Tailwind build with
 * just an `@source` line pointing at this package — no shared theme file
 * import needed, no risk of clashing with either app's own token system.
 *
 * Dashboard redesign Phase 3 wanted each device wrapped in a real shadcn
 * Card with a Tooltip and Badge — can't do that literally here: apps/admin
 * has no shadcn setup of its own at all (no components.json, no local
 * src/components/ui — it imports everything from this package instead),
 * so importing apps/web's shadcn components would break admin's build
 * entirely. Card/badge/tooltip look-and-feel is instead hand-rolled in
 * the same plain-Tailwind style this file already committed to, which
 * gets the same visual outcome without the cross-app import.
 *
 * Realtime rollout: the initial snapshot is still one fetch on mount
 * (Realtime only tells us about *new* rows, not history), but new
 * readings now arrive via a device_readings INSERT subscription instead
 * of a poll — RLS (readings_owner / readings_admin_all /
 * readings_employee_active_test_only) already scopes both the initial
 * query and what the subscription is even allowed to deliver for
 * whichever role is viewing, so this component still doesn't need to know
 * or care which app/role is using it.
 */
export function MonitoringPanel({
  devices,
  isTestOnly = false,
  emptyMessage = "No readings yet.",
}: MonitoringPanelProps) {
  const [readings, setReadings] = React.useState<ReadingRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const deviceIds = React.useMemo(() => devices.map((d) => d.id), [devices]);
  const deviceIdsKey = deviceIds.join(",");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const deviceIdSet = React.useMemo(() => new Set(deviceIds), [deviceIdsKey]);

  React.useEffect(() => {
    if (deviceIds.length === 0) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const supabase = createClient();

    async function fetchReadings() {
      // Always filter one way or the other — the customer's real Monitoring
      // module (isTestOnly=false) must never show a technician's connection-
      // test readings mixed in with real telemetry, not just "no filter".
      const query = supabase
        .from("device_readings")
        .select("device_id, instrument_key, value, unit, ts")
        .in("device_id", deviceIds)
        .eq("is_test", isTestOnly)
        .order("ts", { ascending: false })
        .limit(200);

      const { data } = await query;
      if (!cancelled) {
        setReadings(data ?? []);
        setLoading(false);
      }
    }

    fetchReadings();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceIdsKey, isTestOnly]);

  // postgres_changes filters support one column — device_id here, via the
  // `in.(...)` operator for the (usually one, occasionally several)
  // devices this panel shows. is_test is checked client-side per event,
  // same reasoning as the device_id-only filter on live-metric-chart.tsx.
  const deviceFilter =
    deviceIds.length > 0 ? `device_id=in.(${deviceIds.join(",")})` : `device_id=eq.${NEVER_MATCH_DEVICE_ID}`;

  useRealtimeTable<ReadingRow>(
    "device_readings",
    "INSERT",
    deviceFilter,
    React.useCallback(
      (payload: RealtimeRowEvent<ReadingRow>) => {
        const row = payload.new;
        if (row.is_test !== isTestOnly) return;
        if (!deviceIdSet.has(row.device_id)) return;
        // Prepend, not append — readings stays newest-first (the initial
        // fetch is ordered `ts desc`), which is what latestByDevice's
        // "first match per (device_id, instrument_key) wins" relies on.
        setReadings((prev) => [row, ...prev].slice(0, 200));
        setLoading(false);
      },
      [isTestOnly, deviceIdSet]
    )
  );

  // Latest value per (device_id, instrument_key) — readings are already
  // ordered newest-first, so the first match for each pair wins.
  const latestByDevice = React.useMemo(() => {
    const map = new Map<string, Map<string, ReadingRow>>();
    for (const r of readings) {
      if (!map.has(r.device_id)) map.set(r.device_id, new Map());
      const perDevice = map.get(r.device_id)!;
      if (!perDevice.has(r.instrument_key)) perDevice.set(r.instrument_key, r);
    }
    return map;
  }, [readings]);

  if (devices.length === 0) {
    return <p className="text-sm text-neutral-500 dark:text-neutral-400">No devices to monitor.</p>;
  }

  return (
    <div className="space-y-4">
      {devices.map((device) => {
        const deviceReadings = latestByDevice.get(device.id);
        const rows = deviceReadings ? Array.from(deviceReadings.values()) : [];

        return (
          <div
            key={device.id}
            className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-neutral-800 dark:bg-neutral-950"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                {device.typeName ?? "Device"}
                <span className="ml-1.5 font-normal text-neutral-500 dark:text-neutral-400">
                  — {device.label || device.deviceUid}
                </span>
              </p>
              {!loading && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Live
                </span>
              )}
            </div>

            {loading ? (
              <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">Loading…</p>
            ) : rows.length === 0 ? (
              <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">{emptyMessage}</p>
            ) : (
              <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {rows.map((r) => (
                  <div key={r.instrument_key} title={`Updated ${new Date(r.ts).toLocaleTimeString("en-IN")}`}>
                    <dt className="cursor-default text-xs text-neutral-500 underline decoration-dotted decoration-neutral-400 underline-offset-4 dark:text-neutral-400 dark:decoration-neutral-600">
                      {r.instrument_key.replace(/_/g, " ")}
                    </dt>
                    <dd className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                      {r.value ?? "—"} {r.unit ?? ""}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        );
      })}
    </div>
  );
}
