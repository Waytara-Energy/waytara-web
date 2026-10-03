import { describe, expect, it } from "vitest";
import { breadcrumbJsonLd, faqJsonLd, organizationJsonLd, pageMetadata } from "./seo";
import { SITE, absoluteUrl } from "./site";
import sitemap from "@/app/sitemap";
import robots from "@/app/robots";
import { SEGMENT_KEYS, SEGMENT_SOLUTIONS_DATA } from "@/data/solutions-data";

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
    expect(SITE.url).toBe("https://waytaraenergy.com");
    expect(absoluteUrl("/about")).toBe("https://waytaraenergy.com/about");
    expect(absoluteUrl("about")).toBe("https://waytaraenergy.com/about");
  });
});

describe("structured data", () => {
  it("describes the organisation with address and contact", () => {
    const org = organizationJsonLd() as { "@type": string; email: string; address: { addressLocality: string } };
    expect(org["@type"]).toBe("Organization");
    expect(org.address.addressLocality).toBe("Chennai");
    expect(org.email).toBe(SITE.email);
  });

  it("numbers breadcrumb items from 1 with absolute URLs", () => {
    const b = breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Solutions", path: "/solutions" },
    ]) as { itemListElement: { position: number; item: string }[] };
    expect(b.itemListElement.map((i) => i.position)).toEqual([1, 2]);
    expect(b.itemListElement[1].item).toBe("https://waytaraenergy.com/solutions");
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
    for (const key of SEGMENT_KEYS) {
      expect(urls).toContain(absoluteUrl(SEGMENT_SOLUTIONS_DATA[key].urlPath));
    }
    expect(urls.some((u) => u.includes("_"))).toBe(false);
  });

  it("excludes private and noindex placeholder pages", () => {
    for (const hidden of ["/dashboard", "/login", "/technology", "/knowledge-centre", "/quote"]) {
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
    expect(r.sitemap).toBe("https://waytaraenergy.com/sitemap.xml");
  });
});
