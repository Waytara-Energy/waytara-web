import * as React from "react";

/** One numbered part of a long form: a number and title over the fields, with a hairline between parts. Used by the partner and contact forms. */
export function FormPart({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <fieldset className="border-t border-theme-border py-9 first:border-t-0 first:pt-0">
      <legend className="sr-only">{title}</legend>
      <div className="mb-6 flex items-baseline gap-3" aria-hidden="true">
        <span className="text-sm font-semibold tabular-nums text-theme-highlight">{String(n).padStart(2, "0")}</span>
        <h3 className="text-lg font-bold tracking-tight text-theme-primary sm:text-xl">{title}</h3>
        {hint && <span className="text-sm text-theme-muted">{hint}</span>}
      </div>
      {children}
    </fieldset>
  );
}
