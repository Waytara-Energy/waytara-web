"use client";

import * as React from "react";
import { useDeviceLive } from "@/lib/telemetry/react";
import { useLiveNumbers, type Agg } from "@/lib/telemetry/live-values";
import { FAULT_BITMASK_KEYS_LIVE, SITE_OVERVIEW_KEYS, siteAgg } from "@/lib/overview-keys";
import type { EnumOption } from "@/lib/enum-labels";
import type { TemplateField } from "@/lib/template-field-format";
import { DeviceStatusPill } from "./device-status-pill";
import { EnergyFlowDiagram } from "./energy-flow-diagram";
import { FaultBanner } from "./fault-banner";
import { TodaySoFar } from "./today-so-far";

/** Overview's numbers for a set of inverters (one device, or every inverter at a site), live. `initial` is what the
 *  server rendered; each live message then updates the figures in place - no page refresh, no refetch. */
function useSiteNumbers(inverterIds: string[], initial: Record<string, number | null>) {
  const keys = React.useMemo(() => [...SITE_OVERVIEW_KEYS], []);
  return useLiveNumbers(inverterIds, keys, initial, (k) => siteAgg(k) as Agg);
}

function faultCodeOf(n: Record<string, number | null>): number | null {
  for (const k of FAULT_BITMASK_KEYS_LIVE) if (n[k]) return n[k];
  return null;
}

/** Keeps every device's live channel open for as long as the Overview is mounted. */
export function LiveChannelKeeper({ deviceIds }: { deviceIds: string[] }) {
  return (
    <>
      {deviceIds.map((id) => (
        <Keeper key={id} deviceId={id} />
      ))}
    </>
  );
}
function Keeper({ deviceId }: { deviceId: string }) {
  useDeviceLive(deviceId);
  return null;
}

export function LiveStatusPill({
  inverterIds,
  initial,
  inverterStateOptions,
}: {
  inverterIds: string[];
  initial: Record<string, number | null>;
  inverterStateOptions: EnumOption[];
}) {
  const n = useSiteNumbers(inverterIds, initial);
  return <DeviceStatusPill inverterState={n.inverter_run_state ?? null} activeFaultCode={faultCodeOf(n)} inverterStateOptions={inverterStateOptions} />;
}

export function LiveFaultBanner({ inverterIds, initial }: { inverterIds: string[]; initial: Record<string, number | null> }) {
  const n = useSiteNumbers(inverterIds, initial);
  return <FaultBanner faultCode={faultCodeOf(n)} />;
}

/** The energy-flow picture. The inverter reports battery power as POSITIVE = DISCHARGING; the diagram's
 *  convention is positive = charging, so the sign is flipped here (once, in one place). */
export function LiveEnergyFlow({
  inverterIds,
  chargerIds = [],
  initial,
  initialEvW,
  powerPackage,
  powerSourceCategory,
}: {
  inverterIds: string[];
  chargerIds?: string[];
  initial: Record<string, number | null>;
  initialEvW: number | null;
  powerPackage: string | null;
  powerSourceCategory: string | null;
}) {
  const n = useSiteNumbers(inverterIds, initial);
  const ev = useLiveNumbers(chargerIds, ["power_active_import_kw"], { power_active_import_kw: initialEvW === null ? null : initialEvW / 1000 }, () => "sum");
  const evKw = ev.power_active_import_kw;
  const batteryRaw = n.battery_power_w ?? null;
  return (
    <EnergyFlowDiagram
      solarW={n.inverter_output_power_w ?? null}
      batteryW={batteryRaw === null ? null : -batteryRaw}
      gridW={n.grid_total_power_w ?? null}
      loadW={n.load_total_power_w ?? null}
      batterySocPct={n.battery_soc_pct ?? null}
      evW={evKw === null || evKw === undefined ? null : Math.round(evKw * 1000)}
      powerPackage={powerPackage}
      powerSourceCategory={powerSourceCategory}
    />
  );
}

export function LiveTodaySoFar({
  inverterIds,
  initial,
  fields,
  enabledKeys,
}: {
  inverterIds: string[];
  initial: Record<string, number | null>;
  fields: TemplateField[];
  enabledKeys: string[];
}) {
  const n = useSiteNumbers(inverterIds, initial);
  const enabled = React.useMemo(() => new Set(enabledKeys), [enabledKeys]);
  return <TodaySoFar fields={fields} get={(k) => n[k] ?? null} enabledKeys={enabled} />;
}
