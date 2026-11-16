"use client";

import * as React from "react";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { notify } from "@waytara/ui/notify";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PARTNER_STATUS_LABEL } from "@/lib/partners";
import { changePartnerStatus } from "./actions";

const STAGES = [
  { id: "new", note: "Not looked at yet" },
  { id: "in_review", note: "Screening: call them and note what you find" },
  { id: "shortlisted", note: "Worth taking further" },
  { id: "onboarding", note: "Opens their forms and e-mails them" },
  { id: "verification", note: "Their details are in: check them" },
] as const;

const DOT: Record<string, string> = { new: "bg-sky-500", in_review: "bg-amber-500", shortlisted: "bg-amber-500", onboarding: "bg-amber-500", verification: "bg-amber-500", approved: "bg-emerald-500", rejected: "bg-zinc-400" };

/**
 * The stage of the application as a dropdown: the button shows where it is, the menu lists the stages to move it to, each with what it does. Approved and Declined are
 * not in the menu: they are the Approve and Decline buttons, which ask the right questions first.
 */
export function StatusMenu({ id, status }: { id: string; status: string }) {
  const [pending, startTransition] = React.useTransition();
  const finished = status === "approved" || status === "rejected";

  function choose(next: string) {
    if (next === status) return;
    startTransition(async () => {
      const promise = changePartnerStatus(id, next);
      notify.promise(promise, { loading: "Moving…", success: `Moved to ${PARTNER_STATUS_LABEL[next] ?? next}.`, error: (e) => (e instanceof Error ? e.message : "Couldn't move it.") });
      await promise.catch(() => undefined);
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2" disabled={pending} aria-label="Change stage">
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : <span className={`size-2 rounded-full ${DOT[status] ?? "bg-zinc-400"}`} aria-hidden="true" />}
          {PARTNER_STATUS_LABEL[status] ?? status}
          <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">{finished ? "Move it back to a stage" : "Move to"}</DropdownMenuLabel>
        {STAGES.map((s) => (
          <DropdownMenuItem key={s.id} onSelect={() => choose(s.id)} className="items-start gap-2">
            <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center">{status === s.id && <Check className="size-4" aria-hidden="true" />}</span>
            <span>
              <span className="block text-sm font-medium">{PARTNER_STATUS_LABEL[s.id]}</span>
              <span className="block text-xs text-muted-foreground">{s.note}</span>
            </span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <p className="px-2 py-1.5 text-xs text-muted-foreground">To approve or decline, use the buttons on the right.</p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
