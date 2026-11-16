"use client";

import * as React from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { notify } from "@waytara/ui/notify";
import { Button } from "@/components/ui/button";
import { revealPartnerBankAccount } from "./actions";

/**
 * The bank account number with all but its last four digits hidden. "Show" fetches the full number for this admin (each use is written to the access log first) and
 * hides it again after a minute, or when "Hide" is pressed. The full number is never in the page until it is asked for.
 */
export function BankReveal({ appId, masked }: { appId: string; masked: string }) {
  const [full, setFull] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (!full) return;
    const t = setTimeout(() => setFull(null), 60_000);
    return () => clearTimeout(t);
  }, [full]);

  function show() {
    startTransition(async () => {
      try {
        setFull(await revealPartnerBankAccount(appId));
      } catch (e) {
        notify.error(e instanceof Error ? e.message : "The number couldn't be shown.");
      }
    });
  }

  return (
    <span className="inline-flex items-center gap-2">
      <span className="font-mono tabular-nums">{full ?? masked}</span>
      <Button type="button" variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs text-muted-foreground" disabled={pending} onClick={() => (full ? setFull(null) : show())}>
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : full ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
        {full ? "Hide" : "Show"}
      </Button>
    </span>
  );
}
