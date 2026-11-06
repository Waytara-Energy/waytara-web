import * as React from "react";

/** A plain bulleted list for the legal pages. */
export function LegalList({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span aria-hidden="true" className="mt-[0.62em] size-1.5 shrink-0 rounded-full bg-emerald-500" />
          <span className="min-w-0">{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** Bold lead-in text inside a legal paragraph or list item. */
export function Strong({ children }: { children: React.ReactNode }) {
  return <span className="font-semibold text-theme-primary">{children}</span>;
}
