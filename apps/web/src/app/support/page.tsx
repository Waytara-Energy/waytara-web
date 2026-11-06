import { SUPPORT_DESCRIPTION, SupportPage } from "@/components/pages/support-page";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "WayTara Support: Tickets, Phone, E-mail and Sign-in Help",
  description: SUPPORT_DESCRIPTION,
  path: "/support",
});

export default function SupportRoute() {
  return <SupportPage />;
}
