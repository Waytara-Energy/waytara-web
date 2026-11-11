import { Reveal } from "@/components/shared/reveal";
import { SectionHeader } from "@/components/shared/section-header";
import { FeatureColumns } from "@/components/segments/segment-parts";
import { DOORS } from "@/components/sections/where-to-start";

/** The closing section of the landing page: the same opening as every other section, then the three ways in (build, charge, manage), each going to the planner. */
export function FinalCTA() {
  return (
    <section id="where-to-start" className="section-padding bg-theme-bg relative overflow-hidden scroll-mt-16">
      {/* Soft ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-br from-emerald-500/15 via-teal-500/8 to-transparent rounded-full blur-3xl pointer-events-none -z-10" />

      <div className="fluid-container relative">
        <Reveal direction="up" duration={700} distance={24}>
          <SectionHeader
            badge="Get started"
            title="Ready to run your energy"
            accent="as one system?"
            summary="Pick the closest fit, or tell us about your property and we will point you to the right starting point."
          />
        </Reveal>
        <FeatureColumns items={DOORS} />
      </div>
    </section>
  );
}
