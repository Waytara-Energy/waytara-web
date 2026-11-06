import * as React from "react";

/** The numbered clauses (4.1, 4.2 ...) under a section: they are cited back by number, so each keeps its number in the margin. */
export function LegalSubList({ items }: { items: { n: string; text: React.ReactNode }[] }) {
  return (
    <ol className="space-y-4">
      {items.map((item) => (
        <li key={item.n} className="flex gap-4">
          <span className="w-9 shrink-0 font-semibold tabular-nums text-theme-primary">{item.n}</span>
          <span className="min-w-0">{item.text}</span>
        </li>
      ))}
    </ol>
  );
}

/** The clauses of a section, numbered from the section's own number (section 4 gives 4.1, 4.2, ...). */
export function LegalClauses({ section, items }: { section: number; items: React.ReactNode[] }) {
  return <LegalSubList items={items.map((text, i) => ({ n: `${section}.${i + 1}`, text }))} />;
}
