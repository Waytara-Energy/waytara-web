import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Reveal } from "@/components/shared/reveal";
import { SectionHeader } from "@/components/shared/section-header";
import { FeatureColumns } from "@/components/segments/segment-parts";
import { OFFERS } from "@/data/offers";

const ROUTE_LINK = "group inline-flex items-center gap-1.5 text-sm font-semibold text-theme-highlight hover:underline underline-offset-4";

/**
 * Build, Charge, Manage: what WayTara does. The same blocks as the pages for each kind of property (a large thin icon, a bold title, one sentence, and
 * what it includes), then the two ways in, as two plain links.
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

        <FeatureColumns items={OFFERS.map(({ icon, title, blockBody, includes }) => ({ icon, title, body: blockBody, includes }))} />

        {/* The two ways in. (The extra space that used to sit under them was for the dashboard card that slid up over this section; that card has moved.) */}
        <Reveal direction="up" duration={700} distance={16} delay={100}>
          <div className="mx-auto mt-20 flex flex-col items-center gap-3 text-center md:flex-row md:flex-wrap md:justify-center md:gap-x-6">
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
