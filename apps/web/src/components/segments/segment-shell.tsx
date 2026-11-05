import { Navigation } from "@/components/sections/navigation";
import { Footer } from "@/components/sections/footer";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbJsonLd, faqJsonLd, serviceJsonLd } from "@/lib/seo";
import { SegmentMenu, type SegmentMenuItem } from "./segment-menu";
import type { Faq } from "./faq-list";

/**
 * The frame of every segment page: site header, hero, the sticky in-page menu, the sections, and the footer.
 * Search-engine data (breadcrumbs, the service, the FAQ) is generated from the same content the page shows.
 */
export function SegmentShell({
  name,
  path,
  description,
  faqs,
  menu,
  hero,
  children,
}: {
  name: string;
  path: string;
  description: string;
  faqs: Faq[];
  menu: SegmentMenuItem[];
  hero: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-theme-bg text-theme-primary">
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Solutions", path: "/solutions" },
            { name, path },
          ]),
          serviceJsonLd({ name, description, path, serviceType: "Solar, battery storage and EV charging installation" }),
          faqJsonLd(faqs),
        ]}
      />
      <Navigation />
      <main className="flex-1">
        {hero}
        <SegmentMenu items={menu} />
        {children}
      </main>
      <Footer />
    </div>
  );
}
