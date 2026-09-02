import * as React from "react";
import { AlertTriangle } from "lucide-react";

// The boxed "Important:" notices legal pages use to call out
// consequences (e.g. what voids a warranty, what gets an account
// terminated) — pulled out since several sections across all four pages
// use the same treatment.
export function LegalCallout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-xl border border-theme-alert/30 bg-theme-alert-subtle px-4 py-3 text-sm text-theme-primary">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-theme-alert" />
      <div>{children}</div>
    </div>
  );
}
