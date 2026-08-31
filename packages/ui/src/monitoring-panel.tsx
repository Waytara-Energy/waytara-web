"use client";

import * as React from "react";
import { createClient } from "@waytara/supabase/client";

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
}

interface MonitoringPanelProps {
  devices: MonitoringDevice[];
  /**
   * When true, only shows is_test=true readings (Task 8.5's connection-test
   * use case). Left false for the customer dashboard's real Monitoring
   * module, which should never see test data.
   */
  isTestOnly?: boolean;
  pollIntervalMs?: number;
  emptyMessage?: string;
}

/**
 * Live per-device, per-instrument readings — genuinely shared between
 * apps/web's customer Monitoring module (Task 10.1) and apps/admin's
 * connection-test panel (Task 8.5), not two separate builds of the same
 * idea. Deliberately theme-neutral (plain Tailwind palette, no bg-primary/
 * text-theme-* tokens) so it drops into either app's Tailwind build with
 * just an `@source` line pointing at this package — no shared theme file
 * import needed, no risk of clashing with either app's own token system.
 *
 * "Live" here means client-side polling of device_readings, not a Realtime
 * subscription — simpler and predictable, and RLS (readings_owner /
 * readings_admin_all / readings_employee_active_test_only) already scopes
 * the query correctly for whichever role is viewing, so this component
 * doesn't need to know or care which app/role is using it.
 */
export function MonitoringPanel({
  devices,
  isTestOnly = false,
  pollIntervalMs = 5000,
  emptyMessage = "No readings yet.",
}: MonitoringPanelProps) {
  const [readings, setReadings] = React.useState<ReadingRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const deviceIds = React.useMemo(() => devices.map((d) => d.id), [devices]);
  const deviceIdsKey = deviceIds.join(",");

  React.useEffect(() => {
    if (deviceIds.length === 0) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const supabase = createClient();

    async function fetchReadings() {
      let query = supabase
        .from("device_readings")
        .select("device_id, instrument_key, value, unit, ts")
        .in("device_id", deviceIds)
        .order("ts", { ascending: false })
        .limit(200);

      if (isTestOnly) {
        query = query.eq("is_test", true);
      }

      const { data } = await query;
      if (!cancelled) {
        setReadings(data ?? []);
        setLoading(false);
      }
    }

    fetchReadings();
    const interval = setInterval(fetchReadings, pollIntervalMs);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceIdsKey, isTestOnly, pollIntervalMs]);

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
            className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                {device.typeName ?? "Device"}
                <span className="ml-1.5 font-normal text-neutral-500 dark:text-neutral-400">
                  — {device.label || device.deviceUid}
                </span>
              </p>
              {!loading && (
                <span className="h-2 w-2 rounded-full bg-emerald-500" title="Polling live" />
              )}
            </div>

            {loading ? (
              <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">Loading…</p>
            ) : rows.length === 0 ? (
              <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">{emptyMessage}</p>
            ) : (
              <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {rows.map((r) => (
                  <div key={r.instrument_key}>
                    <dt className="text-xs text-neutral-500 dark:text-neutral-400">
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
