"use client";

import { AlertTriangle, CheckCircle2, Info, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** What the page knows about one of the partner's checks (the website's own shape; see PartnerCheckView on the server). */
export interface CheckView {
  kind: string;
  status: "passed" | "review" | "failed" | "error";
  message: string;
  asksLeft: number;
  current: boolean;
}

const STYLE = {
  passed: { Icon: CheckCircle2, tone: "text-emerald-700 dark:text-emerald-300" },
  review: { Icon: AlertTriangle, tone: "text-amber-700 dark:text-amber-300" },
  failed: { Icon: XCircle, tone: "text-red-700 dark:text-red-300" },
  error: { Icon: Info, tone: "text-theme-muted" },
} as const;

/**
 * A button that checks one number or account with the official sources, and the plain line it comes back with. It shows nothing once the number has been changed since
 * (the old answer is for the old number), and tells the partner how many checks they have left. Nothing is required of it: the team checks everything again anyway.
 */
export function VerifyCheck({ label, view, ready, running, onAsk, className }: { label: string; view: CheckView | undefined; ready: boolean; running: boolean; onAsk: () => void; className?: string }) {
  const shown = view && view.current ? view : undefined;
  const usedUp = view !== undefined && view.asksLeft === 0;
  const S = shown ? STYLE[shown.status] : null;
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" size="sm" variant="outline" disabled={!ready || running || usedUp} onClick={onAsk}>
          {running ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
          {running ? "Checking…" : label}
        </Button>
        {!ready && <span className="text-xs text-theme-muted">Fill in the details above first.</span>}
        {view && view.asksLeft > 0 && view.asksLeft < 3 && <span className="text-xs text-theme-muted">{view.asksLeft === 1 ? "1 check left" : `${view.asksLeft} checks left`}</span>}
      </div>
      {S && shown && (
        <p role="status" className={cn("flex items-start gap-2 text-sm leading-relaxed", S.tone)}>
          <S.Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{shown.message}</span>
        </p>
      )}
      {usedUp && shown?.status !== "passed" && <p className="text-xs text-theme-muted">You have used your checks for this. Our team will look at it when you send your application.</p>}
    </div>
  );
}
