import { PARTNER_DESCRIPTION, PartnerPage } from "@/components/pages/partner-page";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Partner Network: Electrical, Solar & EV Charging Partners in Tamil Nadu",
  description: PARTNER_DESCRIPTION,
  path: "/partner",
});

export default function PartnerRoute() {
  return <PartnerPage />;
}
