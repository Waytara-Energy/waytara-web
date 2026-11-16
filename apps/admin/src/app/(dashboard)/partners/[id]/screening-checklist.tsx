"use client";

import * as React from "react";
import { Check, Send } from "lucide-react";
import { ActionForm } from "@waytara/ui/action-form";
import { cn } from "@waytara/ui/cn";
import type { ScreeningItem } from "@waytara/supabase/partner-verification";
import { FormSubmit } from "@/components/form-submit";
import { Input } from "@/components/ui/input";
import { changePartnerStatus, saveScreeningChecklist } from "./actions";

export interface ScreeningSaved {
  ticked: boolean;
  note: string;
  /** "Asha, 16 Nov 2026, 3:05 pm" once someone has set it. */
  by: string;
}

/**
 * The checklist for the screening call: tick each thing as you confirm it, with a note beside it (the licence number they read out, who their contractor is), and
 * save. Once every required item is saved as ticked, the onboarding link can be sent: that moves the application to Onboarding and e-mails them.
 */
export function ScreeningChecklist({ appId, items, saved, canSend, sendHint }: { appId: string; items: ScreeningItem[]; saved: Record<string, ScreeningSaved>; canSend: boolean; sendHint: string }) {
  const [ticks, setTicks] = React.useState<Record<string, boolean>>(() => Object.fromEntries(items.map((i) => [i.key, saved[i.key]?.ticked ?? false])));
  const done = items.filter((i) => ticks[i.key]).length;
  const dirty = items.some((i) => ticks[i.key] !== (saved[i.key]?.ticked ?? false));
  const savedOpen = items.filter((i) => i.required && !saved[i.key]?.ticked).length;

  return (
    <div className="space-y-4">
      {/* keyed by what is saved, so the notes show the saved values after a save (a form action resets its fields to their first values) */}
      <ActionForm key={JSON.stringify(saved)} action={saveScreeningChecklist.bind(null, appId)} loading="Saving…" success="Checklist saved." className="space-y-3">
        <ul className="divide-y divide-border rounded-lg border border-border">
          {items.map((i) => {
            const on = ticks[i.key];
            return (
              <li key={i.key} className="grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,18rem)] sm:items-center">
                <div className="flex items-start gap-3">
                  {/* what is submitted: a form action resets real checkboxes to their first state, so the tick lives in state and is mirrored here */}
                  <input type="hidden" name={`tick_${i.key}`} value={on ? "on" : "off"} />
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    aria-label={i.label}
                    onClick={() => setTicks((t) => ({ ...t, [i.key]: !t[i.key] }))}
                    className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring", on ? "border-emerald-600 bg-emerald-600 text-white" : "border-input bg-background")}
                  >
                    {on && <Check className="size-3.5" aria-hidden="true" />}
                  </button>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {i.label}
                      {!i.required && <span className="ml-2 text-xs font-normal text-muted-foreground">optional</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">{i.hint}</p>
                    {saved[i.key]?.by && <p className="mt-1 text-[11px] text-muted-foreground">Last set by {saved[i.key].by}</p>}
                  </div>
                </div>
                <Input name={`note_${i.key}`} defaultValue={saved[i.key]?.note ?? ""} maxLength={500} placeholder="Note" aria-label={`${i.label}: note`} />
              </li>
            );
          })}
        </ul>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {done} of {items.length} ticked{dirty ? " · not saved yet" : ""}
          </p>
          <FormSubmit size="sm" variant="outline" pendingText="Saving…">
            Save checklist
          </FormSubmit>
        </div>
      </ActionForm>

      {canSend && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 p-3">
          <div className="min-w-0 max-w-xl">
            <p className="text-sm font-medium">Screening done? Send the onboarding link</p>
            <p className="text-xs text-muted-foreground">{savedOpen > 0 || dirty ? (dirty ? "Save the checklist first." : `${savedOpen} required item${savedOpen === 1 ? "" : "s"} still to tick and save.`) : sendHint}</p>
          </div>
          <ActionForm action={changePartnerStatus.bind(null, appId, "onboarding")} loading="Sending…" success="Moved to Onboarding. The link was e-mailed.">
            <FormSubmit size="sm" disabled={savedOpen > 0 || dirty} pendingText="Sending…">
              <Send className="size-4" /> Send the onboarding link
            </FormSubmit>
          </ActionForm>
        </div>
      )}
    </div>
  );
}
