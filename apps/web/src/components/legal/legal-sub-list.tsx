import * as React from "react";

// The "5.1 / 5.2 / 5.3 ..." sub-numbered clauses that show up under a few
// sections (Payment Terms, Warranty coverage, etc.) — a plain bullet list
// reads worse for clauses people cite back by number.
export function LegalSubList({ items }: { items: { n: string; text: React.ReactNode }[] }) {
  return (
    <ol className="space-y-2">
      {items.map((item) => (
        <li key={item.n} className="flex gap-2.5">
          <span className="shrink-0 font-medium text-theme-primary">{item.n}</span>
          <span>{item.text}</span>
        </li>
      ))}
    </ol>
  );
}
