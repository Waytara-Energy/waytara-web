"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldContent, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { withPromiseToast } from "@waytara/ui/notify";
import { createMaintenanceTicket } from "@/app/dashboard/maintenance/actions";

/** Standing in for a "new ticket" form — same `createMaintenanceTicket`
 *  action as before, just inside a Dialog instead of an always-visible
 *  inline form. No more a site picker: the device (and its site) is
 *  already chosen on the Maintenance page itself (via the site switcher +
 *  this page's own device picker), so this form is just the description —
 *  shown as read-only context instead, so the customer can still confirm
 *  they're reporting against the right thing. Submitting shows a
 *  loading → success/error toast (withPromiseToast); the dialog itself
 *  only closes on success, so a failed submit leaves the typed
 *  description right where the customer left it. */
export function NewMaintenanceTicketDialog({
  deviceId,
  deviceLabel,
  siteId,
  siteName,
  defaultDescription,
  trigger,
}: {
  deviceId: string;
  deviceLabel: string;
  siteId: string;
  siteName: string | null;
  /** Text the box starts with (for a fault the page already knows about). */
  defaultDescription?: string;
  /** The button that opens it, when it is not the usual "Report an issue" button. */
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);

  async function handleSubmit(formData: FormData) {
    const ok = await withPromiseToast(createMaintenanceTicket.bind(null, deviceId, siteId), {
      loading: "Submitting…",
      success: "Ticket submitted.",
    })(formData);
    if (ok) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Plus className="size-4" />
            Report an issue
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report an issue</DialogTitle>
          <DialogDescription>
            For {deviceLabel}
            {siteName ? ` at ${siteName}` : ""} — we&apos;ll route this to the team assigned to your account.
          </DialogDescription>
        </DialogHeader>

        <form action={handleSubmit} className="space-y-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="description">Describe the issue</FieldLabel>
              <FieldContent>
                <Textarea
                  id="description"
                  name="description"
                  rows={4}
                  required
                  defaultValue={defaultDescription}
                  placeholder="e.g. Inverter display shows an error code."
                />
              </FieldContent>
            </Field>
          </FieldGroup>

          <DialogFooter>
            <SubmitButton pendingText="Submitting…">Submit Request</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
