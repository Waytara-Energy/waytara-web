"use client";

import * as React from "react";
import { Globe, Loader2 } from "lucide-react";
import { notify } from "@waytara/ui/notify";
import { cn } from "@waytara/ui/cn";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { setPartnerListed } from "./actions";

/**
 * A globe that lists an approved partner in the public partner directory, or takes them out of it, in one click. Lit (green) while they are listed. The directory shows
 * only the business name, the kind of partner and the districts.
 */
export function ListingToggle({ id, listed }: { id: string; listed: boolean }) {
  const [pending, startTransition] = React.useTransition();
  const label = listed ? "Listed in the public partner directory. Click to remove." : "Not listed in the public partner directory. Click to list them.";

  function toggle() {
    startTransition(async () => {
      const promise = setPartnerListed(id, !listed);
      notify.promise(promise, { loading: "Saving…", success: listed ? "Removed from the public directory." : "Listed in the public directory.", error: (e) => (e instanceof Error ? e.message : "Couldn't save.") });
      await promise.catch(() => undefined);
    });
  }

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button type="button" variant="outline" size="icon" onClick={toggle} disabled={pending} aria-pressed={listed} aria-label={label} className={cn(listed && "border-emerald-500/50 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 hover:text-emerald-600 dark:text-emerald-400")}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Globe className="size-4" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-56 text-center">
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
