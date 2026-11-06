import * as React from "react";

/** A point to read twice (what is not covered, what ends an account): a short rule down the left and the text in full-strength ink, no box. */
export function LegalCallout({ children }: { children: React.ReactNode }) {
  return <div className="border-l-2 border-emerald-500/70 py-1 pl-5 text-theme-primary">{children}</div>;
}
