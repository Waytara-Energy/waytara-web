import { GuidesHub } from "@/components/pages/guides-hub";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Solar Guides: Home, Subsidy and Bills",
  description:
    "Plain answers about rooftop solar: how big a system your home needs, on-grid, hybrid or off-grid, the PM Surya Ghar subsidy and net metering, and how solar and a battery lower an electricity bill.",
  path: "/guides",
});

export default function Page() {
  return <GuidesHub />;
}
