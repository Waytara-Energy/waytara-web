# WayTara website: SEO, GEO and AEO plan

Written 2026-11-06. SEO is search-engine optimisation (Google, Bing). GEO is generative-engine optimisation (being named in answers from ChatGPT, Gemini, Perplexity, Copilot). AEO is answer-engine optimisation (being the quoted answer in Google's answer boxes and voice results). The three share one foundation: clear pages, honest facts, structured data, and other places on the web that mention WayTara the same way.

**Nobody can promise first place.** Rankings depend on competition and time. This plan makes WayTara easy to find, easy to understand and easy to quote, and it says how to measure progress.

## 1. Where we stand today

### Checked on the live site on 2026-11-06

| Check | Result |
|---|---|
| robots.txt | Live. Allows all public pages (search and AI crawlers), blocks dashboard, API, quote, invite and sign-in paths, and points to the sitemap. |
| sitemap.xml | Live, but listed only 14 pages. Missing: platform (/technology), planner, why-waytara, partner, support. **Fixed in code, goes live at the next deploy (19 pages).** |
| llms.txt | Live, but out of date. **Rewritten, goes live at the next deploy.** |
| Share card (the green card in WhatsApp) | Came from `opengraph-image.tsx`: a green gradient with a green dot and the word "WayTara" in plain text, not the logo. **Replaced with a designed card: real logo, brand font, headline, and the real dashboard.** |
| waytaraenergy.com without www | Serves the same page instead of redirecting to www. Search engines can treat the two as copies. The canonical tag points to www, which limits the harm, but a redirect is cleaner (hosting setting, see 4). |
| Google and web search for "waytaraenergy.com" and "WayTara Energy Chennai solar" | Two general web searches found nothing from the site. This is a hint, not proof: only Google Search Console can say what is indexed (see 4). |

### Already in the code

- Per-page title, description, canonical address, Open Graph and Twitter tags on every public page.
- Private areas (dashboard, sign-in, quote and invite links) are marked noindex and blocked in robots.txt.
- Structured data: Organization (now also LocalBusiness, with address, map point, phone, e-mail, Tamil Nadu and India as the area served, and the topics the company covers), WebSite, breadcrumbs on pages, FAQ and Service data on the solutions pages.
- Server-rendered pages (crawlers get real text, not a loading screen), `lang="en-IN"` (new), fast fonts and images, a web manifest, favicons.
- Vercel Web Analytics and Speed Insights (cookie-free).
- llms.txt for AI assistants.

### Changed in this round (needs a deploy)

- New share card (Open Graph and Twitter), with alt text.
- Sitemap complete, with today's date.
- Page titles shortened so they are not cut off in results, and written with the words people search with. Home description rewritten.
- LocalBusiness and "knows about" data on the organisation.
- `lang="en-IN"`.
- Search Console and Bing verification tags: set `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` and `NEXT_PUBLIC_BING_SITE_VERIFICATION` on the hosting once you have the tokens.

## 2. What to add: the pages people actually search for

Today the site has the product pages (solutions by property type, platform, planner, partner, support). It has almost none of the **question pages** that bring in someone who does not know WayTara yet. These are the gaps, in the order I would build them. Each page answers one question in its first two sentences (that is what answer boxes and AI assistants quote), then goes deeper, then ends with a short visible FAQ (so FAQ structured data is allowed) and a next step (planner or contact).

| Priority | Page (proposed address) | Searched as |
|---|---|---|
| 1 | **Built 2026-11-06.** Rooftop solar for homes, any state or city: size, what decides the cost, what is included (/solar-for-home; was /solar-for-home-chennai until 2026-11-11, now redirected) | solar panel price, rooftop solar for home, solar for home cost |
| 1 | **Built 2026-11-06.** On-grid, hybrid and off-grid solar explained, and which one to choose (/on-grid-hybrid-off-grid-solar) | on grid vs hybrid vs off grid, hybrid solar inverter, solar inverter types |
| 1 | **Built 2026-11-06.** Solar subsidy and net metering, any state: how it works, how to apply (/solar-subsidy; was /solar-subsidy-tamil-nadu until 2026-11-11, now redirected) | PM Surya Ghar subsidy, solar subsidy, net metering |
| 1 | **Built 2026-11-06.** Cut your electricity bill with solar and battery: how the tariff works (/reduce-electricity-bill-solar) | reduce electricity bill, solar tariff, how much can solar save |
| 2 | Battery backup for homes: solar battery versus an ordinary inverter battery (/solar-battery-backup-home) | solar battery backup, lithium battery for home, inverter battery vs solar battery |
| 2 | One app for solar, inverter, battery and EV charger (/solar-monitoring-app) | solar monitoring app, monitor inverter and battery, home energy management system |
| 2 | EV charger installation at home and in apartments (/ev-charger-installation) | EV charger for home Chennai, EV charging apartment, home EV charger cost |
| 2 | Energy management system (EMS) and charge-point management (CPMS) for businesses (/energy-management-system) | EMS for solar, OCPP charge point management, EV charging software India |
| 3 | For installers, EPC companies and channel partners (/partner already exists; add a "why partner" and "how it works" section with the questions installers ask) | solar installer partnership, EPC partner programme, channel partner solar India |
| 3 | Villa, apartment, factory, IT park pages (already built): add the "how much does it cost / what size do I need" answers | solar for villa, solar for apartment RWA, factory solar |
| 3 | Carbon report and what it means (/carbon-report-solar) | solar carbon footprint report, how much CO2 does solar save |
| 3 | City pages **only for places we really serve and can show work in** (Chennai first; then others as installs happen) | solar installation + city name |

Rules for all of them (same as the site's content rules): claim only what the product does; no prices we do not publish; no comparison with other companies by name; subsidies and savings stated as estimates and information, not promises.

**Notes on the four built pages.** One shared template (`GuidePage`, content in `src/data/guides.ts`): the answer first, an "In short" list, the detail, a visible FAQ, where to go next, and the date last checked. (Changed 2026-11-11: the four guides cover every state and city, so the place names, the Tamil Nadu-only figures and the Tanglish question forms were taken out; the layout now follows the other pages.) Each carries Article and FAQ structured data. They are in the sitemap, the footer ("Guides"), the site search and llms.txt. Facts: the central subsidy structure (₹30,000 per kW for the first 2 kW, ₹18,000 for the third, ₹78,000 cap) agreed across sources; State slab rates, free units and net-metering limits are **not** stated (they differ by state and sources conflict), and the pages say to check the state regulator or distribution company. Open for the team to confirm: whether WayTara is a registered vendor on the PM Surya Ghar portal (the subsidy page says "ask the installer to confirm in writing" and that the quotation states whether a project is under the scheme), and whether the quotation will really include subsidy and net-meter paperwork.

## 3. Words people use, including Tamil and Tanglish

These are the search patterns to cover. They are **starting hypotheses**, not measured volumes. Before writing, check each cluster in Google Search Console (once it has data), Google Keyword Planner and Google Trends for Tamil Nadu, and keep the ones people really type.

**Product and price (English, India)**: solar panel price in Chennai, rooftop solar Chennai, solar for home Tamil Nadu, 3 kW / 5 kW solar system cost, solar company in Chennai, best solar installer in Tamil Nadu, solar EPC company Chennai, solar installation near me.

**Inverter and battery**: hybrid inverter, on-grid vs off-grid vs hybrid solar, solar inverter price, solar battery backup for home, lithium (LFP) battery for home, solar plus battery, off-grid solar for villa or farm house.

**Tariff and bills**: TNPDCL (formerly TANGEDCO) tariff, EB bill calculator, how to reduce EB bill, net metering Tamil Nadu, time-of-day tariff for industry, solar payback period.

**Subsidy**: PM Surya Ghar Muft Bijli Yojana, solar subsidy Tamil Nadu, how to apply for rooftop solar subsidy, subsidy for 3 kW solar.

**Segments**: solar for villa, solar for apartment or RWA, solar for factory, solar for hospital or hotel, solar for IT park, solar for school.

**One connected system, monitoring and control**: solar monitoring app, monitor inverter battery and EV charger in one app, home energy management system (HEMS), smart energy automation, remote control of solar system, smart meter, load management for EV and solar.

**EV and charge-point management**: EV charger installation for home, EV charging for apartment, OCPP charger management, CPMS software India, EV fleet charging depot.

**Partners and trade**: solar installer partnership, EPC partner programme, channel partner for solar, solar dealer, software for solar installers, white-label energy monitoring.

**Tamil script (for Tamil pages and Tamil search)**: சோலார் பேனல் விலை (solar panel price), வீட்டிற்கு சோலார் (solar for home), சோலார் மானியம் (solar subsidy), மின் கட்டணம் குறைக்க (to reduce the electricity bill), சூரிய ஒளி மின்சாரம் (solar electricity), ஹைப்ரிட் இன்வெர்ட்டர் (hybrid inverter), பேட்டரி பேக்கப் (battery backup), மின்சார வாகன சார்ஜிங் (EV charging).

**Tanglish (Tamil written in English letters, as people type on a phone)**: solar panel vilai, veetukku solar, solar subsidy epdi vaangurathu, EB bill kammi panna, current bill kuraikka, solar potta evlo save aagum, inverter vs solar, solar roof Chennai, current poguthu battery backup. Spellings vary a lot, so treat these as a list to confirm, not to copy.

**How to use Tamil and Tanglish properly**

1. **Tanglish goes inside English pages**, as the questions in the FAQ and as phrases in headings ("EB bill kammi panna solar eppadi help pannum?"). People type it, and AI assistants match it to the English answer. It is never stuffed into a hidden list of keywords.
2. **Tamil script goes on real Tamil pages** under `/ta/...`, written (not machine-translated) by a native speaker, with `hreflang="ta-IN"` and `hreflang="en-IN"` pointing at each other. Start with the three highest-value pages: home solar, subsidy and net metering, and reducing the EB bill. Add Tamil only for the pages WayTara can actually support in Tamil (calls and messages), or say so on the page.
3. Add `availableLanguage: Tamil` to the structured data only when we really serve customers in Tamil.

## 4. What the team has to do (I cannot do these from the code)

1. **Google Search Console**: add the property for `https://www.waytaraenergy.com` (use the "URL prefix" type, or the domain type with a DNS record), verify (paste the token in the hosting setting named above), submit `https://www.waytaraenergy.com/sitemap.xml`. Then open **Pages**: it lists every page as indexed or not, with the reason. Use **URL inspection → Request indexing** for the home page and each new page. This is the only way to know "are all pages indexed".
2. **Bing Webmaster Tools**: same; it also feeds Copilot and several other assistants. Import the site from Search Console.
3. **Google Business Profile** for the Mylapore office (WayTara Energy LLP): claim and verify, categories "Solar energy company" and "Solar energy contractor", the address and map point already on the site, photos of real installs, services list, and ask every customer for a Google review. This is the biggest single lever for "near me" and Chennai searches.
4. **Redirect waytaraenergy.com to www.waytaraenergy.com** (permanent 301) in the domain settings of the hosting.
5. **The same name, address and phone everywhere**: LinkedIn company page, Instagram, YouTube, Facebook, JustDial, IndiaMART, Sulekha, solar and EV directories, and the partner and OEM websites that list installers. Then add the real profile addresses to `sameAs` in the structured data (I will, once you give the list).
6. **Proof the engines and assistants can quote**: real installed projects with place, size and date (with the customer's permission), customer reviews, partner and OEM listings, any press. The older built-in case studies in `solutions-data.ts` (for example a Bangalore villa and a Pune society) look like examples rather than real WayTara projects. Unless they are real and the customers agreed, they must not be shown as real, and I recommend checking them before this phase.
7. **Check that nothing blocks crawlers**: hosting firewall or bot protection must not block Googlebot, Bingbot or the AI crawlers (GPTBot, ClaudeBot, PerplexityBot, Google-Extended) if we want to be in their answers.

## 5. How to measure

- Search Console: impressions, clicks and average position for each cluster in section 3, by page; the Pages report for indexing.
- Bing Webmaster and Vercel Analytics: visits by page.
- Ask ChatGPT, Gemini, Perplexity and Copilot the same twelve questions every month ("best solar company in Chennai", "how to apply for solar subsidy in Tamil Nadu", "app to monitor solar, battery and EV charger") and write down whether WayTara is named.
- PageSpeed Insights on the home page, a solutions page and the planner (mobile): keep Core Web Vitals in the green.

## 6. Order of work

1. Deploy this round (share card, sitemap, titles, structured data). Do items 1, 2 and 4 of section 4 the same day.
2. Section 2 priority 1 pages (four pages), with Tanglish questions in their FAQs.
3. Google Business Profile, reviews and directory listings (section 4, items 3 and 5).
4. Priority 2 pages, the first Tamil pages, and `sameAs`.
5. Priority 3 pages and city pages as real installs appear.
6. Re-read Search Console after four to six weeks and rewrite whatever is not getting impressions.
