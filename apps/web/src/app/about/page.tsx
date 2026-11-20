import { ABOUT_DESCRIPTION, AboutPage } from "@/components/pages/about-page";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "About WayTara: One Connected Energy System",
  description: ABOUT_DESCRIPTION,
  path: "/about",
});

export default function AboutRoute() {
  return <AboutPage />;
}
