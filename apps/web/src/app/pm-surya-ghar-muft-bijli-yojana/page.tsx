import { GuidePage } from "@/components/pages/guide-page";
import { GUIDES } from "@/data/guides";
import { pageMetadata } from "@/lib/seo";

const guide = GUIDES["pm-surya-ghar-muft-bijli-yojana"];

export const metadata = pageMetadata({ title: guide.metaTitle, description: guide.metaDescription, path: guide.path });

export default function Page() {
  return <GuidePage guide={guide} />;
}
