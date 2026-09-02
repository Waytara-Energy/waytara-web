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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { createMaintenanceTicket } from "@/app/dashboard/maintenance/actions";

/** Standing in for a "new ticket" form — same `createMaintenanceTicket`
 *  action and field names as before, just inside a Dialog instead of an
 *  always-visible inline form. Reopens itself (`defaultOpen={!!error}`)
 *  when the action redirects back here with an error, so the customer's
 *  in-progress input context (which site, what they typed) isn't lost
 *  behind a closed dialog they'd have to reopen themselves. */
export function NewMaintenanceTicketDialog({
  sites,
  error,
}: {
  sites: { id: string; name: string }[];
  error?: string;
}) {
  const [open, setOpen] = React.useState(!!error);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" />
          New Ticket
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report an issue</DialogTitle>
          <DialogDescription>We&apos;ll route this to the team assigned to your account.</DialogDescription>
        </DialogHeader>

        {error && <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

        <form action={createMaintenanceTicket} className="space-y-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="siteId">Site</FieldLabel>
              <FieldContent>
                <Select name="siteId" required defaultValue={sites[0]?.id}>
                  <SelectTrigger id="siteId" className="w-full">
                    <SelectValue placeholder="Choose a site" />
                  </SelectTrigger>
                  <SelectContent>
                    {sites.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel htmlFor="description">Describe the issue</FieldLabel>
              <FieldContent>
                <Textarea
                  id="description"
                  name="description"
                  rows={4}
                  required
                  placeholder="e.g. Inverter display shows an error code."
                />
              </FieldContent>
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button type="submit">Submit Request</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
