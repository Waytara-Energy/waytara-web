"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface LegalTocEntry {
  id: string;
  label: string;
}

// Sticky "On this page" nav with scroll-spy — highlights whichever
// section is currently in view via IntersectionObserver rather than
// tracking scroll position by hand. Falls back to plain anchor links
// (with the root layout's global smooth-scroll) if JS hasn't hydrated
// yet, so the page is still fully navigable either way.
export function LegalToc({ entries }: { entries: LegalTocEntry[] }) {
  const [activeId, setActiveId] = React.useState(entries[0]?.id);

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (observedEntries) => {
        const visible = observedEntries.filter((e) => e.isIntersecting);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: "-15% 0px -70% 0px", threshold: 0 }
    );

    entries.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [entries]);

  return (
    <nav aria-label="Sections on this page" className="space-y-1">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-theme-muted">On this page</p>
      <ul className="space-y-0.5 border-l border-theme-border">
        {entries.map((entry, i) => (
          <li key={entry.id}>
            <a
              href={`#${entry.id}`}
              className={cn(
                "block -ml-px border-l-2 py-1.5 pl-4 text-sm transition-colors",
                activeId === entry.id
                  ? "border-theme-highlight font-medium text-theme-highlight"
                  : "border-transparent text-theme-muted hover:text-theme-primary"
              )}
            >
              {i + 1}. {entry.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
