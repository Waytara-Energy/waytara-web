import { describe, expect, it } from "vitest";
import { escapeHtml, renderMail } from "@waytara/ui/mail-layout";

const base = { title: "Your password code", greeting: "Hi Priya,", blocks: [{ type: "p", text: "Use this code." }] as const };

describe("the standard e-mail layout", () => {
  it("puts the brand, the help line, the quick links, the legal links and the address in every e-mail", () => {
    const { html, text } = renderMail({ ...base, blocks: [...base.blocks] });
    expect(html).toContain("https://www.waytaraenergy.com/images/logo.png");
    expect(html).toContain("hello@waytaraenergy.com");
    expect(html).toContain("/privacy");
    expect(html).toContain("/terms");
    expect(html).toContain("Mylapore, Chennai");
    expect(html).toContain("The WayTara Team");
    expect(text).toContain("Questions?");
    expect(text).toContain("Mylapore, Chennai");
  });

  it("escapes everything a person typed, in the HTML and in a button address", () => {
    const evil = `<img src=x onerror=alert(1)> "quoted" & more`;
    const { html } = renderMail({
      title: evil,
      greeting: evil,
      blocks: [
        { type: "p", text: evil },
        { type: "facts", rows: [[evil, evil]] },
        { type: "quote", label: evil, text: evil },
        { type: "list", items: [evil] },
        { type: "note", text: evil },
        { type: "h", text: evil },
      ],
      button: { label: evil, url: `https://x.test/?a="><script>` },
      why: evil,
    });
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;img src=x");
  });

  it("shows a code, facts, a quote, a list and a button, and says them all in the plain-text version too", () => {
    const { html, text } = renderMail({
      title: "T",
      blocks: [
        { type: "code", code: "482915" },
        { type: "facts", rows: [["Device", "Chrome on Windows"]] },
        { type: "quote", label: "Their message", text: "We will visit." },
        { type: "list", items: ["one", "two"] },
      ],
      button: { label: "Open Settings", url: "https://www.waytaraenergy.com/dashboard/settings" },
    });
    expect(html).toContain("482915");
    expect(html).toContain("Open Settings");
    expect(text).toContain("482915");
    expect(text).toContain("Device: Chrome on Windows");
    expect(text).toContain('Their message:\n"We will visit."');
    expect(text).toContain("- one");
    expect(text).toContain("Open Settings: https://www.waytaraenergy.com/dashboard/settings");
  });

  it("chooses the quick links by who the e-mail is for", () => {
    const customer = renderMail({ title: "T", blocks: [], audience: "customer" });
    expect(customer.html).toContain("My dashboard");
    expect(customer.text).toContain("/dashboard/support");
    const team = renderMail({ title: "T", blocks: [], audience: "team", adminUrl: "https://admin.waytaraenergy.com/" });
    expect(team.html).toContain("Admin app");
    expect(team.html).toContain('href="https://admin.waytaraenergy.com"');
    expect(team.html).not.toContain("My dashboard");
    const pub = renderMail({ title: "T", blocks: [], audience: "public" });
    expect(pub.html).toContain("Energy planner");
  });

  it("adds a hidden preview line only when one is given, and a rule for small screens", () => {
    expect(renderMail({ title: "T", blocks: [] }).html).not.toContain("display:none;max-height:0");
    const withPre = renderMail({ title: "T", blocks: [], preheader: "Works for 10 minutes." });
    expect(withPre.html).toContain("display:none;max-height:0");
    expect(withPre.html).toContain("Works for 10 minutes.");
    expect(withPre.html).toContain("max-width:480px");
  });

  it("uses the site address it is given for the logo, trimming a trailing slash", () => {
    const { html } = renderMail({ title: "T", blocks: [], siteUrl: "https://staging.example.com/" });
    expect(html).toContain("https://staging.example.com/images/logo.png");
  });
});

describe("escapeHtml", () => {
  it("escapes the four characters that matter", () => {
    expect(escapeHtml(`<a href="x">&</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;");
  });
});

describe("the look of the e-mail", () => {
  it("has no green rule above the title", () => {
    const { html } = renderMail({ title: "Your password code", blocks: [] });
    expect(html).not.toContain('width="40" height="4"');
  });

  it("shows a one-time code in its own centred box", () => {
    const { html } = renderMail({ title: "T", blocks: [{ type: "code", code: "482915" }] });
    const at = html.indexOf("482915");
    const before = html.slice(Math.max(0, at - 700), at);
    expect(before).toContain('align="center"');
    expect(before).toContain("border-radius:16px");
  });

  it("links Instagram and the office address, and says the sign-in place is approximate only where it is given", () => {
    const { html, text } = renderMail({ title: "T", blocks: [], audience: "customer" });
    expect(html).toContain("https://www.instagram.com/waytaraenergy");
    expect(text).toContain("Instagram: https://www.instagram.com/waytaraenergy");
    expect(html).toContain("google.com/maps/search");
  });
});
