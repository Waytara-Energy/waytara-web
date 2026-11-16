import { GUIDE_LIST, GUIDES, type Guide } from "./guides";
import { competencyCertificates, licenceGrades, partnerDocuments, workingUnderContractor } from "./blog-partners";
import { evOcpp, existingSolar, gateway, ocppVersions } from "./blog-platform";
import { antiIslanding, solarCare, solarMonitoring } from "./blog-solar";
import { homeEvCharger, modbusExplained } from "./blog-integration";

/**
 * The blog: every article in one place, under a few topics. The older customer guides (solar, subsidy and bills) keep their own addresses and are listed here under
 * "Solar and subsidy"; the newer articles live at /blog/<slug>, written in blog-partners.ts, blog-platform.ts and blog-solar.ts. Same rules as the guides: only what
 * is true and checked, no prices, no comparison with other companies, and every article that rests on a document links it as a source.
 */

export const BLOG_CATEGORIES = ["Partners and licences", "Gateway and integration", "EV charging", "Solar systems", "Solar and subsidy"] as const;
export type BlogCategory = (typeof BLOG_CATEGORIES)[number];

export const BLOG_POSTS: Guide[] = [
  licenceGrades,
  competencyCertificates,
  workingUnderContractor,
  partnerDocuments,
  gateway,
  existingSolar,
  modbusExplained,
  evOcpp,
  ocppVersions,
  homeEvCharger,
  antiIslanding,
  solarCare,
  solarMonitoring,
];
export const BLOG_BY_SLUG: Record<string, Guide> = Object.fromEntries(BLOG_POSTS.map((p) => [p.slug, p]));

/** An article by slug, from the blog or from the older guides. */
export function findArticle(slug: string): Guide | undefined {
  return BLOG_BY_SLUG[slug] ?? GUIDES[slug];
}

export interface ArticleCard {
  slug: string;
  path: string;
  title: string;
  excerpt: string;
  category: BlogCategory;
  minutes: number;
  date: string;
  dateLabel: string;
}

function words(g: Guide): number {
  const text: string[] = [g.answer, ...g.inShort];
  for (const s of g.sections)
    for (const b of s.blocks) {
      if (b.type === "p") text.push(b.text);
      else if (b.type === "list") text.push(...b.items);
      else if (b.type === "steps" || b.type === "cols") text.push(...b.items.flatMap((i) => [i.title, i.body]));
      else if (b.type === "note") text.push(b.title, b.body);
      else if (b.type === "compare") text.push(...b.rows.flatMap((r) => [r.label, ...r.cells]));
    }
  for (const f of g.faqs) text.push(f.question, f.answer);
  return text.join(" ").split(/\s+/).filter(Boolean).length;
}

const card = (g: Guide): ArticleCard => ({
  slug: g.slug,
  path: g.path,
  title: `${g.title} ${g.accent}`.replace(/\s+/g, " ").trim(),
  excerpt: g.metaDescription,
  category: (g.category as BlogCategory | undefined) ?? "Solar and subsidy",
  minutes: Math.max(2, Math.round(words(g) / 200)),
  date: g.updated,
  dateLabel: g.updatedLabel,
});

/** Every article, newest first, for the hub: the blog posts and the older guides. */
export const ARTICLES: ArticleCard[] = [...BLOG_POSTS, ...GUIDE_LIST].map(card).sort((a, b) => b.date.localeCompare(a.date));

/** The groups at the top of the hub: a decision, and the articles that help with it. */
export const BLOG_STARTS: { title: string; body: string; slugs: string[] }[] = [
  { title: "Partner with WayTara", body: "Licences, certificates, documents and how we work with partners.", slugs: ["licence-grades", "competency-certificates", "working-under-a-contractor", "partner-documents-and-privacy"] },
  { title: "Connect your equipment", body: "The gateway, an existing solar system and EV chargers.", slugs: ["waytara-gateway", "monitor-existing-solar", "modbus-rs485-explained", "connect-ev-charger-ocpp", "ocpp-1-6-or-2-0-1", "home-ev-charger-installation"] },
  { title: "Look after your system", body: "Power cuts, cleaning and what good monitoring shows.", slugs: ["why-solar-stops-in-a-power-cut", "clean-and-maintain-rooftop-solar", "good-solar-monitoring"] },
  { title: "Solar, subsidy and bills", body: "Sizing, system types, the PM Surya Ghar subsidy and your bill.", slugs: ["solar-for-home", "solar-subsidy", "reduce-electricity-bill-solar"] },
];
