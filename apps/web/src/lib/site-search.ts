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
  { title: "Blog: straight answers", href: "/blog", group: "Blog", keywords: "blog guide guides help how to learn knowledge articles faq" },
  { title: "Solar guides", href: "/guides", group: "Guides", keywords: "guide guides solar home subsidy bill" },
  { title: "Partner terms", href: "/partner-terms", group: "Legal", keywords: "partner terms conditions agreement installer contractor policy" },
  { title: "Electrical contractor licence grades (EB, ESB, EA, ESA)", href: "/blog/licence-grades", group: "Blog", keywords: "tnelb licence license contractor eb esb ea esa electrical grade tamil nadu partner" },
  { title: "Wireman and Supervisor certificates", href: "/blog/competency-certificates", group: "Blog", keywords: "wireman supervisor certificate competency tnelb electrician" },
  { title: "Working under a licensed contractor", href: "/blog/working-under-a-contractor", group: "Blog", keywords: "licence contractor borrow installer partner solar ev team" },
  { title: "Partner documents and privacy", href: "/blog/partner-documents-and-privacy", group: "Blog", keywords: "documents aadhaar aadhar pan gst privacy partner onboarding verification" },
  { title: "The WayTara gateway", href: "/blog/waytara-gateway", group: "Blog", keywords: "gateway box rs485 modbus inverter battery meter connect integration" },
  { title: "Monitoring an existing solar system", href: "/blog/monitor-existing-solar", group: "Blog", keywords: "existing old system inverter integrate monitor deye replace" },
  { title: "Connecting an EV charger (OCPP)", href: "/blog/connect-ev-charger-ocpp", group: "Blog", keywords: "ev charger ocpp 1.6j cms charge point management" },
  { title: "OCPP 1.6J or 2.0.1", href: "/blog/ocpp-1-6-or-2-0-1", group: "Blog", keywords: "ocpp version 1.6 2.0.1 2.1 charger protocol compatible plug and charge iso 15118" },
  { title: "Why solar stops in a power cut", href: "/blog/why-solar-stops-in-a-power-cut", group: "Blog", keywords: "power cut outage blackout anti islanding on grid inverter shuts off backup battery hybrid cea" },
  { title: "Cleaning and caring for rooftop solar", href: "/blog/clean-and-maintain-rooftop-solar", group: "Blog", keywords: "clean panels wash dust bird droppings soiling maintenance inverter filter hot spot" },
  { title: "What good solar monitoring shows", href: "/blog/good-solar-monitoring", group: "Blog", keywords: "monitoring dashboard performance ratio availability alerts production expected output" },
  { title: "Solar for your home", href: "/solar-for-home", group: "Guides", keywords: "home villa house roof size how much roof space solar panel price cost rooftop" },
  { title: "On-grid, hybrid or off-grid solar", href: "/on-grid-hybrid-off-grid-solar", group: "Guides", keywords: "on grid hybrid off grid inverter battery power cut backup which to choose" },
  { title: "Solar subsidy and net metering", href: "/solar-subsidy", group: "Guides", keywords: "subsidy pm surya ghar muft bijli net metering apply discom state scheme" },
  { title: "PM Surya Ghar: Muft Bijli Yojana", href: "/pm-surya-ghar-muft-bijli-yojana", group: "Guides", keywords: "pm surya ghar muft bijli yojana scheme free electricity 300 units subsidy 78000 apply portal rwa housing society loan government" },
  { title: "Reduce your electricity bill with solar", href: "/reduce-electricity-bill-solar", group: "Guides", keywords: "electricity bill eb bill reduce save free units tariff" },
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
    if (menu.label === "Solutions" || menu.label === "Blog") continue; // their pages have their own entries, with search words
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
