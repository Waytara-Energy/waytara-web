"use client";

import * as React from "react";
import { Paperclip, Plus } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Attachment } from "@/components/ui/attachment";
import { createSupportTicket } from "@/app/dashboard/support/actions";

/** The intake form for a new ticket — subject + first message, optional
 *  attachment. Standing in for "QuestionnaireNew" (no such component
 *  exists in any shadcn registry under that name; this is the closest
 *  real equivalent, per the approved plan's own note on that gap). Same
 *  reopen-on-error behavior as NewMaintenanceTicketDialog. */
export function NewSupportTicketDialog({ error }: { error?: string }) {
  const [open, setOpen] = React.useState(!!error);
  const [file, setFile] = React.useState<File | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

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
          <DialogTitle>Open a support ticket</DialogTitle>
          <DialogDescription>Your assigned WayTara advisor will reply here.</DialogDescription>
        </DialogHeader>

        {error && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <form action={createSupportTicket} className="space-y-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="subject">Subject</FieldLabel>
              <FieldContent>
                <Input id="subject" name="subject" required placeholder="e.g. Inverter tripping every evening" />
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel htmlFor="message">Message</FieldLabel>
              <FieldContent>
                <Textarea
                  id="message"
                  name="message"
                  rows={4}
                  required
                  placeholder="Describe what's happening..."
                />
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel>Attachment (optional)</FieldLabel>
              <FieldContent>
                {file ? (
                  <Attachment
                    fileName={file.name}
                    fileSize={file.size}
                    onRemove={() => {
                      setFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                  />
                ) : (
                  <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                    <Paperclip className="size-4" />
                    Attach a file
                  </Button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  name="attachment"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </FieldContent>
            </Field>
          </FieldGroup>

          <DialogFooter>
            <SubmitButton pendingText="Opening…">Open Ticket</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
