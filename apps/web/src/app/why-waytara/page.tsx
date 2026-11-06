import { WHY_DESCRIPTION, WhyWaytaraPage } from "@/components/pages/why-waytara-page";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Why Choose WayTara for Solar & EV Charging",
  description: WHY_DESCRIPTION,
  path: "/why-waytara",
});

export default function WhyWaytaraRoute() {
  return <WhyWaytaraPage />;
}
