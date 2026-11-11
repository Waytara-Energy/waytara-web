import type { Viewport } from "next";
import { HomePageContent } from "@/components/sections/home-page-content";
import { pageMetadata } from "@/lib/seo";

// Server component on purpose: the page body used to be a client component
// behind a Suspense boundary, so the HTML a crawler (or a slow phone) received
// was only "Loading WayTara Energy...". The interactive body now lives in
// HomePageContent and is server-rendered like any other page.
export const metadata = pageMetadata({
  title: "WayTara Energy | Solar, Battery & EV Charging in One System",
  description:
    "Rooftop solar, hybrid inverters, battery storage and EV charging for homes, villas, apartments and businesses in Chennai and across India, monitored and controlled in one WayTara dashboard.",
  path: "/",
});

// The browser's bar colour on the home page, from the first byte: the sky's top colour (the script in the menu bar then keeps it in step with the theme
// being shown and with the scroll). Without this the HTML starts with the plain page colours and a phone that reads them only at load shows those.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#3876ba" },
    { media: "(prefers-color-scheme: dark)", color: "#070d1f" },
  ],
};

export default function HomePage() {
  return <HomePageContent />;
}
