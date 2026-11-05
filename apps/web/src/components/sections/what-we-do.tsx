import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Reveal } from "@/components/shared/reveal";
import { SectionHeader } from "@/components/shared/section-header";
import { OFFERS } from "@/data/offers";

/**
 * Build, Charge, Manage: what WayTara does. Three frameless columns (a round icon badge, a bold title, a short description), the same look as
 * the pillars further down the page, and one link to the full solutions. The checklists live on the Solutions page.
 */
export function WhatWeDo() {
  return (
    <section id="what-we-do" className="section-padding bg-theme-bg scroll-mt-16">
      <div className="fluid-container">
        <Reveal direction="up" duration={700} distance={24}>
          <SectionHeader
            badge="What WayTara does"
            title="Build it. Charge it."
            accent="Manage it."
            summary="From building new energy systems to connecting and managing the ones you already have."
          />
        </Reveal>

        <div className="grid grid-cols-1 gap-10 md:grid-cols-3 lg:gap-12">
          {OFFERS.map(({ id, icon: Icon, title, body }, i) => (
            <Reveal key={id} direction="up" duration={650} distance={24} delay={i * 100}>
              <div className="group flex flex-col justify-start text-left">
                <div className="mb-4 flex size-10 items-center justify-center rounded-full border border-theme-border bg-theme-surface text-theme-primary transition-colors group-hover:border-emerald-500/30 group-hover:bg-emerald-500/10 group-hover:text-emerald-500 dark:group-hover:text-emerald-400">
                  <Icon className="size-5 stroke-[1.75]" aria-hidden="true" />
                </div>
                <h3 className="mb-2 text-base font-bold tracking-tight text-theme-primary sm:text-lg">{title}</h3>
                <p className="text-sm font-normal leading-relaxed text-theme-secondary sm:text-[15px]">{body}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal direction="up" duration={700} distance={16} delay={150}>
          {/* The dashboard card that follows slides up over the bottom of this section (its negative top margin), so this space is under the link, not behind the card. */}
          <div className="mt-12 pb-24 text-center md:pb-52">
            <Link
              href="/solutions"
              className="group inline-flex items-center gap-1.5 border-b border-theme-primary pb-0.5 text-sm font-semibold text-theme-primary transition-colors hover:border-theme-highlight hover:text-theme-highlight"
            >
              Discover our services
              <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
