import type { MetadataRoute } from "next";
import { SEGMENT_SOLUTIONS_DATA, SEGMENT_KEYS } from "@/data/solutions-data";
import { SITE } from "@/lib/site";

// /technology and /knowledge-centre are noindex placeholders for now, so they are not listed.
// Last meaningful content change for the static pages. Update when copy changes.
const LAST_UPDATED = new Date("2026-10-01");

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages: { path: string; priority: number; changeFrequency: "weekly" | "monthly" | "yearly" }[] = [
    { path: "/", priority: 1, changeFrequency: "weekly" },
    { path: "/solutions", priority: 0.9, changeFrequency: "weekly" },
    { path: "/about", priority: 0.7, changeFrequency: "monthly" },
    { path: "/contact", priority: 0.8, changeFrequency: "yearly" },
    { path: "/warranty", priority: 0.4, changeFrequency: "yearly" },
    { path: "/privacy", priority: 0.2, changeFrequency: "yearly" },
    { path: "/terms", priority: 0.2, changeFrequency: "yearly" },
    { path: "/cookies", priority: 0.2, changeFrequency: "yearly" },
  ];

  // One canonical URL per segment (the data's own hyphenated urlPath), never the underscore aliases.
  const segmentPages = SEGMENT_KEYS.map((key) => ({
    path: SEGMENT_SOLUTIONS_DATA[key].urlPath,
    priority: 0.8,
    changeFrequency: "monthly" as const,
  }));

  return [...staticPages, ...segmentPages].map((p) => ({
    url: `${SITE.url}${p.path}`,
    lastModified: LAST_UPDATED,
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }));
}
