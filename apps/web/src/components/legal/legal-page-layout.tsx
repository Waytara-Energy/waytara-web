import * as React from "react";
import { Navigation } from "@/components/sections/navigation";
import { Footer } from "@/components/sections/footer";
import { LegalToc, type LegalTocEntry } from "./legal-toc";

export interface LegalSection {
  id: string;
  heading: string;
  body: React.ReactNode;
}

interface LegalPageLayoutProps {
  title: string;
  subtitle: string;
  lastUpdated: string;
  sections: LegalSection[];
}

// Shared shell for the four legal pages (Terms, Privacy, Cookies,
// Warranty) — a hero header, then a sticky "on this page" TOC alongside
// numbered sections, matching the layout pattern common to SaaS legal
// pages (title/subtitle/last-updated hero, left nav + right content).
export function LegalPageLayout({ title, subtitle, lastUpdated, sections }: LegalPageLayoutProps) {
  const tocEntries: LegalTocEntry[] = sections.map((s) => ({ id: s.id, label: s.heading }));

  return (
    <div className="flex min-h-screen flex-col bg-theme-bg text-theme-primary">
      <Navigation />

      <main className="flex-1 pt-28">
        <div className="fluid-container max-w-5xl pb-8">
          <h1 className="text-3xl font-bold tracking-tight text-theme-primary sm:text-4xl">{title}</h1>
          <p className="mt-3 max-w-2xl text-base text-theme-secondary">{subtitle}</p>
          <p className="mt-4 text-xs text-theme-muted">Last updated: {lastUpdated}</p>
        </div>

        <div className="fluid-container max-w-5xl grid grid-cols-1 gap-10 border-t border-theme-border py-10 lg:grid-cols-[220px_1fr]">
          <aside className="hidden lg:block">
            <div className="sticky top-28">
              <LegalToc entries={tocEntries} />
            </div>
          </aside>

          <div className="min-w-0 space-y-12">
            {sections.map((section, i) => (
              <section key={section.id} id={section.id} className="scroll-mt-28">
                <h2 className="text-xl font-semibold text-theme-primary">
                  {i + 1}. {section.heading}
                </h2>
                <div className="mt-3 space-y-3 text-sm leading-relaxed text-theme-secondary">
                  {section.body}
                </div>
              </section>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
