import { SUPPORT_DESCRIPTION, SupportPage } from "@/components/pages/support-page";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "WayTara Support: Sign-in Help, Devices, Billing and Tickets",
  description: SUPPORT_DESCRIPTION,
  path: "/support",
});

export default function SupportRoute() {
  return <SupportPage />;
}
