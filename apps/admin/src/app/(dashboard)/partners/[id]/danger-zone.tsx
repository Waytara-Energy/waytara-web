"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ActionForm } from "@waytara/ui/action-form";
import { FormSubmit } from "@/components/form-submit";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PartnerDecision } from "./partner-decision";
import { deletePartner, setPartnerAccess } from "./actions";

interface Props {
  id: string;
  reference: string | null;
  status: string;
  hasAccount: boolean;
  suspended: boolean;
}

function Row({ title, text, children }: { title: string; text: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-destructive/20 px-5 py-4 last:border-b-0">
      <div className="min-w-0 max-w-xl">
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{text}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

/**
 * The risky actions, at the bottom of the page like GitHub's danger zone: suspend a partner's access (reversible), decline an application (with the choice of what happens
 * to their data), and delete a partner for good (the reference is typed to confirm). Nothing runs until its own dialog's button is pressed.
 */
export function DangerZone({ id, reference, status, hasAccount, suspended }: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const finished = status === "approved" || status === "rejected";

  return (
    <section aria-labelledby="danger-heading" className="rounded-lg border border-destructive/40">
      <h2 id="danger-heading" className="border-b border-destructive/20 px-5 py-3 text-sm font-semibold text-destructive">
        Danger zone
      </h2>

      {hasAccount && (
        <Row title={suspended ? "Restore access" : "Suspend access"} text={suspended ? "They cannot sign in now. Restoring lets them sign in again with the same account." : "They can no longer sign in. Their account and everything on it stay as they are, and you can restore access later."}>
          <ActionForm action={setPartnerAccess.bind(null, id, suspended)} loading={suspended ? "Restoring…" : "Suspending…"} success={suspended ? "Access restored." : "Access suspended."}>
            <Button type="submit" size="sm" variant="outline">
              {suspended ? "Restore access" : "Suspend access"}
            </Button>
          </ActionForm>
        </Row>
      )}

      {!finished && (
        <Row title="Decline this application" text="Closes their link and sends a final e-mail. You choose what happens to their data: delete everything, delete the documents and keep the contact details, or keep it as it is.">
          <PartnerDecision id={id} reference={reference} status={status} gaps={[]} parts={["decline"]} declineLabel="Decline…" />
        </Row>
      )}

      <Row title="Delete this partner" text="Deletes everything for good: the application, every file, everything they entered and their sign-in account. They are e-mailed first. It cannot be undone.">
        <Button type="button" size="sm" variant="destructive" onClick={() => setOpen(true)}>
          Delete this partner…
        </Button>
      </Row>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this partner</DialogTitle>
            <DialogDescription>
              Everything is deleted and cannot be brought back. They are sent a last e-mail first; if it cannot be sent, nothing is deleted.
            </DialogDescription>
          </DialogHeader>
          <ActionForm
            action={async (formData) => {
              await deletePartner(id, formData);
              router.replace("/partners");
            }}
            loading="Deleting…"
            success="Partner deleted."
            className="grid gap-4"
          >
            <div className="grid gap-2">
              <Label htmlFor="delete-confirm">Type the reference {reference ? <span className="font-mono">{reference}</span> : null} to confirm</Label>
              <Input id="delete-confirm" name="confirm" autoComplete="off" required placeholder={reference ?? ""} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <FormSubmit variant="destructive" pendingText="Deleting…">
                Delete for good
              </FormSubmit>
            </DialogFooter>
          </ActionForm>
        </DialogContent>
      </Dialog>
    </section>
  );
}
