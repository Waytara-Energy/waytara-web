import { PARTNER_DESCRIPTION, PartnerPage } from "@/components/pages/partner-page";
import { fetchListedPartners } from "@/lib/partner-directory-server";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Partner Network: Electrical, Solar & EV Charging Partners in Tamil Nadu",
  description: PARTNER_DESCRIPTION,
  path: "/partner",
});

// The directory of listed partners is re-read every ten minutes; the rest of the page is static.
export const revalidate = 600;

export default async function PartnerRoute() {
  return <PartnerPage partners={await fetchListedPartners()} />;
}
