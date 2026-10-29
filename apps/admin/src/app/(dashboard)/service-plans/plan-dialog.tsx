"use client";

import * as React from "react";
import { Pencil, Plus } from "lucide-react";
import { ActionForm } from "@waytara/ui/action-form";
import { FormSubmit } from "@/components/form-submit";
import { StringListEditor } from "@/components/string-list-editor";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface ServicePlanRow {
  id: string;
  name: string;
  device_category: string;
  duration_months: number;
  total_services_included: number;
  free_services_count: number;
  price_amount: number | null;
  per_extra_service_price_amount: number | null;
  covered_items: unknown;
  paid_extras: unknown;
}

function Field({ label, name, type = "text", required, placeholder, defaultValue, className }: { label: string; name: string; type?: string; required?: boolean; placeholder?: string; defaultValue?: string | number | null; className?: string }) {
  return (
    <div className={`grid gap-2 ${className ?? ""}`}>
      <Label htmlFor={name}>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      <Input id={name} name={name} type={type} required={required} placeholder={placeholder} defaultValue={defaultValue ?? ""} step={type === "number" ? "any" : undefined} />
    </div>
  );
}

/** The form of a service plan (an AMC-style template per device category), in a dialog: it adds a plan, or edits the one it is given. It closes when the save works. */
export function ServicePlanDialog({ plan, action }: { plan?: ServicePlanRow; action: (formData: FormData) => Promise<unknown> }) {
  const [open, setOpen] = React.useState(false);
  // a failed save throws, so the dialog stays open with its toast; only a good one closes it
  const run = React.useCallback(
    async (formData: FormData) => {
      await action(formData);
      setOpen(false);
    },
    [action]
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {plan ? (
          <Button variant="ghost" size="sm">
            <Pencil />
            Edit
          </Button>
        ) : (
          <Button>
            <Plus />
            Add a service plan
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{plan ? `Edit ${plan.name}` : "Add a service plan"}</DialogTitle>
          <DialogDescription>A plan is a template for one kind of device. Attach it to a device to make it that device&apos;s active service contract.</DialogDescription>
        </DialogHeader>
        <ActionForm action={run} loading={plan ? "Saving…" : "Adding plan…"} success={plan ? "Saved." : "Plan added."} className="grid gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" name="name" required defaultValue={plan?.name} />
            <Field label="Device category" name="deviceCategory" required placeholder="e.g. solar_inverter" defaultValue={plan?.device_category} />
            <Field label="Duration (months)" name="durationMonths" type="number" required defaultValue={plan?.duration_months} />
            <Field label="Services included" name="totalServicesIncluded" type="number" required defaultValue={plan?.total_services_included} />
            <Field label="Free services" name="freeServicesCount" type="number" defaultValue={plan?.free_services_count ?? 0} />
            <Field label="Plan price (₹)" name="priceAmount" type="number" defaultValue={plan?.price_amount} />
            <Field label="Price per extra visit (₹)" name="perExtraServicePriceAmount" type="number" defaultValue={plan?.per_extra_service_price_amount} />
          </div>
          <div className="grid gap-2">
            <Label>What the plan covers</Label>
            <StringListEditor name="coveredItems" initial={plan?.covered_items} placeholder="e.g. annual health check" addLabel="Add an item" />
          </div>
          <div className="grid gap-2">
            <Label>Paid extras</Label>
            <StringListEditor name="paidExtras" initial={plan?.paid_extras} placeholder="e.g. panel deep-clean" addLabel="Add an extra" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <FormSubmit pendingText="Saving…">{plan ? "Save changes" : "Add plan"}</FormSubmit>
          </DialogFooter>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}
