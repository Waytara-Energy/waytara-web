"use client";

// Presentation helpers shared by the solar and EV Monitoring views (no server-only imports).

import type { LucideIcon } from "lucide-react";
import { TEMPERATURE_MAX_C } from "@/lib/temperature-thresholds";
import type { FieldValue, TemplateField } from "@/lib/template-field-format";
import type { EnumOption } from "@/lib/enum-labels";
import type { FieldGroup } from "@/lib/template-fields";
import type { HeatmapRow } from "./temperature-heatmap";
import { DynamicFieldGroup } from "./dynamic-field-group";
import { groupByPhase } from "./phase-meter-card";
import { groupByIndex } from "./indexed-group-card";
import { LiveReadingsCard } from "./live-readings-card";
import { EnergyStatCard } from "./energy-stat-card";

/** Builds a TemperatureHeatmap's `rows` from a CategorySection's own
 *  fetched fields instead of a hardcoded key/label pair — the label is
 *  always this device's real equipment_templates.display_name, never
 *  invented copy that can drift from (or just plain not match) what the
 *  field actually is. Only picks fields this lookup has a ceiling for, so
 *  a group with non-temperature fields mixed in (e.g. Battery > Live)
 *  can't accidentally feed something else into a °C color scale. */
export function temperatureRowsFor(fields: TemplateField[]): HeatmapRow[] {
  return fields
    .filter((f) => f.key in TEMPERATURE_MAX_C)
    .map((f) => ({ key: f.key, label: f.label, maxC: TEMPERATURE_MAX_C[f.key] }));
}

/** A tab button's own content — icon + label at rest. The active tab
 *  drops its icon (`group-data-[state=active]:hidden`, keyed off the
 *  parent TabsTrigger's own Radix `data-state` via its `group` class) —
 *  that icon, in color, reappears in MonitoringTabs' headline above the
 *  strip instead (see TabHeadlineBar), alongside the live number a tab
 *  button never needs to hold itself. The label's own color comes from
 *  the parent trigger's per-tab active className, not from here. */
export function TabButtonContent({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <>
      <Icon className="size-4 shrink-0 group-data-[state=active]:hidden" />
      <span className="text-sm font-medium">{label}</span>
    </>
  );
}

export function groupTitle(category: string, groupName: string | null): string {
  return groupName ? `${category} — ${groupName}` : category;
}

// Within-tab ordering — the most urgent/actionable group first, the most
// reference-y one last (a lifetime energy total can wait; a fault status
// can't). Only categories whose natural DB order (alphabetical by
// group_name) doesn't already read that way need an entry here; a
// category with one group, or already in the right order, is left out.
const GROUP_PRIORITY: Record<string, string[]> = {
  Inverter: ["Status", "AC output", "Energy"],
  "Solar Array": ["Per input (MPPT)", "Energy"],
  Battery: ["Live", "Battery management system (BMS)", "Battery packs", "Energy"],
  Grid: ["Status", "Per phase", "Energy meter / CT"],
  Generator: ["Live", "Energy"],
};

export function sortGroups<T extends { groupName: string | null }>(category: string, groups: T[]): T[] {
  const order = GROUP_PRIORITY[category];
  if (!order) return groups;
  return [...groups].sort((a, b) => {
    const ai = order.indexOf(a.groupName ?? "");
    const bi = order.indexOf(b.groupName ?? "");
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

// Pure today/lifetime energy totals (Inverter/Solar Array/Battery/
// Generator Energy) get the KPI-tile treatment by name, since "every field
// is a kWh/h figure" is as much a *purpose* match as a shape one. Every
// other group picks its presentation by field shape: PhaseMeterCard or
// ComparisonStripCard when DynamicFieldGroup's own shape detection fires
// (per-phase electrical data, a repeating numbered item), LiveReadingsCard
// otherwise — the status-chip/meter/stat-tile catch-all for everything
// that's neither (a fault/connection status, a cluster of live readings,
// or both at once).
const ENERGY_GROUP_NAMES = new Set(["Energy"]);

export function renderGroup(
  category: string,
  group: FieldGroup,
  getValue: (key: string) => FieldValue,
  enumOptionsByRef?: Map<string, EnumOption[]>
) {
  const title = groupTitle(category, group.groupName);
  const key = `${category}-${group.groupName ?? ""}`;

  if (group.groupName && ENERGY_GROUP_NAMES.has(group.groupName)) {
    return <EnergyStatCard key={key} title={title} fields={group.fields} getValue={getValue} />;
  }
  if (groupByPhase(group.fields) || (groupByIndex(group.fields)?.items.size ?? 0) > 1) {
    return <DynamicFieldGroup key={key} title={title} fields={group.fields} getValue={getValue} enumOptionsByRef={enumOptionsByRef} />;
  }
  return <LiveReadingsCard key={key} title={title} fields={group.fields} getValue={getValue} enumOptionsByRef={enumOptionsByRef} />;
}
