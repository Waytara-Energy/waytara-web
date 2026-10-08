"use client";

import * as React from "react";
import { BatteryCharging, Cpu, Home, Sun, Zap, type LucideIcon } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLiveNumbers } from "@/lib/telemetry/live-values";
import { PERFORMANCE_LIVE_KEYS, pvInputKeys } from "@/lib/performance-metrics";
import type { BatteryProfile } from "@/lib/battery-health";
import { periodText } from "./perf-data";
import { RangeBar, LONG_PRESETS } from "./range-bar";
import { RangeProvider, useRange } from "./range-context";
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

// The five sections, as line tabs (same look as the Monitoring tabs, each with its own accent colour).
const SECTION_TABS: { id: PerformanceSectionId; label: string; icon: LucideIcon; active: string }[] = [
  { id: "inverter", label: "Inverter", icon: Cpu, active: "data-[state=active]:border-primary data-[state=active]:text-primary" },
  { id: "solar", label: "Solar", icon: Sun, active: "data-[state=active]:border-amber-500 data-[state=active]:text-amber-600 dark:data-[state=active]:text-amber-400" },
  { id: "battery", label: "Battery", icon: BatteryCharging, active: "data-[state=active]:border-emerald-500 data-[state=active]:text-emerald-600 dark:data-[state=active]:text-emerald-400" },
  { id: "load", label: "Load", icon: Home, active: "data-[state=active]:border-sky-500 data-[state=active]:text-sky-600 dark:data-[state=active]:text-sky-400" },
  { id: "grid", label: "Grid", icon: Zap, active: "data-[state=active]:border-violet-500 data-[state=active]:text-violet-600 dark:data-[state=active]:text-violet-400" },
];

/** Performance for a solar inverter: five tabs (inverter, solar, battery, load, grid); the one you open shows its figures, charts and
 *  findings underneath, for the period chosen with the range picker. */
export function PerformanceBoard(props: PerformanceBoardProps) {
  return (
    <RangeProvider deviceId={props.deviceId} scope="performance">
      <Board {...props} />
    </RangeProvider>
  );
}

interface PerformanceBoardProps {
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
}

function Board({ deviceId, initial, pvKeys, tariff, batteryProfile, solarKwp, extras }: PerformanceBoardProps) {
  const keys = React.useMemo(() => [...PERFORMANCE_LIVE_KEYS, ...pvInputKeys(pvKeys)], [pvKeys]);
  const live = useLiveNumbers([deviceId], keys, initial);
  const hash = React.useSyncExternalStore(subscribeHash, readHash, () => "");
  const section: PerformanceSectionId = (SECTION_IDS as string[]).includes(hash) ? (hash as PerformanceSectionId) : "solar";
  // The days every chart below follows: the range picker (Today by default, 7 / 30 / 90 days, 1 / 2 years, or a custom start).
  const range = useRange();
  const fromMs = range?.window.fromMs ?? 0;
  const toMs = range?.window.toMs ?? 0;
  const span = React.useMemo(() => ({ fromMs, toMs }), [fromMs, toMs]);
  const period = range ? periodText(range.preset, span) : "";
  const open = (id: PerformanceSectionId) => {
    window.location.hash = id;
  };

  const props = { deviceId, span, periodText: period, isToday: range?.preset === "today", live, tariff, pvKeys };

  return (
    <div className="space-y-5">
      <Tabs value={section} onValueChange={(v) => open(v as PerformanceSectionId)}>
        <TabsList variant="line">
          {SECTION_TABS.map((t) => (
            <TabsTrigger key={t.id} value={t.id} variant="line" className={t.active}>
              <t.icon className="size-4 shrink-0" />
              <span className="text-sm font-medium">{t.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-foreground capitalize">{section} in detail</h2>
        <RangeBar presets={LONG_PRESETS} />
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
