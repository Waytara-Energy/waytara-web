# WayTara website plan: landing page, solutions pages, energy planner and header

Status: **proposal for approval** (nothing in the app has been changed for this).
Source: the 14 PDFs of content-planning notes (Home pages 1-5, Apartment, Commercial, Industrial, EV Fleet / CPO, IT Parks and its corrections,
EV EMS integration capability, Energy Planner v3, Dashboard report generation). The PDFs are working notes from earlier sessions; where they flag a
point as "to verify", it is carried into section 10.

---

## 1. What the notes establish

**Who we are.** WayTara is an integrated energy and mobility company in Chennai. It does not only install solar and add a monitoring app: it brings
generation, storage, EV charging and energy management together through engineering, its own software and its own integration hardware.

**What we do: three capabilities**

| Name on the site | Customer-facing meaning | Who buys it |
|---|---|---|
| **EPC** (Build) | Design, supply, installation and commissioning of solar, battery storage and EV charging | New systems or expansions |
| **EV charging + CPMS** (Charge) | Install chargers and operate them with WayTara's OCPP charge-point management: sessions, access, billing, charging monetisation, load allocation | Homes, communities, fleets, operators, properties |
| **EMS** (Manage) | Connect compatible existing equipment (inverters, batteries, meters, chargers) to one dashboard; monitor and use supported controls | Anyone who already has equipment |

The strongest line from the notes: *"Build the energy system. Connect every asset. Manage how it works."* (Generate / Charge / Manage.)
Each of the three can be bought on its own, or together. EMS and CPMS are not add-ons to EPC; they have their own enquiry route.

**Who we serve: six segments** (the notes treat "builder / developer" as part of the apartment page)
Homes & Villas · Apartments, RWAs & Developers · Commercial & Workspaces · Factory & Industrial · EV Fleets & Charging Infrastructure ·
IT Parks & Campuses.

**What the notes say not to do** (applies to every page)
- No invented savings, payback, bill-reduction or "typical size" badges. Research figures are allowed only as labelled evidence, never as a promise.
- No ESP32, RS485, MQTT, SIM or "Modbus" on segment pages. They belong on the Platform page.
- Keep **monitoring, control and optimisation** apart. Only describe what is implemented for the equipment in question. "Automatic solar-surplus
  charging" and "battery-aware optimisation" are not advertised until built and validated.
- Existing-equipment customers must see themselves on every page ("already have solar or a charger? start here").

---

## 2. Message and vocabulary

One vocabulary everywhere:

| Term | Customer-facing meaning |
|---|---|
| EPC | Design and installation of energy infrastructure |
| EMS | Monitor and control connected energy equipment |
| CPMS | Operate and monetise EV charging infrastructure |
| WayTara Gateway | Connects compatible existing equipment to the platform |
| Smart charging | Manage charging around available power, schedules and energy priorities |
| Energy optimisation | Coordinate connected sources and loads (only where implemented) |

Every segment page ends with **two routes**: *new installation (EPC)* and *existing equipment (EMS / CPMS)*, each with its own enquiry.

---

## 3. Site map

| URL | Page | Note |
|---|---|---|
| `/` | Landing page | Minimal, story order (section 5) |
| `/solutions` | Solutions hub | Chooser: by property and by need (section 6) |
| `/solutions/home` | Homes & Villas | Existing slugs are kept, so no redirects and no SEO churn |
| `/solutions/apartment` | Apartments, RWAs & Developers | |
| `/solutions/commercial` | Commercial & Workspaces | |
| `/solutions/factory` | Factory & Industrial | |
| `/solutions/ev-fleet` | EV Fleets & Charging Infrastructure | `ev_fleet` stays as an alias |
| `/solutions/it-park` | IT Parks & Campuses | new route (the old page has no slug of its own) |
| `/planner` | Energy Planner (own page) | Replaces the planner section on the landing page (section 8) |
| `/why-waytara` | Why WayTara | Own page; today it is only a scroll anchor |
| `/about` | About Us (who we are, vision, team) | "Our Team" is merged here |
| `/technology` | Platform (gateway, EMS, CPMS) | Existing route, repurposed and renamed "Platform" in the header |
| `/contact` | Contact | Existing |
| footer only | Knowledge centre, Warranty, Terms, Privacy, Cookies | Existing |

