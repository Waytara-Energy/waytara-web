import { PARTNER_DESCRIPTION, PartnerPage } from "@/components/pages/partner-page";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Solar Installer, EPC & Channel Partner Programme",
  description: PARTNER_DESCRIPTION,
  path: "/partner",
});

export default function PartnerRoute() {
  return <PartnerPage />;
}
