import Link from "next/link";
import { ArrowRight, LayoutDashboard, Ruler, Users } from "lucide-react";
import { Reveal } from "@/components/shared/reveal";
import { FeatureColumns } from "@/components/segments/segment-parts";

const REASONS = [
  { icon: Users, title: "One accountable team", body: "The same team designs, installs and connects your system, and supports it afterwards." },
  { icon: Ruler, title: "Engineered for your site", body: "Every system is designed around your property and how you use energy, not picked from a package." },
  { icon: LayoutDashboard, title: "Works with what you have", body: "Supported equipment you already own can join the same dashboard, so you may not need to replace it." },
];

/** Three short reasons to choose WayTara, in the same blocks as the rest of the site, with a quick link to the full Why WayTara page. */
export function WhyStrip() {
  return (
    <section id="why-waytara" className="section-padding bg-theme-bg scroll-mt-16">
      <div className="fluid-container">
        <FeatureColumns items={REASONS} />
        <Reveal direction="up" duration={700} distance={16}>
          <div className="mt-16 flex justify-center">
            <Link href="/why-waytara" className="group inline-flex items-center gap-1.5 text-sm font-semibold text-theme-highlight hover:underline underline-offset-4">
              Why WayTara
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
