"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ArticleCard } from "@/data/blog";

/** The articles with a topic filter and a search box (all on the page, no reload). */
export function BlogList({ articles, categories }: { articles: ArticleCard[]; categories: readonly string[] }) {
  const [topic, setTopic] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return articles.filter((a) => (!topic || a.category === topic) && (!needle || `${a.title} ${a.excerpt} ${a.category}`.toLowerCase().includes(needle)));
  }, [articles, topic, q]);
  const count = (c: string) => articles.filter((a) => a.category === c).length;
  const chip = (on: boolean) =>
    cn("inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors", on ? "border-emerald-600 bg-emerald-600 text-white" : "border-theme-border text-theme-secondary hover:bg-theme-surface");

  return (
    <div>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by topic">
          <button type="button" aria-pressed={topic === null} onClick={() => setTopic(null)} className={chip(topic === null)}>
            All <span className="opacity-70">{articles.length}</span>
          </button>
          {categories.map((c) => (
            <button key={c} type="button" aria-pressed={topic === c} onClick={() => setTopic(topic === c ? null : c)} className={chip(topic === c)}>
              {c} <span className="opacity-70">{count(c)}</span>
            </button>
          ))}
        </div>
        <label className="relative block w-full lg:w-72">
          <span className="sr-only">Search the articles</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-theme-muted" aria-hidden="true" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search the articles"
            className="h-11 w-full rounded-full border border-theme-border bg-transparent pl-10 pr-4 text-sm text-theme-primary outline-none placeholder:text-theme-muted focus-visible:ring-2 focus-visible:ring-emerald-500"
          />
        </label>
      </div>

      {shown.length === 0 ? (
        <p className="mt-12 text-theme-secondary">No article matches that. Try another word, or clear the topic.</p>
      ) : (
        <ul className="mt-10 grid grid-cols-1 gap-x-12 gap-y-10 md:grid-cols-2 lg:grid-cols-3">
          {shown.map((a) => (
            <li key={a.slug} className="border-t border-theme-border pt-6">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-400">
                {a.category} · {a.minutes} min read
              </p>
              <h3 className="mt-3 text-lg font-bold leading-snug tracking-tight text-theme-primary">
                <Link href={a.path} className="hover:underline">
                  {a.title}
                </Link>
              </h3>
              <p className="mt-2 text-pretty text-[15px] leading-relaxed text-theme-secondary">{a.excerpt}</p>
              <div className="mt-4 flex items-center justify-between gap-4">
                <span className="text-sm text-theme-muted">{a.dateLabel}</span>
                <Link href={a.path} className="group inline-flex items-center gap-1.5 text-sm font-semibold text-theme-highlight underline-offset-4 hover:underline">
                  Read
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
