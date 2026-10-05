/** Single source of truth for who WayTara is, used by metadata, structured
 *  data (JSON-LD), the sitemap and llms.txt. Everything here is taken from
 *  what the public site already shows (footer / contact page) — nothing is
 *  invented. Review before launch; items marked REVIEW need the founder's
 *  confirmation (e.g. which phone number is the primary public line). */
export const SITE = {
  name: "WayTara Energy",
  shortName: "WayTara",
  /** Canonical public origin. Deliberately NOT NEXT_PUBLIC_SITE_URL (that one
   *  is used for e-mail links and is "http://localhost:3000" in local dev) so
   *  a mis-set env var can never leak localhost into canonical URLs. */
  url: (process.env.NEXT_PUBLIC_CANONICAL_URL ?? "https://www.waytaraenergy.com").replace(/\/$/, ""),
  locale: "en_IN",
  tagline: "Intelligent Clean Energy Systems for Home, Business & Fleet",
  description:
    "Solar. Battery Storage. EV Charging. Monitoring — designed around your needs, installed under one trusted partner.",
  email: "hello@waytaraenergy.com",
  /** REVIEW: the site shows three different numbers; this is the most frequent one. */
  phone: "+91 93630 21195",
  address: {
    streetAddress: "No. 6 & 7, 3rd Floor, 5th Street, Dr. Radhakrishnan Salai, Mylapore",
    addressLocality: "Chennai",
    postalCode: "600004",
    addressRegion: "Tamil Nadu",
    addressCountry: "IN",
  },
  logoPath: "/images/logo.png",
  themeColor: "#0A0F0D",
} as const;

export function absoluteUrl(path = "/"): string {
  return `${SITE.url}${path.startsWith("/") ? path : `/${path}`}`;
}
