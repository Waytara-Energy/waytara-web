import { Footer } from "@/components/sections/footer";
import { Navigation } from "@/components/sections/navigation";
import { PlannerApp } from "@/components/planner/planner-app";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbJsonLd, pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Energy Planner: Find the Right Solar, Battery, EV Charging or Energy Management Solution",
  description:
    "Tell us what you want to achieve and get a preliminary energy blueprint for your property: new solar, storage and EV charging, connecting equipment you already have, or managing chargers.",
  path: "/planner",
});

export default function PlannerPage() {
  return (
    <div className="flex min-h-screen flex-col bg-theme-bg text-theme-primary">
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Energy Planner", path: "/planner" },
          ]),
        ]}
      />
      <Navigation />
      <main className="flex-1 pb-[clamp(3rem,6vw,6rem)] pt-[clamp(6.5rem,10vw,9rem)]">
        <div className="fluid-container">
          <PlannerApp
            intro={
              <>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-400">Energy planner</p>
                <h1 className="mt-4 text-[clamp(2.1rem,3.6vw,3.2rem)] font-bold leading-[1.12] tracking-tight text-theme-primary">
                  Find the right
                  <span className="block text-primary-gradient">energy solution.</span>
                </h1>
                <p className="mt-5 max-w-md text-[15px] leading-relaxed text-theme-secondary">
                  A few questions, only the ones that matter for your property, then a preliminary blueprint. No prices and no promises: a starting point for a proper assessment.
                </p>
              </>
            }
          />
        </div>
      </main>
      <Footer />
    </div>
  );
}
