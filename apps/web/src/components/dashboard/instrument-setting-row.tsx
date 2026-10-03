"use client";

import * as React from "react";
import { withPromiseToast } from "@waytara/ui/notify";
import { Button } from "@/components/ui/button";
import { ButtonSpinner, Spinner } from "@/components/ui/spinner";
import { Field, FieldContent, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { EnumOption, SettingField } from "@/lib/instrument-catalog-data";
import { updateInstrumentSetting } from "@/app/dashboard/devices/actions";

function rangeHint(field: SettingField): string | null {
  if (field.validMin !== null && field.validMax !== null) return `Valid range: ${field.validMin}–${field.validMax}${field.unit ? ` ${field.unit}` : ""}.`;
  if (field.validMin !== null) return `Minimum: ${field.validMin}${field.unit ? ` ${field.unit}` : ""}.`;
  if (field.validMax !== null) return `Maximum: ${field.validMax}${field.unit ? ` ${field.unit}` : ""}.`;
  return null;
}

/** One row in a device's Settings tab — driven entirely by
 *  equipment_metrics/equipment_templates. Every field this renders is
 *  already write-direction and show_for_user = true (fetchDeviceSettingFields
 *  only returns those), so unlike the earlier instrument_catalog-driven
 *  version there's no separate read-only/min_role branch here — direction
 *  alone already decided that before this component ever sees the field. */
export function InstrumentSettingRow({
  deviceId,
  field,
  enumOptions,
  className,
}: {
  deviceId: string;
  field: SettingField;
  enumOptions: EnumOption[];
  className?: string;
}) {
  const [value, setValue] = React.useState(field.currentValue ?? "");
  const [pending, startTransition] = React.useTransition();
  const fieldId = `instrument-setting-${field.key}`;

  function save(nextValue: string) {
    setValue(nextValue);
    startTransition(async () => {
      await withPromiseToast(updateInstrumentSetting.bind(null, deviceId, field.key), {
        loading: `Saving ${field.name}…`,
        success: `${field.name} saved.`,
      })(nextValue);
    });
  }

  const helpText = rangeHint(field);

  return (
    <Field orientation="responsive" className={className}>
      <FieldLabel htmlFor={fieldId}>
        {field.name}
        {field.unit ? ` (${field.unit})` : ""}
      </FieldLabel>
      <FieldContent>
        {field.valueKind === "bool" ? (
          <div className="flex items-center gap-2">
            <Switch id={fieldId} checked={value === "true"} disabled={pending} onCheckedChange={(checked) => save(checked ? "true" : "false")} />
            {pending && <Spinner className="size-3.5 text-muted-foreground" />}
          </div>
        ) : field.valueKind === "enum" ? (
          <div className="flex items-center gap-2">
            <Select value={value || undefined} disabled={pending} onValueChange={save}>
              <SelectTrigger id={fieldId} className="w-full max-w-xs">
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                {enumOptions.map((o) => (
                  <SelectItem key={o.code} value={o.code}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {pending && <Spinner className="size-3.5 shrink-0 text-muted-foreground" />}
          </div>
        ) : (
          <div className="flex max-w-xs items-center gap-2">
            <Input
              id={fieldId}
              type={field.valueKind === "number" ? "number" : field.valueKind === "time" ? "time" : "text"}
              min={field.validMin ?? undefined}
              max={field.validMax ?? undefined}
              value={value}
              disabled={pending}
              onChange={(e) => setValue(e.target.value)}
            />
            <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => save(value)}>
              <ButtonSpinner show={pending} />
              Save
            </Button>
          </div>
        )}
        {helpText && <FieldDescription>{helpText}</FieldDescription>}
      </FieldContent>
    </Field>
  );
}
