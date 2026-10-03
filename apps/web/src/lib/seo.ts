import type { Metadata } from "next";
import { SITE, absoluteUrl } from "@/lib/site";

interface PageMetaInput {
  /** Page title WITHOUT the site suffix — the root layout's title template appends " | WayTara Energy". */
  title: string;
  description: string;
  /** Path of this page, e.g. "/about". Becomes the canonical URL. */
  path: string;
  /** Keep the page out of search results (account/auth/transactional pages). */
  noIndex?: boolean;
}

/** Consistent per-page metadata: title, description, canonical, Open Graph and
 *  Twitter. Open Graph/Twitter images come from the root `opengraph-image`. */
export function pageMetadata({ title, description, path, noIndex }: PageMetaInput): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: path,
      siteName: SITE.name,
      type: "website",
      locale: SITE.locale,
    },
    twitter: { card: "summary_large_image", title, description },
    ...(noIndex ? { robots: { index: false, follow: false } } : {}),
  };
}

export const NO_INDEX: Metadata = { robots: { index: false, follow: false } };

// ------------------------------------------------------------------
// Schema.org JSON-LD builders (plain objects; render with <JsonLd/>)
// ------------------------------------------------------------------
export type JsonLdObject = Record<string, unknown>;

const ORG_ID = `${SITE.url}/#organization`;

export function organizationJsonLd(): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": ORG_ID,
    name: SITE.name,
    alternateName: SITE.shortName,
    url: SITE.url,
    logo: absoluteUrl(SITE.logoPath),
    email: SITE.email,
    telephone: SITE.phone,
    description: SITE.description,
    address: { "@type": "PostalAddress", ...SITE.address },
    areaServed: { "@type": "Country", name: "India" },
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "sales",
        email: SITE.email,
        telephone: SITE.phone,
        areaServed: "IN",
        availableLanguage: ["English"],
      },
    ],
  };
}

export function websiteJsonLd(): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE.url}/#website`,
    url: SITE.url,
    name: SITE.name,
    description: SITE.description,
    inLanguage: "en-IN",
    publisher: { "@id": ORG_ID },
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

/** Only pass FAQs that are actually visible on the page — Google requires
 *  FAQPage markup to match on-page content. */
export function faqJsonLd(faqs: { question: string; answer: string }[]): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
}

export function serviceJsonLd(input: { name: string; description: string; path: string; serviceType: string }): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: input.name,
    description: input.description,
    serviceType: input.serviceType,
    url: absoluteUrl(input.path),
    provider: { "@id": ORG_ID },
    areaServed: { "@type": "Country", name: "India" },
  };
}
