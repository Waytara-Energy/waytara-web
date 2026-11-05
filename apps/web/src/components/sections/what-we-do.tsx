import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Reveal } from "@/components/shared/reveal";
import { SectionHeader } from "@/components/shared/section-header";
import { OFFERS } from "@/data/offers";
import { cn } from "@/lib/utils";

const ROUTE_LINK = "group inline-flex items-center gap-1.5 text-sm font-semibold text-theme-highlight hover:underline underline-offset-4";

/** Build, Charge, Manage: what WayTara does, with the two ways in (a new system, or the equipment you already have). */
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

        <Reveal direction="up" duration={800} distance={24}>
          <ul className="grid grid-cols-1 overflow-hidden rounded-2xl border border-theme-border bg-theme-surface md:grid-cols-3">
            {OFFERS.map(({ icon: Icon, tag, title, body, includes }, i) => (
              <li key={title} className={cn("flex flex-col px-7 py-8 sm:px-8", i > 0 && "border-t border-theme-border md:border-l md:border-t-0")}>
                <div className="flex items-center justify-between">
                  <Icon className="size-6 stroke-[1.5] text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-theme-muted">{tag}</span>
                </div>
                <h3 className="mt-6 text-lg font-semibold text-theme-primary">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-theme-secondary">{body}</p>
                <ul className="mt-6 space-y-2.5 border-t border-theme-border pt-5">
                  {includes.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-theme-secondary">
                      <Check className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </Reveal>

        {/* The two ways in */}
        <Reveal direction="up" duration={700} distance={16} delay={100}>
          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-10">
            <p className="text-sm text-theme-secondary">
              <span className="font-semibold text-theme-primary">Planning a new installation? </span>
              <Link href="/planner" className={ROUTE_LINK}>
                Plan a new system
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
            </p>
            <p className="text-sm text-theme-secondary">
              <span className="font-semibold text-theme-primary">Already have an energy system? </span>
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
