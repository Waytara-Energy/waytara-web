"use client";

import * as React from "react";
import { MoreHorizontal } from "lucide-react";
import { ActionForm } from "@waytara/ui/action-form";
import { FormSubmit } from "@/components/form-submit";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { changeEmployeeRole, permanentlyDeleteEmployee, restoreEmployeeAccess, revokeEmployeeAccess } from "./actions";

type Dialogs = "role" | "revoke" | "restore" | "delete" | null;

/**
 * What an admin can do to one staff account, from a menu on its row: change the role, revoke or restore access, or delete it for good. Each opens a small
 * dialog that says what it will do before it does it (and stays open while the action runs, so its result is shown).
 */
export function StaffActions({ profileId, name, role, revoked }: { profileId: string; name: string; role: string; revoked: boolean }) {
  const [dialog, setDialog] = React.useState<Dialogs>(null);
  const close = () => setDialog(null);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${name}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onSelect={() => setDialog("role")}>Change role…</DropdownMenuItem>
          {revoked ? <DropdownMenuItem onSelect={() => setDialog("restore")}>Restore access…</DropdownMenuItem> : <DropdownMenuItem onSelect={() => setDialog("revoke")}>Revoke access…</DropdownMenuItem>}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setDialog("delete")}>
            Delete permanently…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialog === "role"} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change role</DialogTitle>
            <DialogDescription>What {name} can see and do depends on their role. It takes effect the next time they open a page.</DialogDescription>
          </DialogHeader>
          <ActionForm action={changeEmployeeRole.bind(null, profileId)} loading="Updating role…" success="Role updated." className="grid gap-4">
            <div className="grid gap-2">
              <Label>Role</Label>
              <Select name="role" defaultValue={role}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="site_engineer">Site engineer</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={close}>
                Cancel
              </Button>
              <FormSubmit pendingText="Saving…">Save role</FormSubmit>
            </DialogFooter>
          </ActionForm>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "revoke"} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke access</DialogTitle>
            <DialogDescription>{name} can no longer sign in. Their account and everything they did stay as they are, and you can restore access later.</DialogDescription>
          </DialogHeader>
          <ActionForm action={revokeEmployeeAccess.bind(null, profileId)} loading="Revoking access…" success="Access revoked. They can no longer sign in.">
            <DialogFooter>
              <Button type="button" variant="outline" onClick={close}>
                Cancel
              </Button>
              <FormSubmit variant="destructive" pendingText="Revoking…">
                Revoke access
              </FormSubmit>
            </DialogFooter>
          </ActionForm>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "restore"} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore access</DialogTitle>
            <DialogDescription>{name} can sign in again with the same role as before.</DialogDescription>
          </DialogHeader>
          <ActionForm action={restoreEmployeeAccess.bind(null, profileId)} loading="Restoring access…" success="Access restored.">
            <DialogFooter>
              <Button type="button" variant="outline" onClick={close}>
                Cancel
              </Button>
              <FormSubmit pendingText="Restoring…">Restore access</FormSubmit>
            </DialogFooter>
          </ActionForm>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "delete"} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete permanently</DialogTitle>
            <DialogDescription>
              This blocks {name} from ever signing in again and cannot be undone. Their leads, quotations, audit log entries and invites stay exactly as they are. Choose the name those records show from now on.
            </DialogDescription>
          </DialogHeader>
          <ActionForm action={permanentlyDeleteEmployee.bind(null, profileId)} loading="Deleting account…" success="Account permanently deleted." className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor={`display-${profileId}`}>Name to show on their records</Label>
              <Input id={`display-${profileId}`} name="displayName" defaultValue={name} required />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={close}>
                Cancel
              </Button>
              <FormSubmit variant="destructive" pendingText="Deleting…">
                Delete permanently
              </FormSubmit>
            </DialogFooter>
          </ActionForm>
        </DialogContent>
      </Dialog>
    </>
  );
}
