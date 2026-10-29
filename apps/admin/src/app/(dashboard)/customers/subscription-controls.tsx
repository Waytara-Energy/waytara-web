"use client";

import * as React from "react";
import { ActionForm } from "@waytara/ui/action-form";
import { FormSubmit } from "@/components/form-submit";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { recordSubscription, setSubscriptionStatus } from "./actions";

export interface PlanOption {
  id: string;
  name: string;
  price: number;
}

const LENGTHS = [
  { months: 1, label: "1 month" },
  { months: 3, label: "3 months" },
  { months: 6, label: "6 months" },
  { months: 12, label: "1 year" },
  { months: 24, label: "2 years" },
];

/** The two things an admin does about a customer's subscription: record one (or a renewal), and cancel the current one. */
export function SubscriptionControls({
  customerId,
  customerName,
  plans,
  today,
  current,
}: {
  customerId: string;
  customerName: string;
  plans: PlanOption[];
  /** today in India, YYYY-MM-DD: the start day the form begins with */
  today: string;
  /** the latest subscription, when there is one and it is still running */
  current: { id: string; status: string; planId: string } | null;
}) {
  const [open, setOpen] = React.useState(false);
  const running = current && (current.status === "active" || current.status === "trialing");

  return (
    <div className="flex items-center justify-end gap-1">
      {running ? (
        <ActionForm
          action={setSubscriptionStatus.bind(null, current.id, "cancelled")}
          loading="Cancelling…"
          success="Subscription cancelled."
          onSubmit={(e) => {
            if (!window.confirm(`Cancel ${customerName}'s subscription?`)) e.preventDefault();
          }}
        >
          <FormSubmit variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" pendingText="Cancelling…">
            Cancel
          </FormSubmit>
        </ActionForm>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            {current ? "Renew" : "Record subscription"}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{current ? "Renew subscription" : "Record subscription"}</DialogTitle>
            <DialogDescription>For {customerName}. They see it on their Billing &amp; Plan page.</DialogDescription>
          </DialogHeader>

          <ActionForm
            action={async (formData) => {
              await recordSubscription(customerId, formData);
              setOpen(false);
            }}
            loading="Recording…"
            success="Subscription recorded."
            className="grid gap-4"
          >
            <div className="grid gap-2">
              <Label>Plan</Label>
              <Select name="planId" required defaultValue={current?.planId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a plan" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} · ₹{p.price.toLocaleString("en-IN")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor={`start-${customerId}`}>Starts on</Label>
                <Input id={`start-${customerId}`} type="date" name="start" defaultValue={today} required />
              </div>
              <div className="grid gap-2">
                <Label>Runs for</Label>
                <Select name="months" defaultValue="12">
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LENGTHS.map((l) => (
                      <SelectItem key={l.months} value={String(l.months)}>
                        {l.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>State</Label>
                <Select name="status" defaultValue="active">
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="trialing">Trial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`ref-${customerId}`}>
                  Payment reference <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Input id={`ref-${customerId}`} name="ref" maxLength={120} placeholder="e.g. UPI ref" />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <FormSubmit pendingText="Recording…">Record subscription</FormSubmit>
            </DialogFooter>
          </ActionForm>
        </DialogContent>
      </Dialog>
    </div>
  );
}
