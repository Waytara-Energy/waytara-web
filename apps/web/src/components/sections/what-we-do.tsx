import Link from "next/link";
import { ArrowRight, CircleCheck } from "lucide-react";
import { Reveal } from "@/components/shared/reveal";
import { SectionHeader } from "@/components/shared/section-header";
import { OFFERS } from "@/data/offers";

const ROUTE_LINK = "group inline-flex items-center gap-1.5 text-sm font-semibold text-theme-highlight hover:underline underline-offset-4";

/**
 * Build, Charge, Manage: what WayTara does. Three frameless columns in the same look as the pillars further down the page (a round icon badge, a
 * bold title, a short description), each with what it includes, then the two ways in, as two plain links.
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

        <div className="grid grid-cols-1 gap-12 md:grid-cols-3 lg:gap-12">
          {OFFERS.map(({ id, icon: Icon, title, body, includes }, i) => (
            <Reveal key={id} direction="up" duration={650} distance={24} delay={i * 100}>
              <div className="group flex flex-col justify-start text-left">
                <div className="mb-4">
                  <div className="flex size-10 items-center justify-center rounded-full border border-theme-border bg-theme-surface text-theme-primary transition-colors group-hover:border-emerald-500/30 group-hover:bg-emerald-500/10 group-hover:text-emerald-500 dark:group-hover:text-emerald-400">
                    <Icon className="size-5 stroke-[1.75]" aria-hidden="true" />
                  </div>
                </div>
                <h3 className="mb-2 text-base font-bold tracking-tight text-theme-primary sm:text-lg">{title}</h3>
                <p className="text-sm font-normal leading-relaxed text-theme-secondary sm:text-[15px]">{body}</p>
                <ul className="mt-5 space-y-2.5 border-t border-theme-border pt-5">
                  {includes.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-theme-secondary">
                      <CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>

        {/* The two ways in. The dashboard card that follows slides up over the bottom of this section (its negative top margin), so the space under them is deliberate. */}
        <Reveal direction="up" duration={700} distance={16} delay={100}>
          <div className="mx-auto mt-14 flex flex-col items-center gap-3 pb-24 text-center md:flex-row md:flex-wrap md:justify-center md:gap-x-6 md:pb-52">
            <p className="text-sm">
              <Link href="/planner" className={ROUTE_LINK}>
                Plan a new system
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
            </p>
            <span className="hidden h-4 w-px bg-theme-border md:block" aria-hidden="true" />
            <p className="text-sm">
              <Link href="/technology#compatibility" className={ROUTE_LINK}>
                Connect what I already have
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
