import type { MetadataRoute } from "next";

// Internal staff app: nothing here should ever appear in a search index.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
