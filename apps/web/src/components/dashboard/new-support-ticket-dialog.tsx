"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
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
import { notify } from "@waytara/ui/notify";
import { createSupportTicket } from "@/app/dashboard/support/actions";

/** The intake form for a new ticket — subject + first message, optional
 *  attachment. Standing in for "QuestionnaireNew" (no such component
 *  exists in any shadcn registry under that name; this is the closest
 *  real equivalent, per the approved plan's own note on that gap).
 *
 *  Submitting shows a loading → success/error toast. Unlike the other
 *  dialogs' `withPromiseToast`, this one navigates to the new ticket's own
 *  page on success — so it calls `notify.promise` directly instead, to get
 *  at the created ticket's id for that navigation (`withPromiseToast`
 *  only reports whether the call succeeded, not its return value). A
 *  failed submit leaves the dialog open with what was typed. */
export function NewSupportTicketDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  async function handleSubmit(formData: FormData) {
    const promise = createSupportTicket(formData);
    notify.promise(promise, {
      loading: "Opening ticket…",
      success: () => "Ticket opened.",
      error: (e) => (e instanceof Error ? e.message : "Something went wrong."),
    });
    try {
      const { id } = await promise;
      setOpen(false);
      router.push(`/dashboard/support/${id}`);
    } catch {
      // Already surfaced via the toast above — dialog stays open.
    }
  }

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

        <form action={handleSubmit} className="space-y-4">
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
