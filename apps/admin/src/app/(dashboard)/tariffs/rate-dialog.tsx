"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { ActionForm } from "@waytara/ui/action-form";
import { FormSubmit } from "@/components/form-submit";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { INDIAN_STATES, TARIFF_CATEGORIES } from "@/lib/india-states";

function Field({ label, name, hint, className, ...props }: { label: string; name: string; hint?: string; className?: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className={`grid gap-2 ${className ?? ""}`}>
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} {...props} />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** Adds an electricity rate: a state, a kind of property, its slabs or single rate, and the date it takes effect. Closes when the save works. */
export function RateDialog({ action, today }: { action: (formData: FormData) => Promise<unknown>; today: string }) {
  const [open, setOpen] = React.useState(false);
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
        <Button>
          <Plus />
          Add a rate
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Add a rate</DialogTitle>
          <DialogDescription>Enter a regulator&apos;s order as soon as it is published, with the date it takes effect. Customers are e-mailed on that day.</DialogDescription>
        </DialogHeader>
        <ActionForm action={run} loading="Saving rate…" success="Rate saved." className="grid gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>State</Label>
              <Select name="state" required>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a state" />
                </SelectTrigger>
                <SelectContent>
                  {INDIAN_STATES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Kind of property</Label>
              <Select name="category" defaultValue="residential" required>
                <SelectTrigger className="w-full capitalize">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TARIFF_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c} className="capitalize">
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Field label="Single rate (₹ per kWh)" name="rate" type="number" step="0.01" min="0" max="100" placeholder="Only if there are no slabs" />
            <Field label="Export rate (optional)" name="exportRate" type="number" step="0.01" min="0" max="100" placeholder="Empty: netted against imports" />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="slabs">Slabs</Label>
            <Textarea id="slabs" name="slabs" rows={5} className="font-mono text-xs" placeholder={"100 3.50\n300 6.00\n400 7.50\n9.75"} />
            <p className="text-xs text-muted-foreground">One band per line: the top of the band in units per bill, then ₹ per unit. The last line is just the rate, for everything above.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label>Bill covers</Label>
              <Select name="billingMonths" defaultValue="1">
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 month</SelectItem>
                  <SelectItem value="2">2 months (e.g. Tamil Nadu)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Field label="Electricity duty (%)" name="dutyPct" type="number" step="0.1" min="0" max="50" defaultValue="0" />
            <Field label="Fuel / wheeling (₹ per unit)" name="surcharge" type="number" step="0.01" min="0" max="20" defaultValue="0" />
            <Field label="Free units per bill" name="freeUnits" type="number" step="1" min="0" max="1000" defaultValue="0" />
            <Field label="Free units stop above" name="freeUnitsCap" type="number" step="1" min="0" placeholder="Empty: never" />
            <Field label="Free units left above that" name="freeUnitsOverCap" type="number" step="1" min="0" defaultValue="0" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Takes effect on" name="effectiveFrom" type="date" defaultValue={today} required />
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select name="confidence" defaultValue="verified">
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="verified">Verified (from the regulator&apos;s order)</SelectItem>
                  <SelectItem value="indicative">Indicative (an estimate)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Field label="Link to the order" name="sourceUrl" type="url" placeholder="https://…" />
            <Field label="Note (optional)" name="sourceNote" placeholder="e.g. TNERC order no. 6 of 2025, LT commercial" />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <FormSubmit pendingText="Saving…">Save rate</FormSubmit>
          </DialogFooter>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}
