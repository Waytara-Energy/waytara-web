import { SolutionsHub } from "@/components/sections/solutions-hub";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbJsonLd, pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Solar, Battery & EV Charging Solutions by Property Type",
  description:
    "Solar, battery storage and EV charging designed, installed and managed together, for homes, apartments, commercial buildings, factories, EV fleets and campuses across India.",
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
        ]}
      />
      <SolutionsHub />
    </>
  );
}
