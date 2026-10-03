import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

// Public marketing pages are open to every crawler (search engines and AI
// answer engines alike). Everything behind a login, one-time links and API
// routes is disallowed.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard", "/api/", "/quote/", "/invite/", "/login", "/forgot-password", "/reset-password", "/auth/"],
      },
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
