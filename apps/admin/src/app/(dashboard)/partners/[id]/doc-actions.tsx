"use client";

import * as React from "react";
import { Download, Eye, MessageSquareWarning, MoreHorizontal } from "lucide-react";
import { ActionForm } from "@waytara/ui/action-form";
import { FormSubmit } from "@/components/form-submit";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { requestMorePartnerInfo } from "./actions";

/**
 * What an admin can do with one file: view it, download it (each is logged before the file is served), and, while the application is in Onboarding or Verification,
 * ask the partner for a better copy. Asking sends the application back to Onboarding with everything kept, and e-mails them the words in the box.
 */
export function DocActions({ appId, docId, fileName, kindLabel, canAsk }: { appId: string; docId: string; fileName: string; kindLabel: string; canAsk: boolean }) {
  const [open, setOpen] = React.useState(false);
  const href = `/partners/${appId}/files/${docId}`;
  return (
    <>
      <Button asChild variant="ghost" size="icon" className="size-8 text-muted-foreground">
        {/* plain links, not the router: each one is a view or download that the server logs before it serves the file */}
        <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`View ${fileName}`} title="View">
          <Eye className="size-4" />
        </a>
      </Button>
      <Button asChild variant="ghost" size="icon" className="size-8 text-muted-foreground">
        <a href={`${href}?download=1`} aria-label={`Download ${fileName}`} title="Download">
          <Download className="size-4" />
        </a>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8 text-muted-foreground" aria-label={`More for ${fileName}`}>
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem asChild>
            <a href={href} target="_blank" rel="noopener noreferrer">
              <Eye className="size-4" /> View in a new tab
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href={`${href}?download=1`}>
              <Download className="size-4" /> Download
            </a>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={!canAsk} onSelect={() => setOpen(true)}>
            <MessageSquareWarning className="size-4" /> Ask for a better copy…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ask for a better copy</DialogTitle>
            <DialogDescription>The application goes back to Onboarding with everything they sent kept. They are e-mailed your words below, and the same words show on their page.</DialogDescription>
          </DialogHeader>
          <ActionForm
            action={async (formData) => {
              await requestMorePartnerInfo(appId, formData);
              setOpen(false);
            }}
            loading="Sending…"
            success="They have been asked, by e-mail."
            className="grid gap-4"
          >
            <div className="grid gap-2">
              <Label htmlFor={`ask-${docId}`}>What do you need?</Label>
              <Textarea id={`ask-${docId}`} name="note" rows={4} maxLength={600} required defaultValue={`${kindLabel} (${fileName}): the copy is not clear enough to check. Please remove it and send a clearer one.`} />
              <p className="text-xs text-muted-foreground">Up to 600 characters. Do not put anything private here: it is shown on their page and sent by e-mail.</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <FormSubmit pendingText="Sending…">Ask them</FormSubmit>
            </DialogFooter>
          </ActionForm>
        </DialogContent>
      </Dialog>
    </>
  );
}
