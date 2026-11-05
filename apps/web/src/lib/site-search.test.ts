import { describe, expect, it } from "vitest";
import { QUICK_LINKS, SEARCH_INDEX, searchSite } from "./site-search";

describe("site search", () => {
  it("finds a page by its name", () => {
    expect(searchSite("platform")[0].href).toBe("/technology");
    expect(searchSite("factory")[0].href).toBe("/solutions/factory");
  });

  it("finds a section by words in its title or its description", () => {
    expect(searchSite("compatibility").some((e) => e.href === "/technology#compatibility")).toBe(true);
    expect(searchSite("subsidy").some((e) => e.href === "/solutions/home#support")).toBe(true);
  });

  it("finds sign-in help from what people actually type", () => {
    for (const q of ["forgot password", "login", "cannot sign in", "ticket", "help"]) {
      expect(searchSite(q).length, q).toBeGreaterThan(0);
    }
    expect(searchSite("forgot password")[0].href).toBe("/forgot-password");
  });

  it("needs every word to match, ignores case and punctuation, and returns nothing for nonsense or an empty box", () => {
    expect(searchSite("EV   Charging!!").length).toBeGreaterThan(0);
    expect(searchSite("zzzqqq")).toEqual([]);
    expect(searchSite("   ")).toEqual([]);
  });

  it("never returns more than the limit and has no duplicate entries", () => {
    expect(searchSite("a", 5).length).toBeLessThanOrEqual(5);
    const keys = SEARCH_INDEX.map((e) => e.href + e.title);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("every quick link and every indexed address is a real internal path", () => {
    for (const e of [...QUICK_LINKS, ...SEARCH_INDEX]) expect(e.href.startsWith("/"), e.href).toBe(true);
  });
});
