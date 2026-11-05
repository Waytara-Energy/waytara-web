"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Search } from "lucide-react";
import { QUICK_LINKS, searchSite, type SearchEntry } from "@/lib/site-search";
import Link from "next/link";

/**
 * The search panel (the Apple pattern): a large search box, then Quick Links before anything is typed, or the matching pages and sections while
 * typing. Enter opens the first match; Escape is handled by the header and closes the panel.
 */
export function SearchPanel({ onNavigate }: { onNavigate: () => void }) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const results = React.useMemo(() => searchSite(query), [query]);
  const typing = query.trim().length > 0;

  React.useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, []);

  const rows: SearchEntry[] = typing ? results : QUICK_LINKS;

  return (
    <div className="mx-auto w-full max-w-5xl px-6 pb-12 pt-9 sm:px-10">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          const first = rows[0];
          if (first && typing) {
            onNavigate();
            router.push(first.href);
          }
        }}
        className="mega-item flex items-center gap-3"
      >
        <Search className="size-6 shrink-0 text-theme-muted" aria-hidden="true" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search WayTara"
          aria-label="Search WayTara"
          autoComplete="off"
          className="w-full bg-transparent text-[clamp(1.35rem,2vw,1.75rem)] font-semibold tracking-tight text-theme-primary outline-none placeholder:text-theme-muted"
        />
      </form>

      <p className="mega-item mt-9 text-xs text-theme-muted" style={{ animationDelay: "40ms" }}>
        {typing ? (results.length ? "Results" : "No results") : "Quick Links"}
      </p>
      {typing && results.length === 0 ? (
        <p className="mt-3 text-sm text-theme-secondary">
          Nothing matches &ldquo;{query.trim()}&rdquo;. Try a page name, or{" "}
          <Link href="/support" onClick={onNavigate} className="font-semibold text-theme-highlight underline-offset-4 hover:underline">
            ask our support team
          </Link>
          .
        </p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {rows.map((r, i) => (
            <li key={r.href + r.title} className="mega-item" style={{ animationDelay: `${70 + i * 28}ms` }}>
              <Link
                href={r.href}
                onClick={onNavigate}
                className="group flex items-center gap-3 rounded-md py-1.5 text-sm font-semibold text-theme-primary outline-none transition-colors hover:text-theme-highlight focus-visible:text-theme-highlight"
              >
                <ArrowRight className="size-3.5 shrink-0 text-theme-muted transition-colors group-hover:text-theme-highlight" aria-hidden="true" />
                <span>{r.title}</span>
                <span className="text-xs font-normal text-theme-muted">{r.group}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
