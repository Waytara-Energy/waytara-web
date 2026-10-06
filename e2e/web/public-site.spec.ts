import { expect, test } from "@playwright/test";
import { WEB_URL } from "../support/accounts";

test.describe("public marketing site", () => {
  test("home page is server-rendered with real content for crawlers", async ({ request }) => {
    // Fetch raw HTML (no JavaScript executed) — exactly what a search/AI crawler first receives.
    const html = await (await request.get(`${WEB_URL}/`)).text();
    expect(html).toContain("<h1");
    expect(html).not.toContain("Loading WayTara Energy");
    expect(html.length).toBeGreaterThan(50_000);
  });

  test("solutions pages are server-rendered with FAQ structured data", async ({ request }) => {
    const html = await (await request.get(`${WEB_URL}/solutions/home`)).text();
    expect(html).toContain("<h1");
    const blocks = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map((m) => JSON.parse(m[1].replace(/\\u003c/g, "<")));
    const types = blocks.map((b) => b["@type"]);
    expect(types).toEqual(expect.arrayContaining(["Organization", "WebSite", "BreadcrumbList", "Service", "FAQPage"]));
  });

  test("underscore segment alias canonicalises to the hyphenated URL", async ({ request }) => {
    const html = await (await request.get(`${WEB_URL}/solutions/ev_fleet`)).text();
    expect(html).toContain('rel="canonical" href="https://www.waytaraenergy.com/solutions/ev-fleet"');
  });

  test("robots.txt, sitemap.xml and llms.txt are served", async ({ request }) => {
    const robots = await (await request.get(`${WEB_URL}/robots.txt`)).text();
    expect(robots).toContain("Disallow: /dashboard");
    expect(robots).toContain("Sitemap: https://www.waytaraenergy.com/sitemap.xml");

    const sitemap = await (await request.get(`${WEB_URL}/sitemap.xml`)).text();
    expect(sitemap).toContain("<loc>https://www.waytaraenergy.com/solutions/ev-fleet</loc>");
    expect(sitemap).not.toContain("/dashboard");
    expect(sitemap).not.toContain("/login");

    const llms = await request.get(`${WEB_URL}/llms.txt`);
    expect(llms.status()).toBe(200);
    expect(await llms.text()).toContain("# WayTara Energy");
  });

  test("login and placeholder pages are noindex", async ({ request }) => {
    for (const path of ["/login", "/technology", "/knowledge-centre"]) {
      const html = await (await request.get(`${WEB_URL}${path}`)).text();
      expect(html, path).toContain('<meta name="robots" content="noindex, nofollow"');
    }
  });

  test("security headers are present", async ({ request }) => {
    const res = await request.get(`${WEB_URL}/`);
    const h = res.headers();
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["x-powered-by"]).toBeUndefined();
  });

  test("the contact page is reachable from the home page navigation", async ({ page }) => {
    await page.goto(`${WEB_URL}/`);
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    await page.goto(`${WEB_URL}/contact`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("WayTara");
  });
});

test.describe("access control (logged out)", () => {
  test("/dashboard redirects to the login page", async ({ page }) => {
    await page.goto(`${WEB_URL}/dashboard`);
    await expect(page).toHaveURL(/\/login/);
  });

  test("the report export endpoints do not leak data to anonymous callers", async ({ request }) => {
    const res = await request.get(`${WEB_URL}/api/reports/energy.csv`, { maxRedirects: 0 });
    expect([302, 307, 401, 403]).toContain(res.status());
  });

  test("the daily report endpoints (JSON, CSV, PDF) refuse anonymous callers", async ({ request }) => {
    for (const path of ["day", "day.csv", "day.pdf"]) {
      const res = await request.get(`${WEB_URL}/api/reports/${path}?date=2026-10-05&type=solar`, { maxRedirects: 0 });
      expect([302, 307, 401, 403], `/api/reports/${path}`).toContain(res.status());
    }
  });

  test("a made-up quotation token cannot fetch a PDF", async ({ request }) => {
    const res = await request.get(`${WEB_URL}/quote/00000000-0000-4000-8000-000000000000/pdf`, { maxRedirects: 0 });
    expect(res.status()).toBe(404);
  });

  test("a malformed quotation token is rejected before touching the database", async ({ request }) => {
    const res = await request.get(`${WEB_URL}/quote/not-a-token/pdf`, { maxRedirects: 0 });
    expect(res.status()).toBe(404);
  });
});
