import { Hammer, PlugZap, SlidersHorizontal } from "lucide-react";
import { Reveal } from "@/components/shared/reveal";
import { SectionHeader } from "@/components/shared/section-header";
import { FeatureColumns } from "@/components/segments/segment-parts";

// The planner reads `start` to open on the matching path (built in step 5 of the website plan).
const DOORS = [
  { icon: Hammer, title: "Build a new system", body: "Solar, battery storage and EV charging, designed together for your property.", link: { label: "Get started", href: "/planner?start=build" } },
  { icon: PlugZap, title: "Set up EV charging", body: "Chargers for your home, workplace or fleet, with the software to manage them.", link: { label: "Get started", href: "/planner?start=charge" } },
  { icon: SlidersHorizontal, title: "Manage what I have", body: "Connect the supported equipment you already own to one dashboard.", link: { label: "Get started", href: "/planner?start=manage" } },
];

/** Not sure what fits? Three doors into the Energy Planner, as the same frameless blocks as the rest of the site. */
export function WhereToStart() {
  return (
    <section id="where-to-start" className="section-padding bg-theme-bg scroll-mt-16">
      <div className="fluid-container">
        <Reveal direction="up" duration={700} distance={24}>
          <SectionHeader
            badge="Where to start"
            title="Not sure what fits?"
            accent="Start with the planner."
            summary="Answer a few questions about your property and see the right starting point for it."
          />
        </Reveal>
        <FeatureColumns items={DOORS} />
      </div>
    </section>
  );
}
