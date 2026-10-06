"use client";

import * as React from "react";
import type { EnumOption } from "@/lib/enum-labels";
import type { FieldValue, TemplateField } from "@/lib/template-field-format";
import { useLiveNumbers } from "@/lib/telemetry/live-values";
import { DynamicFieldGroup } from "./dynamic-field-group";

/** A group of readings (phase meter, numbered strip, or plain list - DynamicFieldGroup decides) whose numbers follow
 *  the device's live channel. `initial` is what the server rendered; values the device does not report live
 *  (text, computed figures) simply keep it. No page refresh, no refetch. */
export function LiveDynamicFieldGroup({
  deviceId,
  title,
  fields,
  initial,
  enumOptions,
}: {
  deviceId: string;
  title: string;
  fields: TemplateField[];
  initial: Record<string, FieldValue>;
  enumOptions?: Record<string, EnumOption[]>;
}) {
  const keys = React.useMemo(() => fields.map((f) => f.key), [fields]);
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
  const options = React.useMemo(() => (enumOptions ? new Map(Object.entries(enumOptions)) : undefined), [enumOptions]);
  return <DynamicFieldGroup title={title} fields={fields} getValue={getValue} enumOptionsByRef={options} />;
}
