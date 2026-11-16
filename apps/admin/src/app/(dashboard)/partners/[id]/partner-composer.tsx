"use client";

import { Lock } from "lucide-react";
import { ActionForm } from "@waytara/ui/action-form";
import { FormSubmit } from "@/components/form-submit";
import { postPartnerNote } from "./actions";

/**
 * The box under the activity timeline, like the reply box in Support: write a note the applicant sees on their page (it replaces the last one), or tick Internal note to
 * leave one only the admins see. Nothing is e-mailed from here: it is a note, not a message; to ask for something use Ask for more.
 */
export function PartnerComposer({ id }: { id: string }) {
  return (
    <ActionForm action={postPartnerNote.bind(null, id)} loading="Saving…" success="Saved." className="sticky bottom-0 z-10 rounded-xl border bg-card p-3 shadow-sm">
      <textarea
        name="text"
        rows={3}
        required
        maxLength={2000}
        aria-label="Note"
        placeholder="Write a note for the applicant (up to 600 characters), or tick Internal note…"
        className="w-full resize-y rounded-md bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" name="internal" className="size-3.5" />
          <Lock className="size-3.5" aria-hidden="true" /> Internal note (the applicant does not see it)
        </label>
        <FormSubmit size="sm" pendingText="Saving…">
          Save note
        </FormSubmit>
      </div>
    </ActionForm>
  );
}
