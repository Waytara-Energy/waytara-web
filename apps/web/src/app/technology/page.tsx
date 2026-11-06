import { PLATFORM_DESCRIPTION, PlatformPage } from "@/components/pages/platform-page";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Monitor and Control Solar, Battery & EV Charging",
  description: PLATFORM_DESCRIPTION,
  path: "/technology",
});

export default function TechnologyPage() {
  return <PlatformPage />;
}
