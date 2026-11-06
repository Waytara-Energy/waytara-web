import type { MetadataRoute } from "next";
import { SEGMENT_SOLUTIONS_DATA, SEGMENT_KEYS } from "@/data/solutions-data";
import { SITE } from "@/lib/site";

// Every public, indexable page is listed. The private areas (dashboard, sign-in, quote and invite links) are not, and the Knowledge Centre no longer exists.
// Last meaningful content change for the pages. Update when copy changes.
const LAST_UPDATED = new Date("2026-11-06");

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages: { path: string; priority: number; changeFrequency: "weekly" | "monthly" | "yearly" }[] = [
    { path: "/", priority: 1, changeFrequency: "weekly" },
    { path: "/solutions", priority: 0.9, changeFrequency: "weekly" },
    { path: "/technology", priority: 0.9, changeFrequency: "monthly" },
    { path: "/planner", priority: 0.9, changeFrequency: "monthly" },
    { path: "/why-waytara", priority: 0.7, changeFrequency: "monthly" },
    { path: "/partner", priority: 0.7, changeFrequency: "monthly" },
    { path: "/support", priority: 0.6, changeFrequency: "monthly" },
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
