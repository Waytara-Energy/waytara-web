import { HomePageContent } from "@/components/sections/home-page-content";
import { pageMetadata } from "@/lib/seo";
import { SITE } from "@/lib/site";

// Server component on purpose: the page body used to be a client component
// behind a Suspense boundary, so the HTML a crawler (or a slow phone) received
// was only "Loading WayTara Energy...". The interactive body now lives in
// HomePageContent and is server-rendered like any other page.
export const metadata = pageMetadata({
  title: `${SITE.shortName} | ${SITE.tagline}`,
  description: SITE.description,
  path: "/",
});

export default function HomePage() {
  return <HomePageContent />;
}
