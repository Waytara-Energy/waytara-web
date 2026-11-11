import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Reveal } from "@/components/shared/reveal";
import { SectionBadge } from "@/components/shared/section-header";
import { FeatureColumns } from "@/components/segments/segment-parts";
import { DOORS } from "@/components/sections/where-to-start";

/** The closing section of the landing page: the three ways in (build, charge, manage), then one main action (the planner) and a quieter way to reach a person. */
export function FinalCTA() {
  return (
    <section id="where-to-start" className="section-padding bg-theme-bg relative overflow-hidden scroll-mt-16">
      {/* Soft ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-br from-emerald-500/15 via-teal-500/8 to-transparent rounded-full blur-3xl pointer-events-none -z-10" />

      <div className="fluid-container relative">
        <div className="mx-auto max-w-4xl text-center">
          <Reveal direction="up" delay={50} duration={600}>
            <div className="mb-6 flex justify-center">
              <SectionBadge>Get started</SectionBadge>
            </div>
          </Reveal>

          <Reveal direction="up" delay={120} duration={700}>
            <h2 className="text-[clamp(2.2rem,4.2vw,3.8rem)] font-bold tracking-tight text-theme-primary leading-[1.15] mb-5">
              <span className="block">Ready to run your energy</span>
              <span className="block text-primary-gradient">as one system?</span>
            </h2>
          </Reveal>

          <Reveal direction="up" delay={180} duration={700}>
            <p className="text-sm sm:text-base text-theme-secondary max-w-xl mx-auto leading-relaxed mb-10">
              Pick the closest fit, or tell us about your property and we will point you to the right starting point.
            </p>
          </Reveal>
        </div>

        <div className="mt-14">
          <FeatureColumns items={DOORS} />
        </div>

        <Reveal direction="zoom" delay={240} duration={750}>
          <div className="mt-16 flex flex-col items-center gap-5 text-center">
            <Link
              href="/planner"
              className="group inline-flex h-12 sm:h-[3.25rem] items-center gap-3 rounded-full bg-emerald-600 pl-7 pr-1.5 text-sm sm:text-base font-semibold text-white shadow-lg shadow-emerald-600/25 transition-all duration-200 hover:bg-emerald-500 hover:scale-[1.03] active:scale-95"
            >
              <span>Plan my system</span>
              <span className="flex size-9 sm:size-10 items-center justify-center rounded-full bg-white text-emerald-700 transition-transform duration-200 group-hover:translate-x-0.5">
                <ArrowRight className="size-4" aria-hidden="true" />
              </span>
            </Link>
            <p className="text-sm text-theme-secondary">
              Prefer to talk?{" "}
              <Link href="/contact" className="font-semibold text-theme-highlight hover:underline underline-offset-4">
                Contact us
              </Link>
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
