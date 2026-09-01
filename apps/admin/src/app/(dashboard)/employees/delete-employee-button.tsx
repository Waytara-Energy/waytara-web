"use client";

import * as React from "react";
import { Button } from "@waytara/ui/button";
import { Input } from "@waytara/ui/input";
import { permanentlyDeleteEmployee } from "./actions";

/**
 * Permanent delete is irreversible, so it gets its own confirm step rather
 * than a bare button — same spirit as GitHub's "type the repo name to
 * confirm" pattern, scaled to this app's size: an inline reveal explaining
 * what happens, with the ghost's future display name pre-filled and
 * editable right there rather than a separate screen.
 */
export function DeleteEmployeeButton({ profileId, currentName }: { profileId: string; currentName: string }) {
  const [confirming, setConfirming] = React.useState(false);

  if (!confirming) {
    return (
      <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(true)}>
        Delete permanently
      </Button>
    );
  }

  return (
    <div className="w-full rounded-md border border-destructive/40 bg-destructive/5 p-3 text-left">
      <p className="text-xs text-destructive">
        This permanently blocks {currentName} from ever signing in again. Their leads, quotations,
        audit log entries, and invites stay exactly as they are — pick what name those records show
        from now on:
      </p>
      <form action={permanentlyDeleteEmployee.bind(null, profileId)} className="mt-2 flex items-center gap-2">
        <Input name="displayName" defaultValue={currentName} className="h-8 text-xs" required />
        <Button type="submit" variant="destructive" size="sm">
          Confirm delete
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setConfirming(false)}>
          Cancel
        </Button>
      </form>
    </div>
  );
}
