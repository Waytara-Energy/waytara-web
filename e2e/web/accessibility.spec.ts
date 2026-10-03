import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { WEB_URL } from "../support/accounts";

// Automated accessibility scan (WCAG 2.x A/AA rules). Automated tools find
// roughly a third of real issues, so this is a floor, not a certification.
// `critical` violations fail the build; `serious` ones are logged so they are
// visible and can be burned down (see docs/PRODUCTION_READINESS.md).
for (const path of ["/", "/login", "/contact", "/solutions/home"]) {
  test(`no critical accessibility violations on ${path}`, async ({ page }) => {
    await page.goto(`${WEB_URL}${path}`);
    await page.waitForLoadState("networkidle");
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();

    const serious = results.violations.filter((v) => v.impact === "serious");
    if (serious.length) {
      console.log(`[a11y] ${path}: ${serious.length} serious -> ${serious.map((v) => `${v.id} (${v.nodes.length})`).join(", ")}`);
    }
    const critical = results.violations.filter((v) => v.impact === "critical");
    expect(critical, critical.map((v) => `${v.id}: ${v.help}`).join("\n")).toEqual([]);
  });
}
