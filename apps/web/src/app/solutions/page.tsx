import { SolutionsPageContent } from "@/components/sections/solutions-page-content";
import { JsonLd } from "@/components/seo/json-ld";
import { SOLAR_TOPOLOGY_CONSOLIDATED_FAQS } from "@/data/solutions-data";
import { breadcrumbJsonLd, faqJsonLd, pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Solar, Battery & EV Charging Solutions by Property Type",
  description:
    "Rooftop solar, smart LFP battery storage and EV charging engineered for homes, apartments, factories, offices, EV fleets and IT parks — one accountable warranty across India.",
  path: "/solutions",
});

export default function SolutionsPage() {
  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Solutions", path: "/solutions" },
          ]),
          faqJsonLd(SOLAR_TOPOLOGY_CONSOLIDATED_FAQS),
        ]}
      />
      <SolutionsPageContent />
    </>
  );
}
