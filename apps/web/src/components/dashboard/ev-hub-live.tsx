"use client";

import * as React from "react";
import type { EnumOption } from "@/lib/enum-labels";
import type { FieldValue } from "@/lib/template-field-format";
import type { FieldGroup } from "@/lib/template-fields";
import { useLiveNumbers } from "@/lib/telemetry/live-values";
import { useUnits } from "@/components/units-provider";
import { renderGroup } from "./monitoring-shared";

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
  const { prefs } = useUnits();
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
  return <>{groups.map(({ category, group }) => renderGroup(category, group, getValue, options, prefs))}</>;
}
