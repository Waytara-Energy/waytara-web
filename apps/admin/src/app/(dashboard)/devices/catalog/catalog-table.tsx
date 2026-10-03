"use client";

import * as React from "react";
import { Trash2 } from "lucide-react";
import { Input } from "@waytara/ui/input";
import { Button } from "@waytara/ui/button";
import { ActionForm } from "@waytara/ui/action-form";
import { withPromiseToast } from "@waytara/ui/notify";
import { createEnumValue, updateEnumValue, deleteEnumValue } from "./actions";

export interface EnumValueRow {
  enum_ref: string;
  code: string;
  label: string;
  notes: string | null;
}

function EnumGroup({ enumRef, values }: { enumRef: string; values: EnumValueRow[] }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <h3 className="font-mono text-xs font-medium text-foreground">{enumRef}</h3>
      <div className="mt-2 space-y-1.5">
        {values.map((v) => {
          // Two actions share one form (Save edits label/notes via the
          // form's own action; Delete overrides it via formAction on its
          // own button) — ActionForm only wraps a single `action`, so both
          // get wrapped by hand here the same way it does internally.
          const saveAction = withPromiseToast(updateEnumValue.bind(null, v.enum_ref, v.code), {
            loading: "Saving…",
            success: "Saved.",
          });
          const deleteAction = withPromiseToast(deleteEnumValue.bind(null, v.enum_ref, v.code), {
            loading: "Deleting…",
            success: "Deleted.",
          });
          return (
            <form
              key={v.code}
              action={async (formData: FormData) => {
                await saveAction(formData);
              }}
              className="flex flex-wrap items-center gap-2 rounded-md border border-transparent px-1 py-1 hover:border-border"
            >
              <span className="w-10 shrink-0 font-mono text-xs text-muted-foreground">{v.code}</span>
              <Input name="label" defaultValue={v.label} className="h-8 w-48 text-xs" />
              <Input name="notes" defaultValue={v.notes ?? ""} placeholder="notes" className="h-8 w-48 text-xs" />
              <Button type="submit" variant="outline" size="sm">
                Save
              </Button>
              <Button
                type="submit"
                formAction={async () => {
                  await deleteAction();
                }}
                variant="ghost"
                size="sm"
                className="text-destructive"
              >
                <Trash2 className="size-4" />
              </Button>
            </form>
          );
        })}
      </div>
      <ActionForm
        action={createEnumValue}
        loading="Adding code…"
        success="Code added."
        className="mt-2 flex flex-wrap items-end gap-2 border-t border-border pt-2"
      >
        <input type="hidden" name="enumRef" value={enumRef} />
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Code</label>
          <Input name="code" placeholder="0" className="h-8 w-20 text-xs" required />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Label</label>
          <Input name="label" placeholder="Standby" className="h-8 w-40 text-xs" required />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Notes</label>
          <Input name="notes" className="h-8 w-40 text-xs" />
        </div>
        <Button type="submit" variant="outline" size="sm">
          Add code
        </Button>
      </ActionForm>
    </div>
  );
}

function EnumSection({ enumValues }: { enumValues: EnumValueRow[] }) {
  const [newRef, setNewRef] = React.useState("");
  const grouped = React.useMemo(() => {
    const map = new Map<string, EnumValueRow[]>();
    for (const v of enumValues) {
      const list = map.get(v.enum_ref) ?? [];
      list.push(v);
      map.set(v.enum_ref, list);
    }
    return Array.from(map.entries());
  }, [enumValues]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {grouped.map(([enumRef, values]) => (
          <EnumGroup key={enumRef} enumRef={enumRef} values={values} />
        ))}
      </div>

      <div className="rounded-lg border border-dashed border-border p-3">
        <p className="text-xs font-medium text-muted-foreground">Start a new enum list</p>
        <ActionForm
          action={createEnumValue}
          loading="Creating…"
          success="Enum list created."
          className="mt-2 flex flex-wrap items-end gap-2"
        >
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Enum ref</label>
            <Input
              name="enumRef"
              value={newRef}
              onChange={(e) => setNewRef(e.target.value)}
              placeholder="e.g. inverter_fault_code"
              className="h-8 w-48 text-xs"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">First code</label>
            <Input name="code" placeholder="0" className="h-8 w-20 text-xs" required />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Label</label>
            <Input name="label" placeholder="Standby" className="h-8 w-40 text-xs" required />
          </div>
          <Button type="submit" variant="outline" size="sm">
            Create
          </Button>
        </ActionForm>
      </div>
    </div>
  );
}

export function CatalogTable({ enumValues }: { enumValues: EnumValueRow[] }) {
  return <EnumSection enumValues={enumValues} />;
}
