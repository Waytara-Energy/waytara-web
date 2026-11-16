"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ActionForm } from "@waytara/ui/action-form";
import { DECLINE_OPTIONS, type DeclineHandling } from "@waytara/supabase/partner-verification";
import { FormSubmit } from "@/components/form-submit";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { approvePartnerApplication, declinePartnerApplication, requestMorePartnerInfo } from "./actions";

/**
 * The decision on an application: approve it (only when the required checks are verified), ask the applicant for something more, or decline it. Declining asks what
 * happens to their data (the three choices, each saying what is deleted and what is kept) and, for the one that cannot be undone, the reference typed to confirm.
 * Nothing here runs until the dialog's own button is pressed; the final e-mail to the applicant goes out before anything is deleted (see the action).
 */
export function PartnerDecision({ id, reference, status, gaps }: { id: string; reference: string | null; status: string; gaps: string[] }) {
  const [dialog, setDialog] = React.useState<"more" | "decline" | null>(null);
  const [handling, setHandling] = React.useState<DeclineHandling>("keep");
  const [attempt, setAttempt] = React.useState(0);
  const router = useRouter();
  const close = () => setDialog(null);
  const canAskMore = status === "verification" || status === "onboarding";
  const option = DECLINE_OPTIONS.find((o) => o.id === handling)!;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <ActionForm action={approvePartnerApplication.bind(null, id)} loading="Approving…" success="Application approved.">
          <FormSubmit size="sm" disabled={gaps.length > 0} pendingText="Approving…">
            Approve
          </FormSubmit>
        </ActionForm>
        {canAskMore && (
          <Button type="button" size="sm" variant="outline" onClick={() => setDialog("more")}>
            Ask for more…
          </Button>
        )}
        <Button type="button" size="sm" variant="outline" className="text-destructive" onClick={() => setDialog("decline")}>
          Decline…
        </Button>
      </div>
      {gaps.length > 0 && (
        <p className="max-w-xl text-xs text-muted-foreground">
          Not ready to approve: {gaps.join("; ")}.
        </p>
      )}

      <Dialog open={dialog === "more"} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ask for more</DialogTitle>
            <DialogDescription>
              The application goes back to Onboarding with everything they sent kept. They get an e-mail with a new private link and your words below, and the same words show on their page.
            </DialogDescription>
          </DialogHeader>
          <ActionForm action={requestMorePartnerInfo.bind(null, id)} loading="Sending…" success="They have been asked, by e-mail." className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="more-note">What do you need from them?</Label>
              <textarea
                id="more-note"
                name="note"
                rows={4}
                maxLength={600}
                required
                placeholder="For example: the licence copy is hard to read. Please send a clearer photo."
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <p className="text-xs text-muted-foreground">Up to 600 characters. Do not put anything private here: it is shown on their page and sent by e-mail.</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={close}>
                Cancel
              </Button>
              <FormSubmit pendingText="Sending…">Ask them</FormSubmit>
            </DialogFooter>
          </ActionForm>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "decline"} onOpenChange={(o) => !o && close()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Decline this application</DialogTitle>
            <DialogDescription>
              Their private link stops working whichever you choose. They are sent a final e-mail first, saying what happens to their data; if that e-mail cannot be sent, nothing is changed or deleted.
            </DialogDescription>
          </DialogHeader>
          <ActionForm
            action={async (formData) => {
              await declinePartnerApplication(id, formData);
              // everything was deleted, so there is no page to stay on
              if (formData.get("handling") === "delete_all") router.replace("/partners");
            }}
            onSubmit={() => setAttempt((n) => n + 1)}
            loading="Declining…"
            success="Application declined."
            className="grid gap-4"
          >
            {/* What is submitted is this field, which always mirrors the choice on screen. (The radios below are only for choosing: a form action resets a form's radios to
                the state they first had, which after a refused attempt would otherwise submit one choice while showing another.) */}
            <input type="hidden" name="handling" value={handling} />
            <fieldset key={attempt} className="grid gap-2.5">
              <legend className="mb-1 text-sm font-medium">What happens to their data?</legend>
              {DECLINE_OPTIONS.map((o) => (
                <label key={o.id} className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm ${handling === o.id ? "border-ring bg-accent/40" : "border-border"}`}>
                  <input type="radio" name="handling-choice" value={o.id} checked={handling === o.id} onChange={() => setHandling(o.id)} className="mt-1" />
                  <span>
                    <span className="block font-medium">{o.label}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{o.admin}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">What the applicant is told:</span> {option.mail}
            </p>
            {handling === "delete_all" && (
              <div className="grid gap-2">
                <Label htmlFor="decline-confirm">Type the reference {reference ? <span className="font-mono">{reference}</span> : null} to confirm</Label>
                <Input id="decline-confirm" name="confirm" autoComplete="off" required placeholder={reference ?? ""} />
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={close}>
                Cancel
              </Button>
              <FormSubmit variant="destructive" pendingText="Declining…">
                {handling === "delete_all" ? "Decline and delete everything" : "Decline"}
              </FormSubmit>
            </DialogFooter>
          </ActionForm>
        </DialogContent>
      </Dialog>
    </div>
  );
}
