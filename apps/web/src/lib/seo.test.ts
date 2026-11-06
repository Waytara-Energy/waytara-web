import { GUIDE_LIST, GUIDES } from "@/data/guides";
import { describe, expect, it } from "vitest";
import { breadcrumbJsonLd, faqJsonLd, organizationJsonLd, pageMetadata } from "./seo";
import { SITE, absoluteUrl } from "./site";
import sitemap from "@/app/sitemap";
import robots from "@/app/robots";
import { SEGMENT_PAGES, SEGMENT_SLUGS, canonicalSlug, segmentForSlug } from "@/components/segments/registry";

describe("pageMetadata", () => {
  it("sets a canonical path and mirrors title/description into Open Graph and Twitter", () => {
    const m = pageMetadata({ title: "About", description: "d", path: "/about" });
    expect(m.alternates?.canonical).toBe("/about");
    expect(m.openGraph?.title).toBe("About");
    expect(m.twitter?.title).toBe("About");
    expect(m.robots).toBeUndefined();
  });

  it("marks noIndex pages as noindex,nofollow", () => {
    const m = pageMetadata({ title: "x", description: "d", path: "/x", noIndex: true });
    expect(m.robots).toEqual({ index: false, follow: false });
  });
});

describe("site", () => {
  it("builds absolute URLs on the canonical origin, never localhost", () => {
    expect(SITE.url).toBe("https://www.waytaraenergy.com");
    expect(absoluteUrl("/about")).toBe("https://www.waytaraenergy.com/about");
    expect(absoluteUrl("about")).toBe("https://www.waytaraenergy.com/about");
  });
});

describe("structured data", () => {
  it("describes the organisation with address and contact", () => {
    const org = organizationJsonLd() as { "@type": string[]; email: string; address: { addressLocality: string } };
    expect(org["@type"]).toEqual(expect.arrayContaining(["Organization", "LocalBusiness"]));
    expect(org.address.addressLocality).toBe("Chennai");
    expect(org.email).toBe(SITE.email);
  });

  it("numbers breadcrumb items from 1 with absolute URLs", () => {
    const b = breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Solutions", path: "/solutions" },
    ]) as { itemListElement: { position: number; item: string }[] };
    expect(b.itemListElement.map((i) => i.position)).toEqual([1, 2]);
    expect(b.itemListElement[1].item).toBe("https://www.waytaraenergy.com/solutions");
  });

  it("maps FAQs to Question/Answer pairs", () => {
    const f = faqJsonLd([{ question: "Q?", answer: "A." }]) as {
      "@type": string;
      mainEntity: { acceptedAnswer: { text: string } }[];
    };
    expect(f["@type"]).toBe("FAQPage");
    expect(f.mainEntity[0].acceptedAnswer.text).toBe("A.");
  });
});

describe("sitemap", () => {
  const urls = sitemap().map((e) => e.url);

  it("has no duplicate URLs", () => {
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("lists one canonical URL per solutions segment and never the underscore aliases", () => {
    for (const entry of Object.values(SEGMENT_PAGES)) {
      expect(urls).toContain(absoluteUrl(entry.path));
    }
    expect(urls.some((u) => u.includes("_"))).toBe(false);
  });

  it("lists every public page, including the platform, planner, partner, support and why pages", () => {
    for (const path of ["/", "/solutions", "/technology", "/planner", "/why-waytara", "/partner", "/support", "/about", "/contact"]) {
      expect(urls).toContain(absoluteUrl(path));
    }
  });

  it("lists every guide page", () => {
    for (const g of GUIDE_LIST) expect(urls).toContain(absoluteUrl(g.path));
    expect(GUIDE_LIST.length).toBeGreaterThanOrEqual(4);
  });

  it("excludes private pages and the removed Knowledge Centre", () => {
    for (const hidden of ["/dashboard", "/login", "/knowledge-centre", "/quote", "/invite"]) {
      expect(urls.some((u) => u.includes(hidden))).toBe(false);
    }
  });
});

describe("robots", () => {
  it("allows public pages, blocks private areas and points at the sitemap", () => {
    const r = robots();
    const rule = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    expect(rule.allow).toBe("/");
    expect(rule.disallow).toEqual(expect.arrayContaining(["/dashboard", "/api/", "/quote/", "/invite/"]));
    expect(r.sitemap).toBe("https://www.waytaraenergy.com/sitemap.xml");
  });
});

describe("guides", () => {
  it("each guide has an answer, a short list, a visible FAQ and real related guides", () => {
    for (const g of GUIDE_LIST) {
      expect(g.answer.length).toBeGreaterThan(80);
      expect(g.inShort.length).toBeGreaterThanOrEqual(3);
      expect(g.faqs.length).toBeGreaterThanOrEqual(5);
      expect(g.path).toBe(`/${g.slug}`);
      for (const r of g.related) expect(GUIDES[r]).toBeDefined();
      // the title stays short enough to show in search results once the site name is added
      expect(g.metaTitle.length).toBeLessThanOrEqual(48);
    }
  });

  it("never states a price or a guarantee of savings", () => {
    const text = JSON.stringify(GUIDE_LIST).toLowerCase();
    expect(text).not.toMatch(/guaranteed saving|we guarantee|cheapest|best price|₹\s?\d+\s?(lakh|per unit)/);
  });
});

describe("solution page addresses", () => {
  it("knows exactly six pages and finds each by its slug", () => {
    expect(SEGMENT_SLUGS.sort()).toEqual(["apartment", "commercial", "ev-fleet", "factory", "home", "it-park"]);
    for (const slug of SEGMENT_SLUGS) expect(segmentForSlug(slug)).toBeDefined();
  });

  it("finds nothing for an invented address, so it can be a 404 and not the Home page", () => {
    expect(segmentForSlug("anything")).toBeUndefined();
    expect(segmentForSlug("")).toBeUndefined();
    expect(segmentForSlug("ev_fleet")).toBeUndefined();
  });

  it("sends the older underscore spellings to the real address, and only those", () => {
    expect(canonicalSlug("ev_fleet")).toBe("ev-fleet");
    expect(canonicalSlug("it_park")).toBe("it-park");
    expect(canonicalSlug("home")).toBeUndefined();
    expect(canonicalSlug("not_a_page")).toBeUndefined();
  });
});