---

## 4. Header

**You decided:** Solutions · Why WayTara · About Us, plus Contact, theme toggle and the Get Started button.

**Suggested header**

```
[logo]   Solutions ▾    Platform    Why WayTara    About Us          ☎ Contact   ◐ theme   [ Get Started ]
```

- **Solutions ▾** opens a two-column menu: *By property* (the six segments, one line each) and *By need* (Build, Charge, Manage, each linking to the
  relevant block), with "Not sure? Use the Energy Planner" at the foot.
- **Platform** is my addition: the notes recommend a dedicated technology page for EMS, CPMS and the gateway, and buyers of EMS/CPMS look for it.
  Drop it if you want exactly your three; the content would then live under Why WayTara.
- **Contact** stays as the phone icon (opens the contact page; numbers shown on hover/focus).
- **Get Started** goes to `/planner` (the one primary action across the site). On the planner page itself it becomes "Talk to us".
- Removed from the header: Home (the logo does that), Our Services (replaced by Solutions), How It Works (a landing section), Our Team (inside About).
- Behaviour kept from today: transparent with a white logo over the hero, solid after scrolling; mobile gets logo, theme and a menu sheet with the same
  items and Get Started at the bottom.

**Footer:** the six segments, Platform, Why WayTara, About, Contact, Knowledge centre, the policy pages, address and phone numbers.

---

## 5. Landing page: story order

The story: *the problem, the idea, what we do, proof, who it is for, how it works, where to start.* One idea per section, each at most one screen.

