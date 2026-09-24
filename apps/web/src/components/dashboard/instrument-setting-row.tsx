"use client";

import * as React from "react";
import { toast } from "sonner";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonSpinner, Spinner } from "@/components/ui/spinner";
import { Field, FieldContent, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { EnumOption, SettingField } from "@/lib/device-settings-data";
import { updateInstrumentSetting } from "@/app/dashboard/devices/[deviceId]/actions";

function rangeHint(field: SettingField): string | null {
  if (field.validMin !== null && field.validMax !== null) return `Valid range: ${field.validMin}–${field.validMax}${field.unit ? ` ${field.unit}` : ""}.`;
  if (field.validMin !== null) return `Minimum: ${field.validMin}${field.unit ? ` ${field.unit}` : ""}.`;
  if (field.validMax !== null) return `Maximum: ${field.validMax}${field.unit ? ` ${field.unit}` : ""}.`;
  return null;
}

/** One row in a solar inverter's Battery/Generator/Grid/Solar/System
 *  settings tab — driven entirely by instrument_catalog, unlike the older
 *  hardcoded SettingFieldRow. Three behaviors that field doesn't have:
 *  - min_role above 'customer' renders read-only with an info tooltip
 *    explaining who can change it, instead of an editable input.
 *  - value_kind 'enum' renders real labels from instrument_enum_values,
 *    not a hand-maintained options list.
 *  - regulated fields require an explicit confirm dialog before the write
 *    goes through (still customer-editable — this isn't a role gate,
 *    just a "you understand this affects grid compliance" checkpoint). */
export function InstrumentSettingRow({
  deviceId,
  field,
  enumOptions,
}: {
  deviceId: string;
  field: SettingField;
  enumOptions: EnumOption[];
}) {
  const [value, setValue] = React.useState(field.currentValue ?? "");
  const [pending, startTransition] = React.useTransition();
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [pendingValue, setPendingValue] = React.useState<string | null>(null);
  const fieldId = `instrument-setting-${field.key}`;

  function commit(nextValue: string, confirmed: boolean) {
    setValue(nextValue);
    startTransition(async () => {
      const result = await updateInstrumentSetting(deviceId, field.key, nextValue, confirmed);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success(`${field.name} saved.`);
      }
    });
  }

  function save(nextValue: string) {
    if (field.regulated) {
      setPendingValue(nextValue);
      setConfirmOpen(true);
      return;
    }
    commit(nextValue, false);
  }

  const helpText = field.description ?? rangeHint(field);

  if (field.minRole !== "customer") {
    return (
      <Field orientation="responsive">
        <FieldLabel className="flex items-center gap-1.5">
          {field.name}
          {field.unit ? ` (${field.unit})` : ""}
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="size-3.5 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent>Only a {field.minRole.replace(/_/g, " ")} can change this setting.</TooltipContent>
          </Tooltip>
        </FieldLabel>
        <FieldContent>
          <p className="text-sm text-foreground">{field.currentValue || "—"}</p>
          {helpText && <FieldDescription>{helpText}</FieldDescription>}
        </FieldContent>
      </Field>
    );
  }

  return (
    <>
      <Field orientation="responsive">
        <FieldLabel htmlFor={fieldId}>
          {field.name}
          {field.unit ? ` (${field.unit})` : ""}
        </FieldLabel>
        <FieldContent>
          {field.valueKind === "boolean" ? (
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
                type={field.valueKind === "text" ? "text" : "number"}
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

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm grid-compliance change</AlertDialogTitle>
            <AlertDialogDescription>
              {field.name} affects how your inverter interacts with the grid. Changing it may affect compliance with your
              local grid connection agreement — make sure you understand the effect before saving.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingValue(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingValue !== null) commit(pendingValue, true);
                setPendingValue(null);
              }}
            >
              Confirm and save
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
