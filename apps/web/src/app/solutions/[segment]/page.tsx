import * as React from "react";
import { Metadata } from "next";
import { Navigation } from "@/components/sections/navigation";
import { Footer } from "@/components/sections/footer";
import { SolutionsView } from "@/components/sections/solutions-view";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbJsonLd, faqJsonLd, pageMetadata, serviceJsonLd } from "@/lib/seo";
import {
  SEGMENT_SOLUTIONS_DATA,
  normalizeSegmentSlug,
} from "@/data/solutions-data";

interface SegmentPageProps {
  params: Promise<{ segment: string }>;
}

export async function generateMetadata({
  params,
}: SegmentPageProps): Promise<Metadata> {
  const { segment } = await params;
  const normalized = normalizeSegmentSlug(segment);
  const data = SEGMENT_SOLUTIONS_DATA[normalized] || SEGMENT_SOLUTIONS_DATA.home;

  // Canonical is the hyphenated path from the data (/solutions/ev-fleet), so
  // the underscore aliases (/solutions/ev_fleet) are never indexed as duplicates.
  return pageMetadata({
    title: `${data.name} Solutions & Packages`,
    description: data.executiveSummary,
    path: data.urlPath,
  });
}

export function generateStaticParams() {
  return [
    { segment: "home" },
    { segment: "apartment" },
    { segment: "factory" },
    { segment: "commercial" },
    { segment: "ev-fleet" },
    { segment: "ev_fleet" },
    { segment: "it-park" },
    { segment: "it_park" },
  ];
}

export default async function SegmentDetailPage({ params }: SegmentPageProps) {
  const { segment } = await params;
  const normalized = normalizeSegmentSlug(segment);
  const data = SEGMENT_SOLUTIONS_DATA[normalized] || SEGMENT_SOLUTIONS_DATA.home;

  return (
    <div className="flex flex-col min-h-screen bg-theme-bg text-theme-primary">
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Solutions", path: "/solutions" },
            { name: data.name, path: data.urlPath },
          ]),
          serviceJsonLd({
            name: `${data.name} — ${data.category}`,
            description: data.executiveSummary,
            path: data.urlPath,
            serviceType: "Solar, battery storage and EV charging installation",
          }),
          faqJsonLd(data.faqs),
        ]}
      />
      <Navigation />

      <main className="flex-1 pt-24 sm:pt-28">
        <div className="fluid-container">
          <SolutionsView initialSegment={normalized} />
        </div>
      </main>

      <Footer />
    </div>
  );
}