| # | Section | Job | Content (from the notes) | Visual | Action |
|---|---|---|---|---|---|
| 1 | **Hero** (built) | Promise | "Your property's energy, built as one system." Solar, battery storage and EV charging, designed, installed and managed together. | Cloud sky and house, scroll scene | Plan my system → `/planner` |
| 2 | **The idea** | Name the problem | Solar, storage and EV charging usually come from different vendors with different apps. WayTara builds and connects them as one system: **Generate · Charge · Manage**. | Three separate icons joining into one line | none |
| 3 | **What WayTara does** | The three offers | **Build** (EPC) · **Charge** (EV + CPMS) · **Manage** (EMS), each tagged "new systems" or "your existing equipment". | Three cards | Two small routes: "Plan a new system" and "Connect what I already have" |
| 4 | **One dashboard** | Proof | The live dashboard (today's tilting card). Caption: see supported equipment, manage what is supported, one place. | Product screenshot | none |
| 5 | **Who we serve** | Self-select | Six segment cards, one line each. | Segment photos (already in `public/images/segments`) | Each card → its segment page |
| 6 | **How a project works** | Reduce risk | Assess → Design → Install and integrate → Monitor and manage. "Already have equipment? Start at integrate." | Four-step line | none |
| 7 | **Where to start** | Convert | "Not sure what fits?" Three doors: Build, Manage, Charge. | Three buttons | → `/planner` |
| 8 | **Why WayTara** (strip) | Trust | Three one-liners: one accountable team; engineered per site, no generic sizing; works with equipment you already have. | Text strip | → `/why-waytara` |
| 9 | **Final call + footer** | Close | "Ready to run your energy as one system?" | none | Plan my system |

**Moves off the landing page:** Who We Are and Our Team (to About), the segment carousel (replaced by the six cards), the planner (own page),
Why-Integrated detail (to Why WayTara), Trust and FAQ (segment pages carry the FAQs). The hidden sections flag (`TEMP_HIDE_LANDING_SECTIONS`) is retired.

---

## 6. Solutions hub (`/solutions`)

- Heading: "Energy solutions for every kind of property."
- **By property:** six cards (same as landing, plus the two routes under each).
- **By need:** Build / Charge / Manage, each with a short explanation and "who it is for".
- A short "How to choose" help block linking to the planner.
- No packages, no prices, no sizing badges (the current page is package-based and is replaced).

---

## 7. Segment pages: one shared template, six variations

**Shared template** (each segment uses what applies, in this order):

1. Hero: eyebrow, headline, one paragraph, two CTAs (EPC route, EMS/CPMS route)
2. What matters to you (the segment's priorities, 3-4 cards)
3. What WayTara provides (EPC, charging/CPMS, EMS tiles as relevant)
4. Segment-specific block(s) (below)
5. Money and policy (carefully worded; segment-specific; no promises)
6. Evidence (research or third-party case studies, always labelled as such)
7. How a project works (5 steps) and what to prepare
8. FAQ (accordions)
9. Two enquiry routes (final)

A sticky in-page menu lets visitors jump between these on a long page.

**Per segment**

| | Headline | Hero CTAs | Segment-specific blocks | Money / policy | Evidence |
|---|---|---|---|---|---|
| **Homes & Villas** | Solar, battery backup and EV charging, designed around your home. | Plan a home energy system / Connect my existing system | Four benefits (use more of your own solar, keep essentials running, charge your EV at home, see and manage it in one place); choosing a setup (grid-connected solar vs solar + battery, off-grid as a note, EV note, anti-islanding note) | PM Surya Ghar; Tamil Nadu additional support (location-aware, never shown as nationwide); net metering vs net feed-in wording; one financing line | CEEW 53-73% reported bill reduction; AEEE/Kazam 80-90% of daily EV energy met by home charging (both labelled as research, not a guarantee) |
| **Apartments, RWAs & Developers** | Lower common-area energy costs. Build communities ready for what's next. | Get a community energy assessment / Discuss an upcoming development | Four benefits; three project types (Society Common Power; Community Backup & Energy Hub with DG integration; Community EV Charging with resident billing, access, load allocation); a distinct **developer** section ("energy-ready from day one": solar-ready roofs, EV-ready parking, backup, connected operations); two-stage quick enquiry and a "Community Energy Assessment" pack | PM Surya Ghar common-facilities assistance (RWA-specific, solar only, not batteries or chargers) | WRI India / TIDE: 8 of 10 studied complexes had enough rooftop potential; 45% of common load is water pumping |
| **Commercial & Workspaces** | Lower energy costs. Smarter buildings. | Assess my property / Explore EMS | Building priorities (cooling, lighting and shared systems, equipment, parking and EV); offices vs hospitals vs retail/hotels; four tiles (solar, storage, EV charging with paid/complimentary/tenant/visitor use, EMS); **CAPEX vs OPEX/PPA** project structures and the "who owns the roof" question | No residential subsidy; 40% WDV depreciation (explained as depreciation, not a grant); Tamil Nadu export settlement; open access for larger loads; energy benchmarking (EMS supports visibility, not a rating) | Chettinad Hospital 3.15 MWp and Parekh's Signature Mall 110 kWp, both labelled third-party reported |
| **Factory & Industrial** | Control energy costs. Protect critical production. | Assess my factory / Manage my existing plant | What matters on the factory floor; solar EPC, BESS integration, EMS (supported inverter parameters, not battery-BMS control); **when a battery makes sense** (peak demand, solar use, critical load, DG integration; kW vs kWh); a Tamil Nadu BESS policy block; EMS-only route for existing plants | Depreciation; open access; BEE PAT (EMS supports data, does not confer compliance); BESS policy is **not** a general battery subsidy | Asian Paints 800 kW with four DG sets (Tata Power reported) |
| **EV Fleets & Charging** | Charging that fits your fleet. One platform to run your network. | Plan a new charging site / Manage existing chargers | Three entry points (depots, public networks, existing networks); AC, DC and mixed charging; five design factors; smart load allocation diagram; solar and battery (and why overnight depots differ); **WayTara CPMS** as a prominent product; one-platform diagram (simplified); three business models (captive, public CPO, hosted/revenue share) and why utilisation drives revenue | India charging framework (de-licensed, LT connection up to 150 kW, connection timelines, tariff rules: link to the official guideline instead of printing a table); Tamil Nadu 20,000-station announcement as context only | none claimed |
| **IT Parks & Campuses** | One campus. A connected view of energy. | Request an EPC assessment / Request an EMS / CPMS assessment | Campus types (IT parks, data centres, universities, corporate); build and manage; connected-system diagram; campus charging (employee, visitor, tenant, fleet); **energy visibility and sustainability reporting** (energy and emissions estimates from connected data; **no** PUE, WUE or cooling-efficiency claims, per the correction note); new campus vs existing | ECBC / ECSBC check; green energy open access | none claimed |

---

## 8. Energy Planner (`/planner`)

Replaces the five-question solar-package planner with the **v3 adaptive flow**: it recommends the right *route* (EPC, EMS or CPMS) and gives a
preliminary blueprint without prices.

**Steps** (one question group per screen; skip what is not relevant; always allow "Not sure" and going back)

1. **What do you want help with?** (choose up to two): reduce bills with solar, add battery backup, install EV charging, upgrade or expand, monitor and control equipment I have, manage chargers or a charging site, not sure.
2. **Where will it be used?** Home / Apartment-RWA / Commercial / Factory / IT Park-Campus / EV Fleet-Charging Site / New Development.
3. **What equipment do you already have?** (solar, inverter, battery, EV charger, DG, meters, nothing yet, not sure) with small follow-ups only where they change the result.
4. **The requirement** (changes by path): usage as bill range, kWh or an optional bill upload for solar; for EMS, what they want to see or control; for CPMS, charger count, who uses them, and whether billing is needed.
5. **Only the relevant site questions**: backup (what must keep running), solar space, EV charging pattern, operating hours (commercial/industrial), site size (campus), shared facilities (apartments).
6. **Your Energy Blueprint**, then lead capture (never before the result).

**Blueprint layout (fixed order):** recommended solution · what it includes · why it fits · what is not included · existing equipment (keep / upgrade / check compatibility) · next step to the matching segment page and a prefilled enquiry.

**Rules from the notes:** deterministic rules with hard constraints (never present grid-connected solar as backup; do not add solar when space is unsuitable or unknown); city and pincode are asked in the enquiry, not before; **no** prices, payback, 25-year savings, CO₂ figures or backup-hour promises; Basic/Advanced/Premium labels stay internal; keep the dark, green, card-based look of the current planner.

**Outcomes and destinations**

| Result | Goes to | Enquiry |
|---|---|---|
| New solar / storage / EV (home) | Homes & Villas | EPC assessment |
| Common facilities, new development | Apartments, RWAs & Developers | Community assessment / design discussion |
| Commercial | Commercial & Workspaces | EPC assessment |
| Factory | Factory & Industrial | Industrial assessment |
| Campus | IT Parks & Campuses | Site assessment |
| Fleet / public charging | EV Fleets & Charging | Charging infrastructure assessment |
| Existing inverter / battery / meters | Platform | EMS compatibility enquiry |
| Existing OCPP chargers | EV Fleets & Charging | CPMS enquiry |
| Not enough information | Contact | Consultation |

**Funnel events to track** (added to the existing ones): `planner_route_selected`, `ems_interest_selected`, `cpms_interest_selected`, `segment_page_opened`, `compatibility_check_requested`, `blueprint_cta_clicked`.

---

## 9. Other pages

- **Why WayTara:** one accountable team and one system; engineering per site (no generic sizing); works with the equipment you already have; own software and hardware; what we will and will not promise. Evidence only where it can be sourced.
- **About Us:** who we are, vision / mission / goal, the team (the current Our Team content), where we are (Mylapore, Chennai).
- **Platform (`/technology`):** the one place for the technical story: gateway, EMS, CPMS, one architecture diagram, real dashboard screenshots, what is monitored vs controlled today, and a "compatibility check" form (equipment make and model, charger OCPP version).
- **Contact:** unchanged apart from a short routing hint (new installation / existing equipment / charging).
- **Later, not on the site yet:** BRSR and GHG data exports (energy ledger, Scope 2 pack, Scope 1 templates). They are a customer-dashboard feature, so they are not advertised until built; when they are, they feed the Industrial and IT Parks pages.

---

## 10. Enquiries and what reaches the team

Two routes on every page: **EPC** (new) and **EMS / CPMS** (existing). A short form (name, mobile, optional email, city or pincode, preferred next step), never gated before the planner result.
The enquiry should carry: goals and property type, existing equipment and keep/upgrade preference, usage information, backup / solar / EV / site answers, the blueprint and *why*, the route, the page it came from, notes and optional uploads (none mandatory).

Code impact: `/api/leads` today accepts only three segments and old planner fields (bill, roof type, package, solar kW). It needs six segments, a `route`, `goals`,
`existingEquipment`, a `blueprint` object and attachments. That includes a database change to `leads`, which I will ask you before running.

---

## 11. Claims to verify before anything is published

I could not check these (several are dated after my own knowledge). The notes flag a few themselves.

| Claim | Where | What to confirm |
|---|---|---|
| Tamil Nadu additional rooftop subsidy, up to Rs 1 lakh combined (G.O. (Ms) No.102, 19 Sep 2026) | Homes | The order and its conditions; **WayTara's TEDA empanelment** (needed to say WayTara can execute the subsidised installation) |
| Net metering vs net feed-in under TNERC Order 8/2021 | Homes, Commercial | Current rules for the customer's connection |
| Tamil Nadu BESS Policy 2026 (targets, 10% / 4 h rule, 10-year charge waiver, indigenous EMS) | Industrial | **Gazette publication and effective date**; that WayTara's EMS can meet any compliance claim (do not claim it yet) |
| RESCO / third-party funded solar | Commercial | Whether WayTara offers it directly |
| PM Surya Ghar RWA common-facilities rate and limits | Apartments | Current scheme criteria |
| Ministry of Power EV charging guidelines 2024 details; Tamil Nadu 20,000 stations | EV Fleets | Wording against the official documents |
| 40% WDV depreciation "under Income-tax Rules 2026" | Commercial, Industrial | Current provision, with a tax adviser |
| Case studies (Chettinad, Parekh's, Asian Paints) and research stats (CEEW, AEEE/Kazam, WRI) | several | Source links, and keep the "third-party / research, not a guarantee" labels |
| Supported inverter makes and models; supported chargers; remote start/stop/schedule; whether the gateway only reads or also writes; whether any automatic optimisation exists | Platform, all EMS/CPMS copy | What is **actually implemented**, since the copy depends on it |

---

## 12. Build order

1. **Foundation:** header, footer, shared section components and the segment-page template.
2. **Landing page:** sections 2 to 9 above (hero is done).
3. **Solutions hub and Homes & Villas** (the reference page for the template).
4. **The other five segment pages.**
5. **Energy Planner v3** and the enquiry changes.
6. **Why WayTara, About Us, Platform.**
7. **Clean-up:** retire the packages UI and the old planner, redirect old anchors, update the sitemap, metadata and structured data.

Real assets needed along the way: a dashboard screenshot per pillar, one clean gateway / architecture diagram, and photos for Homes, Apartments, Commercial, Industrial,
EV and Campus (six segment photos already exist).

## 13. Decisions needed from you

1. Header: keep **Platform** as a fourth item, or only your three?
2. **Get Started** goes to the planner: confirm.
3. Segment pages as one long scrolling page with a sticky in-page menu (recommended), or split into tabs?
4. Keep the existing segment URLs (recommended) or rename them?
5. Landing section 8 (the "Why WayTara" strip): keep or drop for an even shorter page?
