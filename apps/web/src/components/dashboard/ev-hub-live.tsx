"use client";

import * as React from "react";
import { ArrowDownToLine, Gauge, Plug, Zap } from "lucide-react";
import type { EnumOption } from "@/lib/enum-labels";
import type { FieldValue } from "@/lib/template-field-format";
import type { FieldGroup } from "@/lib/template-fields";
import { useLiveNumbers } from "@/lib/telemetry/live-values";
import { LiveStatusCard } from "./live-status-card";
import { renderGroup } from "./monitoring-shared";

const CARD_KEYS = ["power_active_import_kw", "power_offered_kw"];

/** The charger hub's headline row: offered power and utilization follow the live channel; session count and energy
 *  come from charging sessions (not telemetry), so they are the server's figures. */
export function EvHubCards({
  deviceId,
  initial,
  sessionsToday,
  energyTodayKwh,
}: {
  deviceId: string;
  initial: Record<string, number | null>;
  sessionsToday: number;
  energyTodayKwh: number;
}) {
  const n = useLiveNumbers([deviceId], CARD_KEYS, initial);
  const powerKw = n.power_active_import_kw;
  const offeredKw = n.power_offered_kw;
  const utilizationPct = powerKw !== null && offeredKw !== null && offeredKw > 0 ? Math.max(0, Math.min(100, (powerKw / offeredKw) * 100)) : null;
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <LiveStatusCard
        icon={Zap}
        title="Power Offered"
        subtitle="Max charger output"
        value={offeredKw !== null ? `${offeredKw.toFixed(1)} kW` : "—"}
        liveValue={offeredKw}
        statusLabel="Status"
        badgeLabel="Live"
        badgeTone="neutral"
        sparkline={[]}
      />
      <LiveStatusCard
        icon={Plug}
        title="Sessions"
        subtitle="Started today"
        value={String(sessionsToday)}
        liveValue={sessionsToday}
        statusLabel="Status"
        badgeLabel="Today"
        badgeTone="neutral"
        sparkline={[]}
      />
      <LiveStatusCard
        icon={ArrowDownToLine}
        title="Energy Delivered"
        subtitle="Total today"
        value={`${energyTodayKwh.toFixed(1)} kWh`}
        liveValue={energyTodayKwh}
        statusLabel="Status"
        badgeLabel="Today"
        badgeTone={energyTodayKwh > 0 ? "good" : "neutral"}
        sparkline={[]}
      />
      <LiveStatusCard
        icon={Gauge}
        title="Power Utilization"
        subtitle="Of max output"
        value={utilizationPct !== null ? `${utilizationPct.toFixed(0)}%` : "—"}
        liveValue={utilizationPct}
        statusLabel="Status"
        badgeLabel="Live"
        badgeTone="neutral"
        sparkline={[]}
      />
    </div>
  );
}

/** The hub's reading groups, live in place like the solar screen's. `initial` is what the server rendered. */
export function EvHubGroups({
  deviceId,
  groups,
  initial,
  enumOptions,
}: {
  deviceId: string;
  groups: { category: string; group: FieldGroup }[];
  initial: Record<string, FieldValue>;
  enumOptions: Record<string, EnumOption[]>;
}) {
  const keys = React.useMemo(() => groups.flatMap((g) => g.group.fields.map((f) => f.key)), [groups]);
  const initialNumbers = React.useMemo(() => {
    const out: Record<string, number | null> = {};
    for (const k of keys) out[k] = typeof initial[k] === "number" ? (initial[k] as number) : null;
    return out;
  }, [keys, initial]);
  const live = useLiveNumbers([deviceId], keys, initialNumbers, () => "first");
  const getValue = (key: string): FieldValue => {
    const v = live[key];
    return v !== undefined && v !== null ? v : (initial[key] ?? null);
  };
  const options = React.useMemo(() => new Map(Object.entries(enumOptions)), [enumOptions]);
  return <>{groups.map(({ category, group }) => renderGroup(category, group, getValue, options))}</>;
}
