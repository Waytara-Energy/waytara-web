import * as React from "react";
import Link from "next/link";
import { ArrowRight, CircleCheck } from "lucide-react";
import { PageHero, PageShell } from "@/components/pages/page-shell";
import { LegalToc, type LegalTocEntry } from "./legal-toc";

export interface LegalSection {
  id: string;
  heading: string;
  /** The text of the section; a function receives the section's number, for numbering its clauses. */
  body: React.ReactNode | ((sectionNumber: number) => React.ReactNode);
}

interface LegalPageLayoutProps {
  /** For the breadcrumb and the search-engine data. */
  name: string;
  path: string;
  title: string;
  accent: string;
  intro: string;
  lastUpdated: string;
  /** Three to five plain sentences: what this page comes down to. */
  inShort: string[];
  sections: LegalSection[];
}

const LEGAL_PAGES = [
  { label: "Terms of Service", href: "/terms" },
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Cookie Policy", href: "/cookies" },
  { label: "Warranty Policy", href: "/warranty" },
];

/**
 * The shell of the four legal pages (Terms, Privacy, Cookies, Warranty), in the same style as the rest of the site: the page hero, a short plain summary, then
 * the numbered sections with a contents list that follows you down the page, and links to the other three pages at the end.
 */
export function LegalPageLayout({ name, path, title, accent, intro, lastUpdated, inShort, sections }: LegalPageLayoutProps) {
  const tocEntries: LegalTocEntry[] = sections.map((s) => ({ id: s.id, label: s.heading }));

  return (
    <PageShell
      name={name}
      path={path}
      hero={<PageHero eyebrow="Legal" title={title} accent={accent} body={`${intro} Last updated ${lastUpdated}.`} />}
    >
      <section className="pb-6">
        <div className="fluid-container">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold text-theme-muted">In short</p>
            <ul className="mt-4 space-y-3">
              {inShort.map((line) => (
                <li key={line} className="flex items-start gap-3 text-base leading-relaxed text-theme-primary">
                  <CircleCheck className="mt-1 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <p className="mt-5 text-sm leading-relaxed text-theme-muted">This summary is only a guide. The full text below is what applies.</p>
          </div>
        </div>
      </section>

      <section className="pb-24 pt-10">
        <div className="fluid-container grid grid-cols-1 gap-12 lg:grid-cols-[240px_1fr] lg:gap-16">
          <aside className="hidden lg:block">
            <div className="sticky top-28">
              <LegalToc entries={tocEntries} />
            </div>
          </aside>

          <div className="min-w-0 max-w-3xl">
            {sections.map((section, i) => (
              <section key={section.id} id={section.id} className="scroll-mt-28 border-t border-theme-border py-10 first:border-t-0 first:pt-0">
                <h2 className="flex items-baseline gap-3 text-[clamp(1.35rem,2vw,1.75rem)] font-bold leading-tight tracking-tight text-theme-primary">
                  <span className="text-sm font-semibold tabular-nums text-theme-highlight">{String(i + 1).padStart(2, "0")}</span>
                  {section.heading}
                </h2>
                <div className="mt-5 space-y-4 text-[15px] leading-relaxed text-theme-secondary sm:text-base">{typeof section.body === "function" ? section.body(i + 1) : section.body}</div>
              </section>
            ))}

            <div className="border-t border-theme-border pt-10">
              <p className="text-sm font-semibold text-theme-muted">Also read</p>
              <ul className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
                {LEGAL_PAGES.filter((p) => p.href !== path).map((p) => (
                  <li key={p.href}>
                    <Link href={p.href} className="group inline-flex items-center gap-1.5 text-sm font-semibold text-theme-highlight underline-offset-4 hover:underline">
                      {p.label}
                      <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
