import { WHY_DESCRIPTION, WhyWaytaraPage } from "@/components/pages/why-waytara-page";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Why WayTara: One Team, One Energy System, Built for Your Site",
  description: WHY_DESCRIPTION,
  path: "/why-waytara",
});

export default function WhyWaytaraRoute() {
  return <WhyWaytaraPage />;
}
