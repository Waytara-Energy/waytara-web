import { HEADER_MENUS, PLANNER_LINK, SOLUTION_SEGMENTS } from "@/config/site-nav";

// The header's search: a small index of the site's pages and sections, searched in the browser (no server, no external service). Each entry
// has a title, where it leads, a group for the label, and extra words people might type. Built from the same menu config as the header, so a page
// added to the menus is searchable without a second list.

export interface SearchEntry {
  title: string;
  href: string;
  group: string;
  /** Extra words that should find this entry. */
  keywords: string;
}

const EXTRA: SearchEntry[] = [
  { title: "Energy Planner", href: PLANNER_LINK.href, group: "Planner", keywords: "plan system quote blueprint start get started solar battery ev recommend" },
  { title: "Forgot password", href: "/forgot-password", group: "Support", keywords: "reset password cannot sign in login locked out code e-mail" },
  { title: "Sign in", href: "/login", group: "Account", keywords: "login log in account dashboard customer" },
  { title: "Raise a support ticket", href: "/support#ticket", group: "Support", keywords: "help problem issue complaint ticket doubt question" },
  { title: "Contact us", href: "/contact", group: "Contact", keywords: "phone call e-mail email address mylapore chennai reach talk" },
  { title: "Terms of Service", href: "/terms", group: "Legal", keywords: "terms conditions legal" },
  { title: "Privacy Policy", href: "/privacy", group: "Legal", keywords: "privacy data personal information" },
  { title: "Warranty Policy", href: "/warranty", group: "Legal", keywords: "warranty guarantee" },
  { title: "Cookie Policy", href: "/cookies", group: "Legal", keywords: "cookies tracking" },
  { title: "Solar for homes", href: "/solutions/home#benefits", group: "Solutions", keywords: "rooftop villa house subsidy pm surya ghar net metering" },
  { title: "Government support for homes", href: "/solutions/home#support", group: "Solutions", keywords: "subsidy pm surya ghar tamil nadu loan financing" },
  { title: "EV charger software (CPMS)", href: "/solutions/ev-fleet#cpms", group: "Solutions", keywords: "ocpp charge point management chargers sessions network cpo" },
  { title: "Battery storage for factories", href: "/solutions/factory#battery", group: "Solutions", keywords: "bess peak demand diesel generator dg backup industrial" },
];

/** Every searchable page and section. */
export const SEARCH_INDEX: SearchEntry[] = (() => {
  const seen = new Set<string>();
  const out: SearchEntry[] = [];
  const add = (e: SearchEntry) => {
    if (seen.has(e.href + e.title)) return;
    seen.add(e.href + e.title);
    out.push(e);
  };
  for (const seg of SOLUTION_SEGMENTS) add({ title: seg.label, href: seg.href, group: "Solutions", keywords: seg.blurb ?? "" });
  for (const menu of HEADER_MENUS) {
    add({ title: menu.label, href: menu.href, group: menu.label === "Solutions" ? "Solutions" : "Pages", keywords: menu.big.map((b) => b.label).join(" ") });
    if (menu.label === "Solutions") continue;
    for (const item of menu.big) add({ title: item.label, href: item.href, group: menu.label, keywords: item.blurb ?? "" });
  }
  for (const e of EXTRA) add(e);
  return out;
})();

/** What to show before anyone types: the places visitors most often want. */
export const QUICK_LINKS: SearchEntry[] = [
  { title: "Energy Planner", href: PLANNER_LINK.href, group: "Planner", keywords: "" },
  { title: "Solutions", href: "/solutions", group: "Solutions", keywords: "" },
  { title: "Platform", href: "/technology", group: "Pages", keywords: "" },
  { title: "Support", href: "/support", group: "Support", keywords: "" },
  { title: "Contact us", href: "/contact", group: "Contact", keywords: "" },
];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

/** Entries that match every word typed (a word matches the start of a title or keyword word, or sits inside the title), best first. */
export function searchSite(query: string, limit = 8): SearchEntry[] {
  const words = norm(query).split(" ").filter(Boolean);
  if (words.length === 0) return [];
  const scored: { entry: SearchEntry; score: number }[] = [];
  for (const entry of SEARCH_INDEX) {
    const title = norm(entry.title);
    const titleWords = title.split(" ");
    const keyWords = norm(entry.keywords).split(" ");
    let score = 0;
    let ok = true;
    for (const w of words) {
      if (title === w) score += 12;
      else if (titleWords.some((t) => t.startsWith(w))) score += 8;
      else if (title.includes(w)) score += 5;
      else if (keyWords.some((k) => k.startsWith(w))) score += 3;
      else {
        ok = false;
        break;
      }
    }
    if (ok) scored.push({ entry, score });
  }
  return scored.sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title)).slice(0, limit).map((s) => s.entry);
}
