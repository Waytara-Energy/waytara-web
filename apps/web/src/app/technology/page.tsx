import { PLATFORM_DESCRIPTION, PlatformPage } from "@/components/pages/platform-page";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "WayTara Platform: Energy Management and EV Charge-Point Management",
  description: PLATFORM_DESCRIPTION,
  path: "/technology",
});

export default function TechnologyPage() {
  return <PlatformPage />;
}
