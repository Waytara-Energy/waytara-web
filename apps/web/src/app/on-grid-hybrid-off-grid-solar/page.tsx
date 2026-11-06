import { GuidePage } from "@/components/pages/guide-page";
import { GUIDES } from "@/data/guides";
import { pageMetadata } from "@/lib/seo";

const guide = GUIDES["on-grid-hybrid-off-grid-solar"];

export const metadata = pageMetadata({ title: guide.metaTitle, description: guide.metaDescription, path: guide.path });

export default function Page() {
  return <GuidePage guide={guide} />;
}
