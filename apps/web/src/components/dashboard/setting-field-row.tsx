"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ButtonSpinner, Spinner } from "@/components/ui/spinner";
import { Field, FieldContent, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { SettingField } from "@/lib/instrument-settings-catalog";
import { updateDeviceSetting } from "@/app/dashboard/settings/instruments/actions";

/** One row in a Deye settings tab (Basic/Battery/System Work Mode/Grid/
 *  Gen) — number/select/toggle, each saving independently via a direct
 *  server-action call (not a native form submit) so ~25 fields across 5
 *  tabs don't mean 25 full-page redirects. Select/toggle save immediately
 *  on change; number needs an explicit Save so typing doesn't fire a
 *  write per keystroke. */
export function SettingFieldRow({ field, currentValue }: { field: SettingField; currentValue: string }) {
  const [value, setValue] = React.useState(currentValue);
  const [pending, startTransition] = React.useTransition();
  const fieldId = `setting-${field.key}`;

  function save(nextValue: string) {
    setValue(nextValue);
    startTransition(async () => {
      const result = await updateDeviceSetting(field.key, nextValue);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success(`${field.label} saved.`);
      }
    });
  }

  return (
    <Field orientation="responsive">
      <FieldLabel htmlFor={fieldId}>
        {field.label}
        {field.unit ? ` (${field.unit})` : ""}
      </FieldLabel>
      <FieldContent>
        {field.type === "toggle" ? (
          <div className="flex items-center gap-2">
            <Switch
              id={fieldId}
              checked={value === "true"}
              disabled={pending}
              onCheckedChange={(checked) => save(checked ? "true" : "false")}
            />
            {pending && <Spinner className="size-3.5 text-muted-foreground" />}
          </div>
        ) : field.type === "select" ? (
          <div className="flex items-center gap-2">
            <Select value={value || undefined} disabled={pending} onValueChange={save}>
              <SelectTrigger id={fieldId} className="w-full max-w-xs">
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
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
              type="number"
              min={field.min}
              max={field.max}
              step={field.step}
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
        {field.helpText && <FieldDescription>{field.helpText}</FieldDescription>}
      </FieldContent>
    </Field>
  );
}
