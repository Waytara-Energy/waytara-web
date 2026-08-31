import * as React from "react";
import { Metadata } from "next";
import { Navigation } from "@/components/sections/navigation";
import { Footer } from "@/components/sections/footer";
import { SolutionsView } from "@/components/sections/solutions-view";
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

  return {
    title: `${data.name} Solutions & Packages | WayTara Clean Energy`,
    description: data.executiveSummary,
  };
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

  return (
    <div className="flex flex-col min-h-screen bg-theme-bg text-theme-primary">
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
