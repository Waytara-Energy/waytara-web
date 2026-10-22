"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { ActionForm } from "@waytara/ui/action-form";
import { Button } from "@waytara/ui/button";
import { Input } from "@waytara/ui/input";
import { recordSubscription, setSubscriptionStatus } from "./actions";

export interface PlanOption {
  id: string;
  name: string;
  price: number;
}

const field = "h-9 w-full rounded-md border border-border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
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
    <div className="flex items-center justify-end gap-3">
      {running && (
        <ActionForm action={setSubscriptionStatus.bind(null, current.id, "cancelled")} loading="Cancelling…" success="Subscription cancelled." onSubmit={(e) => { if (!window.confirm(`Cancel ${customerName}'s subscription?`)) e.preventDefault(); }}>
          <button type="submit" className="text-xs text-muted-foreground underline-offset-2 hover:text-destructive hover:underline">
            Cancel
          </button>
        </ActionForm>
      )}

      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <DialogPrimitive.Trigger asChild>
          <button type="button" className="text-primary hover:underline">
            {current ? "Renew" : "Record subscription"}
          </button>
        </DialogPrimitive.Trigger>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60" />
          <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <DialogPrimitive.Title className="text-lg font-semibold">{current ? "Renew subscription" : "Record subscription"}</DialogPrimitive.Title>
                <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">For {customerName}. They see it on their Billing &amp; Plan page.</DialogPrimitive.Description>
              </div>
              <DialogPrimitive.Close className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Close">
                <X className="size-4" />
              </DialogPrimitive.Close>
            </div>

            <ActionForm
              action={async (formData) => {
                await recordSubscription(customerId, formData);
                setOpen(false);
              }}
              loading="Recording…"
              success="Subscription recorded."
              className="mt-5 space-y-4"
            >
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground" htmlFor={`plan-${customerId}`}>
                  Plan
                </label>
                <select id={`plan-${customerId}`} name="planId" required defaultValue={current?.planId ?? ""} className={field}>
                  <option value="" disabled>
                    Choose a plan…
                  </option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · ₹{p.price.toLocaleString("en-IN")}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor={`start-${customerId}`}>
                    Starts on
                  </label>
                  <Input id={`start-${customerId}`} type="date" name="start" defaultValue={today} required className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor={`months-${customerId}`}>
                    Runs for
                  </label>
                  <select id={`months-${customerId}`} name="months" defaultValue="12" className={field}>
                    {LENGTHS.map((l) => (
                      <option key={l.months} value={l.months}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor={`status-${customerId}`}>
                    State
                  </label>
                  <select id={`status-${customerId}`} name="status" defaultValue="active" className={field}>
                    <option value="active">Active</option>
                    <option value="trialing">Trial</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor={`ref-${customerId}`}>
                    Payment reference <span className="font-normal">(optional)</span>
                  </label>
                  <Input id={`ref-${customerId}`} name="ref" maxLength={120} placeholder="e.g. UPI ref" className="h-9" />
                </div>
              </div>

              <Button type="submit" className="w-full">
                Record subscription
              </Button>
            </ActionForm>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </div>
  );
}
