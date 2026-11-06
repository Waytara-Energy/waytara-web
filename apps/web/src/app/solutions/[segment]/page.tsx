import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { SEGMENT_SLUGS, canonicalSlug, segmentForSlug } from "@/components/segments/registry";
import { pageMetadata } from "@/lib/seo";

interface SegmentPageProps {
  params: Promise<{ segment: string }>;
}

export async function generateMetadata({ params }: SegmentPageProps): Promise<Metadata> {
  const entry = segmentForSlug((await params).segment);
  return entry ? pageMetadata({ title: entry.title, description: entry.description, path: entry.path }) : {};
}

export function generateStaticParams() {
  return SEGMENT_SLUGS.map((segment) => ({ segment }));
}

/**
 * One of the six property pages. An older spelling with an underscore (ev_fleet, it_park) is sent on to the real address, and anything else is a
 * 404: this used to fall back to the Home page for any address at all.
 */
export default async function SegmentDetailPage({ params }: SegmentPageProps) {
  const { segment } = await params;
  const entry = segmentForSlug(segment);
  if (!entry) {
    const real = canonicalSlug(segment);
    if (real) permanentRedirect(`/solutions/${real}`);
    notFound();
  }
  const Page = entry.Page;
  return <Page />;
}
