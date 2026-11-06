import { Reveal } from "@/components/shared/reveal";
import { SectionHeader } from "@/components/shared/section-header";
import { ApproachParts } from "./approach-parts";

/** Our approach: the same section header as every other section, then the four parts as small interactive pictures. */
export function OurApproach() {
  return (
    <section id="our-approach" className="section-padding bg-theme-bg relative z-10 scroll-mt-16 overflow-hidden">
      <div className="fluid-container">
        <Reveal direction="up" duration={700} distance={24}>
          <SectionHeader
            badge="Our Approach"
            title="Build the energy system."
            accent="Connect it. Manage it."
            summary="WayTara designs and installs solar, storage and EV charging, then connects them through its own gateway and software, so you can see and manage the whole system in one place."
          />
        </Reveal>

        <Reveal direction="up" duration={700} distance={24} delay={100}>
          <ApproachParts />
        </Reveal>
      </div>
    </section>
  );
}
