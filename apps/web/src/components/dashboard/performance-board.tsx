"use client";

import * as React from "react";
import { BatteryCharging, Cpu, Home, Sun, Zap } from "lucide-react";
import { useLiveNumbers } from "@/lib/telemetry/live-values";
import { DAY_KEYS, LIFETIME_KEYS, PERFORMANCE_LIVE_KEYS, pvInputKeys, selfSufficiencyPct } from "@/lib/performance-metrics";
import { cn } from "@/lib/utils";
import type { BatteryProfile } from "@/lib/battery-health";
import { LiveStatusCard } from "./live-status-card";
import { HISTORY_OPTIONS, type HistoryPreset } from "./perf-data";
import { fmtKwhText, fmtPct } from "./perf-kit";
import { SolarSection } from "./perf-solar";
import { BatterySection, GridSection, InverterSection, LoadSection } from "./perf-sections";

export type PerformanceSectionId = "inverter" | "solar" | "battery" | "load" | "grid";
const SECTION_IDS: PerformanceSectionId[] = ["inverter", "solar", "battery", "load", "grid"];

// The open section lives in the address (#solar ...), so a link or a refresh lands on the same one.
const subscribeHash = (cb: () => void) => {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
};
const readHash = () => window.location.hash.replace("#", "");

const kwhNumber = (v: number | null | undefined) => (v === null || v === undefined ? "—" : v.toFixed(v >= 100 ? 0 : 1));

/** Performance for a solar inverter: five cards with the lifetime totals (inverter, solar, battery, load, grid); the one
 *  you open shows its detailed figures, charts and findings underneath. */
export function PerformanceBoard({
  deviceId,
  initial,
  pvKeys,
  tariff,
  batteryProfile,
  solarKwp,
  extras,
}: {
  deviceId: string;
  initial: Record<string, number | null>;
  pvKeys: string[];
  tariff: number;
  /** The battery's datasheet numbers, when the installer has entered them (cycle count and health need them). */
  batteryProfile: BatteryProfile | null;
  /** Installed solar size from the panels allocated to this inverter, when known. */
  solarKwp: number | null;
  /** Server-rendered extra groups for each section (template fields that have values). */
  extras: Partial<Record<PerformanceSectionId, React.ReactNode>>;
}) {
  const keys = React.useMemo(() => [...PERFORMANCE_LIVE_KEYS, ...pvInputKeys(pvKeys)], [pvKeys]);
  const live = useLiveNumbers([deviceId], keys, initial);
  const hash = React.useSyncExternalStore(subscribeHash, readHash, () => "");
  const section: PerformanceSectionId = (SECTION_IDS as string[]).includes(hash) ? (hash as PerformanceSectionId) : "solar";
  const [preset, setPreset] = React.useState<HistoryPreset>("7d");
  const open = (id: PerformanceSectionId) => {
    window.location.hash = id;
  };

  const n = (key: string) => live[key] ?? null;
  const net = n(LIFETIME_KEYS.exported) !== null && n(LIFETIME_KEYS.imported) !== null ? (n(LIFETIME_KEYS.exported) as number) - (n(LIFETIME_KEYS.imported) as number) : null;
  const props = { deviceId, preset, live, tariff, pvKeys };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5">
        <LiveStatusCard
          icon={Cpu}
          title="Inverter"
          subtitle="Total AC output"
          value={`${kwhNumber(n(LIFETIME_KEYS.acOut))} kWh`}
          statusLabel="Today"
          badgeLabel={fmtKwhText(n(DAY_KEYS.acOut))}
          badgeTone="neutral"
          selected={section === "inverter"}
          onClick={() => open("inverter")}
        />
        <LiveStatusCard
          icon={Sun}
          iconTone="warn"
          title="Solar"
          subtitle="Total produced"
          value={`${kwhNumber(n(LIFETIME_KEYS.pv))} kWh`}
          statusLabel="Today"
          badgeLabel={fmtKwhText(n(DAY_KEYS.pv))}
          badgeTone="neutral"
          selected={section === "solar"}
          onClick={() => open("solar")}
        />
        <LiveStatusCard
          icon={BatteryCharging}
          iconTone="good"
          title="Battery"
          subtitle="In / out, total"
          value={`${kwhNumber(n(LIFETIME_KEYS.charged))} / ${kwhNumber(n(LIFETIME_KEYS.discharged))} kWh`}
          statusLabel="Today"
          badgeLabel={`${kwhNumber(n(DAY_KEYS.charged))} / ${kwhNumber(n(DAY_KEYS.discharged))} kWh`}
          badgeTone="neutral"
          selected={section === "battery"}
          onClick={() => open("battery")}
        />
        <LiveStatusCard
          icon={Home}
          title="Load"
          subtitle="Total consumed"
          value={`${kwhNumber(n(LIFETIME_KEYS.load))} kWh`}
          statusLabel="Self-sufficiency"
          badgeLabel={fmtPct(selfSufficiencyPct(n(LIFETIME_KEYS.load), n(LIFETIME_KEYS.imported)))}
          badgeTone="neutral"
          selected={section === "load"}
          onClick={() => open("load")}
        />
        <div className="col-span-2 lg:col-span-1">
          <LiveStatusCard
            icon={Zap}
            title="Grid"
            subtitle="Import / export"
            value={`${kwhNumber(n(LIFETIME_KEYS.imported))} / ${kwhNumber(n(LIFETIME_KEYS.exported))} kWh`}
            statusLabel="Net exported"
            badgeLabel={fmtKwhText(net)}
            badgeTone={net !== null && net > 0 ? "good" : "neutral"}
            selected={section === "grid"}
            onClick={() => open("grid")}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-foreground capitalize">{section} in detail</h2>
        <div className="flex gap-1 rounded-lg border border-border p-1" role="group" aria-label="History period">
          {HISTORY_OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setPreset(o.id)}
              aria-pressed={preset === o.id}
              className={cn("rounded-md px-3 py-1 text-xs font-medium transition-colors", preset === o.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div key={section}>
        {section === "solar" && <SolarSection {...props} kwp={solarKwp} extras={extras.solar} />}
        {section === "inverter" && <InverterSection {...props} extras={extras.inverter} />}
        {section === "battery" && <BatterySection {...props} profile={batteryProfile} extras={extras.battery} />}
        {section === "load" && <LoadSection {...props} extras={extras.load} />}
        {section === "grid" && <GridSection {...props} extras={extras.grid} />}
      </div>
    </div>
  );
}
