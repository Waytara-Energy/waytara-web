import { PARTNER_DESCRIPTION, PartnerPage } from "@/components/pages/partner-page";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Partner with WayTara: Apply as an Installer Across India",
  description: PARTNER_DESCRIPTION,
  path: "/partner",
});

export default function PartnerRoute() {
  return <PartnerPage />;
}
