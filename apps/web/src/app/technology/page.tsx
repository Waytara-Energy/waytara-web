import { PLATFORM_DESCRIPTION, PlatformPage } from "@/components/pages/platform-page";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Solar, Battery & EV Charging Platform",
  description: PLATFORM_DESCRIPTION,
  path: "/technology",
});

export default function TechnologyPage() {
  return <PlatformPage />;
}
