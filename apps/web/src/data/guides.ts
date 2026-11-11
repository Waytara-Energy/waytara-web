import type { Faq } from "@/components/segments/faq-list";

/**
 * The guide pages: answers to the questions people type into search (and ask AI assistants) before they know WayTara. Each one gives its answer in the first two
 * sentences, then the detail, then a visible FAQ (which is also what the FAQ structured data is built from, so the two always match).
 *
 * Rules for writing here, the same as the rest of the site: only what is true and checked; no prices; no comparison with other companies; savings and subsidies
 * are estimates and information, never promises. Government rules and amounts change: every guide shows when it was last checked and points to the official source.
 */

export type GuideBlock =
  | { type: "p"; text: string }
  | { type: "list"; items: string[] }
  | { type: "steps"; items: { title: string; body: string }[] }
  | { type: "cols"; items: { title: string; body: string }[] }
  | { type: "compare"; columns: string[]; rows: { label: string; cells: string[] }[] }
  | { type: "note"; title: string; body: string };

export interface GuideSection {
  id: string;
  /** One line at the right of the section header (as on the other pages). */
  summary?: string;
  badge: string;
  title: string;
  accent?: string;
  blocks: GuideBlock[];
}

export interface Guide {
  slug: string;
  path: string;
  /** The title in search results (the site name is added after it). */
  metaTitle: string;
  metaDescription: string;
  /** The name in the breadcrumb and in lists of guides. */
  name: string;
  eyebrow: string;
  title: string;
  accent: string;
  /** The direct answer, in two sentences: shown under the headline and used by search and AI answers. */
  answer: string;
  /** Three or four lines: what the page comes down to. */
  inShort: string[];
  sections: GuideSection[];
  faqs: Faq[];
  /** The other guides to read next. */
  related: string[];
  /** ISO date of the last check, and how it reads on the page. */
  updated: string;
  updatedLabel: string;
}

const UPDATED = "2026-11-06";
const UPDATED_LABEL = "6 November 2026";

const solarForHome: Guide = {
  slug: "solar-for-home",
  path: "/solar-for-home",
  metaTitle: "Solar for Your Home: Size, Cost and Steps",
  metaDescription:
    "How rooftop solar works for a home or villa: what size you need, what decides the cost, what is included, the steps from enquiry to switch-on, and how to start.",
  name: "Solar for your home",
  eyebrow: "Guide · Homes and villas",
  title: "Solar for your home,",
  accent: "sized to your roof.",
  answer:
    "Rooftop solar for a home means panels on your roof, an inverter, and a connection to the grid, sized from your electricity use and your free roof space. WayTara designs, supplies and installs the system and shows it, with your battery and EV charger if you have them, on one dashboard.",
  inShort: [
    "A home system is panels, an inverter, mounting, cabling and protection, and optionally a battery and an EV charger.",
    "As a rough rule, each kilowatt (kW) of panels needs about 100 square feet of roof in the sun.",
    "The cost depends on size, the equipment you choose, your roof and your site, so it comes as an itemised quotation, not a standard price.",
    "Equipment carries the manufacturer's warranty. Savings and generation figures are estimates, not guarantees.",
  ],
  sections: [
    {
      id: "included",
      summary: "Panels, an inverter, mounting and protection, and your choice of battery and charger.",
      badge: "What you get",
      title: "What is in a",
      accent: "home solar system.",
      blocks: [
        {
          type: "list",
          items: [
            "Solar panels on your roof, on a mounting structure that suits your roof type (flat concrete, tiled or sloping, or metal sheet).",
            "An inverter, which turns the panels' power into power your home can use. It is either an on-grid inverter or a hybrid inverter that can also run a battery.",
            "Cabling, protection devices and earthing, fitted to the electrical code and the distribution company's requirements.",
            "Optionally, a battery for backup and for using your own solar power in the evening, and an EV charger.",
            "The WayTara gateway and dashboard, so you can see generation, use, battery and charger in one place.",
            "The paperwork for the net meter and for a subsidy, where your quotation says we handle it.",
          ],
        },
        {
          type: "p",
          text: "The quotation lists exactly what is included, item by item. Anything not on it is not part of the price.",
        },
      ],
    },
    {
      id: "size",
      summary: "Start from your bill and your free roof space; the planner and an engineer confirm the rest.",
      badge: "How big",
      title: "How big a system",
      accent: "does your home need?",
      blocks: [
        {
          type: "p",
          text: "Start from your electricity bill. Look at the units used in a billing period, and divide by the number of days to get units a day. These are rules of thumb, not a design:",
        },
        {
          type: "list",
          items: [
            "Roof space: about 100 square feet (roughly 10 square metres) of shadow-free roof for each kW of panels.",
            "Generation: across most of India, 1 kW of panels often gives around 4 units (kWh) a day over a year. It is more in the sunniest regions and the dry months, less in the monsoon, and it falls with shade, dust and a poor roof angle.",
            "Example of the arithmetic: a home using about 360 units a month uses about 12 units a day, which on paper is about 3 kW of panels. Most homes choose a size from their roof space and budget, not to cover every unit.",
          ],
        },
        {
          type: "p",
          text: "Your own figures come from a design for your roof. The energy planner gives you a first blueprint in a few minutes, and an engineer confirms it.",
        },
      ],
    },
    {
      id: "cost",
      summary: "Size, equipment, roof and extras decide the quotation, not a standard price.",
      badge: "What decides the cost",
      title: "What makes one quotation",
      accent: "different from another.",
      blocks: [
        {
          type: "list",
          items: [
            "Size: the kW of panels, and so the number of panels and the area they cover.",
            "The equipment: the panels' and inverter's make and quality.",
            "On-grid or hybrid: a hybrid inverter and a battery cost more than an on-grid system without one. See on-grid, hybrid and off-grid solar.",
            "The battery: how many kWh of storage, if any.",
            "Your roof and site: the type of roof, the height, the distance from the panels to the inverter and meter, and any work to make the roof ready.",
            "Extras: an EV charger, the dashboard plan, extended warranty cover.",
            "The subsidy: it is paid by the government to you, after installation, and does not change the quotation price. See the solar subsidy guide.",
          ],
        },
      ],
    },
    {
      id: "steps",
      summary: "Six steps, and we tell you early about anything that can move the date.",
      badge: "How it works",
      title: "From enquiry to",
      accent: "switch-on.",
      blocks: [
        {
          type: "steps",
          items: [
            { title: "Tell us about your home", body: "Use the energy planner: your property, your roof type and what you want. You get a first blueprint." },
            { title: "We design it for your roof", body: "An engineer confirms the design. A site visit or extra details may be needed first." },
            { title: "You get a quotation", body: "It lists the equipment, services, taxes and total. You accept it, ask for a change, or decline." },
            { title: "Approvals and paperwork", body: "Some work needs approval from the distribution company or your housing society. We tell you which, and what we handle." },
            { title: "Installation", body: "Our team installs the system on the agreed date. Weather and approvals can move it, and we tell you early if they do." },
            { title: "Net meter and switch-on", body: "The system is connected, tested and commissioned. You then see it on your dashboard." },
          ],
        },
      ],
    },
    {
      id: "other-homes",
      summary: "Villas and flats are done differently, so each has its own page.",
      badge: "Other kinds of home",
      title: "Villa, flat or",
      accent: "gated community?",
      blocks: [
        {
          type: "p",
          text: "A villa or independent house usually has its own roof and meter. A flat has shared roof space, so it is usually done for the whole building or community, with its own design and approvals. We have a page for each.",
        },
      ],
    },
  ],
  faqs: [
    {
      question: "How much roof space do I need for solar?",
      answer:
        "As a rough rule, about 100 square feet of shadow-free roof for each kW of panels. A 3 kW system needs about 300 square feet. Shade from trees, water tanks or the next building matters as much as the area, so a design for your roof confirms it.",
    },
    {
      question: "Will solar work during a power cut?",
      answer:
        "An on-grid system stops when the grid goes off, for safety, even in sunshine. A hybrid system with a battery can keep running what you choose to back up, for as long as the battery and the sun allow. Tell us what you want to keep running in a power cut, and we design for it.",
    },
    {
      question: "How much will I save?",
      answer:
        "It depends on how many units you use, your tariff, the size of the system and the sunshine at your roof. Some states also give households free or subsidised units each billing period, which affects the saving. We give an estimate, never a guarantee. See how solar reduces your electricity bill.",
    },
    {
      question: "Is my roof suitable?",
      answer:
        "Most roofs are: flat concrete roofs, tiled or sloping roofs and metal sheet roofs can all take solar with the right mounting. The roof must be sound, and the panels need sun for most of the day. The planner asks for your roof type, and an engineer confirms it.",
    },
    {
      question: "Where do you install?",
      answer:
        "WayTara works across India. Put your location in the planner or contact us, and we confirm whether and how we can serve it.",
    },
    {
      question: "What warranty do I get?",
      answer:
        "The equipment carries the manufacturer's warranty, on the manufacturer's terms. WayTara gives no warranty of its own on top of that unless you buy extended cover, which is priced separately and written down. See the Warranty Policy.",
    },
  ],
  related: ["on-grid-hybrid-off-grid-solar", "solar-subsidy", "reduce-electricity-bill-solar"],
  updated: UPDATED,
  updatedLabel: UPDATED_LABEL,
};

const gridTypes: Guide = {
  slug: "on-grid-hybrid-off-grid-solar",
  path: "/on-grid-hybrid-off-grid-solar",
  metaTitle: "On-Grid vs Hybrid vs Off-Grid Solar",
  metaDescription:
    "On-grid, hybrid and off-grid solar compared in plain words: what each one is, what happens in a power cut, whether it works with net metering and the subsidy, and how to choose for your home or business.",
  name: "On-grid, hybrid and off-grid solar",
  eyebrow: "Guide · Choosing a system",
  title: "On-grid, hybrid or off-grid:",
  accent: "which solar is right?",
  answer:
    "On-grid solar has no battery and works together with the grid, hybrid solar adds a battery for backup and for evening use, and off-grid solar has no grid connection at all. If the grid reaches you, most homes and businesses choose on-grid for the lowest set-up cost or hybrid when power cuts or evening use matter.",
  inShort: [
    "On-grid: no battery, lowest set-up cost, and it switches off in a power cut.",
    "Hybrid: solar plus a battery plus the grid. It can keep chosen loads running in a power cut and use your solar in the evening.",
    "Off-grid: no grid connection. For places the grid does not reach, and sized with a larger battery.",
    "Net metering and the central subsidy are for grid-connected systems, so they do not apply to off-grid.",
  ],
  sections: [
    {
      id: "compare",
      summary: "Whether you have a battery, and what happens in a power cut, are the big differences.",
      badge: "Side by side",
      title: "The three types,",
      accent: "compared.",
      blocks: [
        {
          type: "compare",
          columns: ["On-grid", "Hybrid", "Off-grid"],
          rows: [
            { label: "Connected to the grid", cells: ["Yes", "Yes", "No"] },
            { label: "Has a battery", cells: ["No", "Yes", "Yes"] },
            { label: "In a power cut", cells: ["Switches off, for safety", "Keeps running what the battery and inverter can supply", "Runs on solar and battery, as it is the only source"] },
            { label: "Uses solar at night", cells: ["No", "Yes, from the battery", "Yes, from the battery"] },
            { label: "Net metering", cells: ["Yes", "Yes, if grid-connected and approved", "No"] },
            { label: "Central subsidy", cells: ["Can be eligible", "Depends on the design; ask us", "No: the subsidy is for grid-connected rooftop solar"] },
            { label: "Suits", cells: ["A reliable grid and mostly daytime use", "Frequent power cuts, evening use, or backup for chosen loads", "Farms and sites with no grid"] },
          ],
        },
      ],
    },
    {
      id: "how",
      summary: "How power moves through each type of system.",
      badge: "How each one works",
      title: "What happens",
      accent: "inside each system.",
      blocks: [
        {
          type: "cols",
          items: [
            { title: "On-grid", body: "Panels feed an on-grid inverter. Your home uses the solar power first and takes any shortfall from the grid. Extra power goes to the grid and is recorded by the net meter. When the grid fails, the inverter has to switch off by design, so that no power is pushed into lines that workers may be repairing. That is why an on-grid system gives no backup." },
            { title: "Hybrid", body: "A hybrid inverter manages the panels, the battery and the grid together. Solar power runs the home and charges the battery, the battery supplies the home when the sun is down or the grid is off, and the grid fills any gap. You choose which loads are backed up (for example lights, fans, the fridge and the router) and size the battery for how long you want them to run." },
            { title: "Off-grid", body: "Panels, a battery and an inverter, with no grid. Everything you use must come from the panels and battery, so the system is sized for your worst days, and a generator is sometimes added as a last resort." },
          ],
        },
      ],
    },
    {
      id: "choose",
      summary: "Answer these and the right type usually becomes clear.",
      badge: "How to choose",
      title: "Five questions",
      accent: "that decide it.",
      blocks: [
        {
          type: "steps",
          items: [
            { title: "Does the grid reach you, and how often does it fail?", body: "If it is reliable, on-grid may be enough. If cuts are frequent, or backup matters, look at hybrid." },
            { title: "When do you use most of your power?", body: "Mostly in the day (an office, a shop, work from home): on-grid fits well. Mostly in the evening and night: a battery lets you use your own solar then." },
            { title: "Is there a time-of-day or peak tariff on your connection?", body: "Industrial and commercial tariffs often charge more at peak hours. Solar and a battery can reduce what you draw then." },
            { title: "Do you want backup, and for what?", body: "List what must keep running in a power cut and for how long. That decides the battery size." },
            { title: "Do you want the subsidy?", body: "The central subsidy is for grid-connected rooftop solar. Ask us whether your hybrid design is covered before you decide." },
          ],
        },
        {
          type: "note",
          title: "Start with a hybrid inverter, add the battery later",
          body: "A hybrid inverter can be installed first, and a battery added later when you are ready, if the design allows it. Ask us about it when you plan.",
        },
      ],
    },
    {
      id: "monitoring",
      summary: "The dashboard works the same whichever type you pick.",
      badge: "Monitoring and control",
      title: "Whichever you choose,",
      accent: "see it in one place.",
      blocks: [
        {
          type: "p",
          text: "The WayTara platform brings the inverter, battery, meter and EV charger into one dashboard. Deye hybrid inverters are supported today, and other makes and models are assessed and added after testing. See how the platform connects your equipment.",
        },
      ],
    },
  ],
  faqs: [
    {
      question: "Do I need a battery with on-grid solar?",
      answer:
        "No. An on-grid system works without a battery and has the lowest set-up cost. The trade-off is that it switches off in a power cut. A battery is what gives backup and evening use, which is what a hybrid system adds.",
    },
    {
      question: "What is a hybrid inverter?",
      answer:
        "A hybrid inverter manages your solar panels, a battery and the grid in one unit. It can run your home from solar, store extra power in the battery, and supply chosen loads from the battery when the grid is off. The battery can often be added after installation.",
    },
    {
      question: "Is off-grid solar right for my home?",
      answer:
        "Only if the grid does not reach you, or you choose to be independent of it. Off-grid needs a larger battery and careful sizing, costs more for the same load, and cannot use net metering or the central rooftop subsidy. If the grid is available, on-grid or hybrid is usually the better fit.",
    },
    {
      question: "Will my on-grid solar work in a power cut?",
      answer:
        "No. It stops when the grid goes off, even in full sun, so that no power flows into lines being repaired. For backup you need a hybrid system with a battery.",
    },
    {
      question: "Can I change from on-grid to hybrid later?",
      answer:
        "Often, yes. It depends on the inverter. Some on-grid inverters cannot take a battery, so the usual route is to install a hybrid inverter first and add the battery later. Tell us in the planner that you may want backup, and we design for it.",
    },
    {
      question: "Which one gives the lowest electricity bill?",
      answer:
        "It depends on your use and tariff. On-grid gives the lowest set-up cost per unit of solar. Hybrid lets you use more of your own solar in the evening, which can matter on peak tariffs. We give estimates for your case and never guarantee savings.",
    },
  ],
  related: ["solar-for-home", "solar-subsidy", "reduce-electricity-bill-solar"],
  updated: UPDATED,
  updatedLabel: UPDATED_LABEL,
};

const subsidy: Guide = {
  slug: "solar-subsidy",
  path: "/solar-subsidy",
  metaTitle: "Solar Subsidy in India: PM Surya Ghar",
  metaDescription:
    "How the central PM Surya Ghar: Muft Bijli Yojana subsidy works for rooftop solar in India: how much per kW, who can apply, the steps, how net metering fits in, and what WayTara does and does not promise.",
  name: "Solar subsidy and net metering",
  eyebrow: "Guide · Subsidy and net metering",
  title: "Solar subsidy and",
  accent: "net metering, explained.",
  answer:
    "Households across India can apply for the central PM Surya Ghar: Muft Bijli Yojana subsidy on grid-connected rooftop solar: ₹30,000 for each of the first 2 kW and ₹18,000 for the third kW, up to ₹78,000 in total. The government pays it after your system is installed and inspected; it is not a discount from WayTara, and nobody can promise its approval or timing.",
  inShort: [
    "The central subsidy is ₹30,000 per kW for the first 2 kW and ₹18,000 for the third kW, so ₹60,000 for 2 kW and ₹78,000 for 3 kW or more.",
    "It is for residential, grid-connected rooftop solar. You apply on the national portal, pmsuryaghar.gov.in.",
    "It is paid by the government to you after installation and inspection. WayTara does not pay it and cannot promise approval or a date.",
    "Net metering lets the units you send to the grid be adjusted against the units you take. The rules are set by the electricity regulator and can change.",
  ],
  sections: [
    {
      id: "amount",
      summary: "The central figures as last checked, and why to confirm them on the portal.",
      badge: "How much",
      title: "The central subsidy,",
      accent: "in numbers.",
      blocks: [
        {
          type: "compare",
          columns: ["Central subsidy"],
          rows: [
            { label: "1 kW", cells: ["₹30,000"] },
            { label: "2 kW", cells: ["₹60,000"] },
            { label: "3 kW and above", cells: ["₹78,000 (the most any household gets)"] },
          ],
        },
        {
          type: "p",
          text: "The government states the subsidy as a share of a benchmark system cost: 60% for the first 2 kW and 40% of the cost of the third kW. At the benchmark prices it has set, that gives the amounts above. A bigger system than 3 kW does not get more central subsidy; the cap is ₹78,000. These are the figures we last checked, on 6 November 2026, against the government's announcement. The government can revise them, so confirm today's figures on pmsuryaghar.gov.in before you decide.",
        },
        {
          type: "note",
          title: "State schemes",
          body: "Many states and union territories add their own incentives or rules for rooftop solar, and they change. Ask your state's nodal agency or your electricity distribution company what is open in your state now. We will tell you what we know, but the authority's own word is the one that counts.",
        },
      ],
    },
    {
      id: "who",
      summary: "Residential, grid-connected rooftop solar; the portal sets the exact rules.",
      badge: "Who can apply",
      title: "Who the subsidy",
      accent: "is for.",
      blocks: [
        {
          type: "list",
          items: [
            "Households (residential electricity connections) that want to install grid-connected rooftop solar.",
            "A roof that can take the panels, with a valid electricity connection in your name or the owner's.",
            "The subsidy is for residential consumers. Businesses and factories are not covered by this scheme.",
            "Off-grid systems are not covered: the subsidy is for grid-connected rooftop solar.",
          ],
        },
        {
          type: "p",
          text: "The portal sets the exact rules, including the equipment and installer requirements, and they can change.",
        },
      ],
    },
    {
      id: "steps",
      summary: "The outline of the process, with the portal as the final word.",
      badge: "How to apply",
      title: "The steps,",
      accent: "in outline.",
      blocks: [
        {
          type: "steps",
          items: [
            { title: "Register on the national portal", body: "At pmsuryaghar.gov.in, choose your state and your electricity distribution company (discom) and enter your consumer number." },
            { title: "Apply for rooftop solar", body: "Submit your application on the portal. The distribution company checks that your connection and roof can take the system." },
            { title: "Install through a vendor registered for the scheme", body: "The installation must be done by a vendor registered on the portal. Ask any installer, including us, to confirm this in writing before you sign." },
            { title: "Net meter and inspection", body: "After installation, the net meter is fitted and the system is inspected and commissioned." },
            { title: "Submit the commissioning details and your bank details", body: "On the portal. The subsidy is then paid by the government into your bank account." },
          ],
        },
        {
          type: "p",
          text: "This is an outline of how the process has worked. The portal's screens and steps change, so the portal is always the authority.",
        },
      ],
    },
    {
      id: "net-metering",
      summary: "How the units you send to the grid are adjusted against the units you take.",
      badge: "Net metering",
      title: "What net metering",
      accent: "means for you.",
      blocks: [
        {
          type: "p",
          text: "A net meter records the units your system sends to the grid and the units you take from it. The units you send are adjusted against the units you take, so you pay for the difference. It applies to grid-connected systems (on-grid, and hybrid when it is connected and approved).",
        },
        {
          type: "p",
          text: "The detailed rules, such as the limits and how often the credit is settled, are set by your state's electricity regulator and your distribution company, and they have changed over time. We tell you what applies to your connection when we design your system.",
        },
      ],
    },
    {
      id: "waytara",
      summary: "What we help with, and what only the authority can decide.",
      badge: "What WayTara does",
      title: "What we do, and",
      accent: "what we do not promise.",
      blocks: [
        {
          type: "list",
          items: [
            "We give you information about the subsidy and net metering, and we tell you how they apply to your project.",
            "Where your quotation says so, we help prepare and submit the paperwork, using the information and documents you give us. You are responsible for their being true and complete.",
            "The subsidy is not a discount from WayTara. The price in your quotation does not depend on whether a subsidy is approved, unless the quotation says otherwise in writing.",
            "We do not promise that you qualify, that your application will be approved, or when the money will reach you.",
            "What we say here is general information, not legal, tax or financial advice.",
          ],
        },
      ],
    },
  ],
  faqs: [
    {
      question: "How do I get the solar subsidy?",
      answer:
        "Register and apply on the national portal, pmsuryaghar.gov.in, choosing your state and your electricity distribution company. Install through a vendor registered for the scheme, have the net meter fitted and the system inspected, and submit your bank details. The government then pays the subsidy into your account.",
    },
    {
      question: "How much subsidy will I get?",
      answer:
        "The central subsidy is ₹30,000 for each of the first 2 kW and ₹18,000 for the third kW, so ₹60,000 for a 2 kW system and ₹78,000 for 3 kW or more, which is the most a household gets. Amounts can be revised, so check the official portal for today's figures.",
    },
    {
      question: "When will the subsidy money come?",
      answer:
        "It is paid by the government after your system is installed, commissioned and inspected, and your details are submitted. WayTara does not pay it and cannot promise a date. Plan your budget so that you do not depend on the subsidy arriving at a particular time.",
    },
    {
      question: "Can a business or factory get this subsidy?",
      answer:
        "No. The PM Surya Ghar subsidy is for residential households. Other benefits may exist for commercial and industrial solar, so ask a tax adviser and us about your case.",
    },
    {
      question: "Do I get the subsidy with a battery or an off-grid system?",
      answer:
        "The subsidy is for grid-connected rooftop solar, so off-grid systems are not covered. For a hybrid system with a battery, whether the design qualifies depends on the scheme's rules. Ask us before you decide, and we will tell you plainly.",
    },
    {
      question: "Does WayTara handle the subsidy application?",
      answer:
        "Where your quotation says so, we help prepare and submit the paperwork. Whether a project is done under the scheme, and what we handle, is written in the quotation, so there are no surprises. The approval is always the authority's decision.",
    },
  ],
  related: ["pm-surya-ghar-muft-bijli-yojana", "solar-for-home", "reduce-electricity-bill-solar"],
  updated: UPDATED,
  updatedLabel: UPDATED_LABEL,
};

const bill: Guide = {
  slug: "reduce-electricity-bill-solar",
  path: "/reduce-electricity-bill-solar",
  metaTitle: "Reduce Your Electricity Bill with Solar",
  metaDescription:
    "How solar, net metering and a battery reduce an electricity bill, why any free units matter, who saves the most, and how to work out whether solar makes sense for your home or business.",
  name: "Reduce your electricity bill with solar",
  eyebrow: "Guide · Electricity bills",
  title: "Reduce your electricity bill",
  accent: "with solar and battery.",
  answer:
    "Solar cuts your bill by producing power in the day so you draw fewer units from the grid, net metering adjusts the extra you send back, and a battery lets you use more of your own power in the evening. How much you save depends on your tariff and how many units you use, because many states give households some free or subsidised units.",
  inShort: [
    "Your bill follows the units you take from the grid. Solar reduces those units.",
    "Many states give households some free or subsidised units each billing period, so a home that uses few units pays little already and has less to save.",
    "Solar helps most when you use well above any free units: larger homes, air-conditioning, EV charging, shops, offices and factories.",
    "Savings are estimates, never guarantees. A design for your own bills gives the real answer.",
  ],
  sections: [
    {
      id: "how",
      summary: "Your bill follows the units you take from the grid, and your tariff.",
      badge: "How the bill is made",
      title: "What your bill",
      accent: "is based on.",
      blocks: [
        {
          type: "p",
          text: "A household bill is based on the units (kWh) you use in each billing period, charged by slab after the free units. A business or factory has a different tariff, often with higher rates at peak hours and charges for the highest power you draw (demand charges).",
        },
        {
          type: "note",
          title: "Free or subsidised units",
          body: "Some states give domestic consumers free or subsidised units in each billing period. The number differs from state to state, and the rules and rates are set by the state regulator and change, so check your latest bill for what applies to you.",
        },
        {
          type: "p",
          text: "This is why solar does not suit every home. If you use few units and your state gives free units, most of your bill may already be covered, so there is little left for solar to save.",
        },
      ],
    },
    {
      id: "ways",
      summary: "Four things that bring the bill down, from panels to better use.",
      badge: "Four ways it reduces a bill",
      title: "Where the saving",
      accent: "comes from.",
      blocks: [
        {
          type: "steps",
          items: [
            { title: "Solar covers your daytime use", body: "Power from your panels runs your home first, so you take fewer units from the grid." },
            { title: "Net metering credits what you send back", body: "Extra power goes to the grid, and the units are adjusted against the units you take. See the solar subsidy guide for how it works." },
            { title: "A battery moves solar to the evening", body: "Panels produce in the day, but many homes use most power in the evening. A battery stores the day's extra and supplies it later, which matters most on tariffs that cost more at peak hours." },
            { title: "Seeing your power use helps you use less", body: "The WayTara dashboard shows what your system produces and your home uses, with alerts and reports, and supported settings can be scheduled. Running heavy loads, and charging an EV, in the sunny hours uses your own power." },
          ],
        },
      ],
    },
    {
      id: "who",
      summary: "Solar helps most where use is high and mostly in the day.",
      badge: "Who saves the most",
      title: "Is solar worth it",
      accent: "for you?",
      blocks: [
        {
          type: "list",
          items: [
            "Homes using well above any free units: large homes, several air-conditioners, an EV charged at home.",
            "Shops, offices, clinics and institutions that use power mostly in the day.",
            "Factories and large buildings with peak-hour rates or demand charges, where a battery can reduce what is drawn at peak.",
            "Housing societies with common loads such as lifts, pumps and lighting.",
          ],
        },
        {
          type: "p",
          text: "If your use is small, or mostly within any free units, solar may still make sense for backup (with a battery) or for the long term, but the bill saving alone will be modest. We will tell you that plainly.",
        },
      ],
    },
    {
      id: "estimate",
      summary: "Three steps to a first figure before you ask for a design.",
      badge: "A first estimate",
      title: "Work out a first",
      accent: "estimate yourself.",
      blocks: [
        {
          type: "steps",
          items: [
            { title: "Find your units", body: "Look at the units used on your last few bills. Divide by the days in the billing period to get units a day." },
            { title: "Estimate what panels give", body: "As a rule of thumb, 1 kW of panels gives around 4 units a day across most of India over a year. So 3 kW is about 12 units a day, or roughly 360 units a month." },
            { title: "Compare, then ask for a design", body: "If the panels' units are well above any free units, there is something to save. A design that uses your own bills, roof and tariff gives the real figure." },
          ],
        },
      ],
    },
  ],
  faqs: [
    {
      question: "How does solar reduce my electricity bill?",
      answer:
        "Your panels produce power in the daytime, so you take fewer units from the grid. Net metering adjusts the extra you send back against the units you take. A battery lets you use your own power in the evening too. Your bill falls with the units you no longer draw.",
    },
    {
      question: "I get free units. Do I still need solar?",
      answer:
        "If you use only a few units, the free units already cover most of your bill, so the saving from solar is small. Solar helps most when you use well above them. It can still make sense for backup, or for an EV charger, but we will tell you honestly if the saving is modest.",
    },
    {
      question: "Will a battery reduce my bill further?",
      answer:
        "Sometimes. A battery lets you use your own solar in the evening instead of taking power from the grid then. It helps most when you use a lot of power in the evening, or when your tariff charges more at peak hours. Its main job is backup in a power cut.",
    },
    {
      question: "Can you guarantee how much I will save?",
      answer:
        "No. Savings depend on your use, your tariff, the sunshine and the equipment, and tariffs change. We give an estimate from your own bills and roof, and it is an estimate, never a guarantee. See our Terms of Service.",
    },
    {
      question: "Does solar help a factory or a shop?",
      answer:
        "Often, yes, because they use power mostly in the day, when panels produce. Commercial and industrial tariffs also have peak-hour rates and demand charges, where solar and a battery can reduce what is drawn. We assess your tariff and your load before recommending anything.",
    },
    {
      question: "How do I know if my system is saving what was estimated?",
      answer:
        "The WayTara dashboard shows what your system generates and your home uses, and reports show the figures over time. Real results differ from estimates, because sunshine, shade and how you use power change.",
    },
  ],
  related: ["solar-for-home", "solar-subsidy", "on-grid-hybrid-off-grid-solar"],
  updated: UPDATED,
  updatedLabel: UPDATED_LABEL,
};

const scheme: Guide = {
  slug: "pm-surya-ghar-muft-bijli-yojana",
  path: "/pm-surya-ghar-muft-bijli-yojana",
  metaTitle: "PM Surya Ghar Muft Bijli Yojana: Explained",
  metaDescription:
    "What the PM Surya Ghar: Muft Bijli Yojana is, who can apply, the subsidy for homes and housing societies, what the 300 free units really mean, how to register on the national portal, and what to check first.",
  name: "PM Surya Ghar: Muft Bijli Yojana",
  eyebrow: "Guide · Government scheme",
  title: "PM Surya Ghar:",
  accent: "Muft Bijli Yojana, explained.",
  answer:
    "PM Surya Ghar: Muft Bijli Yojana is the Government of India's scheme to put rooftop solar on one crore homes. It gives households a central subsidy of up to ₹78,000 on a grid-connected rooftop system, and the government says households can get up to 300 units of electricity free each month, which comes from the solar their own roof produces. You apply on the national portal, pmsuryaghar.gov.in; WayTara explains the scheme and, where your quotation says so, helps with the paperwork.",
  inShort: [
    "The Prime Minister launched it on 13 February 2024 and the Union Cabinet approved it on 29 February 2024, with an outlay of ₹75,021 crore, for one crore households.",
    "The central subsidy is ₹30,000 a kW for the first 2 kW and ₹18,000 for the third kW, so ₹78,000 at most. Special-category states and union territories get 10% more.",
    "It is for residential electricity consumers, and for housing societies and resident welfare associations. Other kinds of consumer should not apply on the portal.",
    "The portal showed the scheme closing on 31 March 2027 when we last looked, so check the date before you plan.",
  ],
  sections: [
    {
      id: "what",
      summary: "Launched in February 2024 to put rooftop solar on one crore homes.",
      badge: "The scheme",
      title: "What the scheme",
      accent: "is, in short.",
      blocks: [
        {
          type: "p",
          text: "PM Surya Ghar: Muft Bijli Yojana (in English, the Prime Minister's Solar Home, Free Electricity Scheme) helps households put solar panels on their own roof. The Ministry of New and Renewable Energy runs it, and households apply for the subsidy and choose a vendor on one national portal.",
        },
        {
          type: "list",
          items: [
            "Launched by the Prime Minister on 13 February 2024, and approved by the Union Cabinet on 29 February 2024.",
            "A total outlay of ₹75,021 crore, to install rooftop solar on one crore households.",
            "A central subsidy for households, and a separate rate for housing societies and resident welfare associations.",
            "Collateral-free, low-interest loans for household systems up to 3 kW.",
            "A model solar village in every district, and incentives for urban local bodies and panchayats to promote rooftop solar.",
          ],
        },
      ],
    },
    {
      id: "free-units",
      summary: "The units come from your own roof, so they depend on the system and the sun.",
      badge: "Free electricity",
      title: "What “300 units free”",
      accent: "really means.",
      blocks: [
        {
          type: "p",
          text: "The government says households will get up to 300 units of electricity free every month. In practice the units come from your own panels: they run your home first, and the surplus goes to the grid, where net metering adjusts it against the units you take. The government's own estimate is that a 3 kW system generates more than 300 units a month on average.",
        },
        {
          type: "p",
          text: "So how much your bill falls depends on how many units you use, your tariff and the sunshine at your roof. The portal suggests a system size from your monthly use:",
        },
        {
          type: "compare",
          columns: ["Suitable system size"],
          rows: [
            { label: "Up to 150 units a month", cells: ["1 to 2 kW"] },
            { label: "150 to 300 units a month", cells: ["2 to 3 kW"] },
            { label: "More than 300 units a month", cells: ["More than 3 kW"] },
          ],
        },
        {
          type: "note",
          title: "An estimate, not a promise",
          body: "Your own figures come from a design for your roof and your bills. We give estimates and never guarantee savings. See how solar reduces your electricity bill.",
        },
      ],
    },
    {
      id: "subsidy",
      summary: "The central figures from the scheme's own table, as last checked.",
      badge: "The subsidy",
      title: "How much",
      accent: "you can get.",
      blocks: [
        {
          type: "compare",
          columns: ["Most states", "Special-category states and UTs"],
          rows: [
            { label: "First 2 kW", cells: ["₹30,000 per kW", "₹33,000 per kW"] },
            { label: "Third kW", cells: ["₹18,000 per kW", "₹19,800 per kW"] },
            { label: "Beyond 3 kW", cells: ["No extra subsidy", "No extra subsidy"] },
            { label: "Housing societies and RWAs (common facilities, EV charging included)", cells: ["₹18,000 per kW, up to 500 kW (at 3 kW per house)", "₹19,800 per kW"] },
          ],
        },
        {
          type: "p",
          text: "The Cabinet described the subsidy as 60% of the system cost for the first 2 kW and 40% of the additional cost between 2 and 3 kW, capped at 3 kW. At the benchmark prices that gives ₹30,000 for 1 kW, ₹60,000 for 2 kW and ₹78,000 for 3 kW or more. For a housing society, the 500 kW limit includes the rooftop systems that individual residents install. See the solar subsidy guide for how it is paid and how net metering fits in.",
        },
        {
          type: "p",
          text: "Households can also get collateral-free, low-interest loans for systems up to 3 kW: around 7% when the scheme was approved. Lenders and rates change, so ask your bank what it offers now.",
        },
        {
          type: "note",
          title: "Where these figures come from",
          body: "The Union Cabinet's release of 29 February 2024, a reply by the Ministry of New and Renewable Energy in the Lok Sabha on 7 August 2024, and the national portal, last checked on 11 November 2026. The government can revise the scheme, so confirm today's figures on pmsuryaghar.gov.in before you decide.",
        },
      ],
    },
    {
      id: "who",
      summary: "Homes and housing societies. Businesses should not apply here.",
      badge: "Who can apply",
      title: "Who the scheme",
      accent: "is for.",
      blocks: [
        {
          type: "list",
          items: [
            "Residential electricity consumers: homes and villas with their own roof and connection.",
            "A valid connection with your electricity distribution company. The portal asks for your consumer account number to fetch your details.",
            "Housing societies and resident welfare associations, for common facilities such as lifts, pumps, lighting and EV charging.",
            "Businesses, factories and other kinds of consumer should not apply on this portal, according to the portal's own FAQ.",
          ],
        },
        {
          type: "p",
          text: "The scheme's guidelines set the detailed conditions, including equipment and installer rules, and they can change. We tell you what applies to your project, but the guidelines are the authority.",
        },
      ],
    },
    {
      id: "apply",
      summary: "The first steps, as the national portal describes them.",
      badge: "How to apply",
      title: "Applying on the",
      accent: "national portal.",
      blocks: [
        {
          type: "steps",
          items: [
            { title: "Open the portal", body: "Go to pmsuryaghar.gov.in and choose Apply Now, or open the Login menu and choose Consumer Login." },
            { title: "Register with your mobile number", body: "Enter the mobile number registered with your electricity connection and the captcha, confirm that you have read the guidelines, then enter the OTP sent by SMS." },
            { title: "Add your details", body: "Your name, e-mail, address, state, district and PIN code." },
            { title: "Apply for rooftop solar", body: "Choose your state, district and electricity distribution company, enter your consumer account number and fetch your details, then fill in the application. You can also start by choosing a vendor." },
            { title: "Install, connect and claim", body: "A vendor registered on the portal installs the system, your distribution company fits the net meter and inspects it, and you submit the commissioning details and your bank details. The government then pays the subsidy." },
          ],
        },
        {
          type: "p",
          text: "The portal's screens change, so it is always the authority. It also lists a toll-free number, 15555. The solar subsidy guide has the steps after you apply.",
        },
      ],
    },
    {
      id: "timing",
      summary: "The portal showed 31 March 2027 as the closing date.",
      badge: "Timing",
      title: "Before the scheme",
      accent: "closes.",
      blocks: [
        {
          type: "p",
          text: "When we looked on 10 November 2026, the national portal said the scheme closes on 31 March 2027. Governments extend and change schemes, so check the portal for the date that applies when you read this.",
        },
        {
          type: "p",
          text: "Approvals, the net meter and the weather can all move an installation date. If you want the subsidy, plan so that the installation and commissioning finish well before any closing date, and ask your installer to confirm in writing that your project is done under the scheme.",
        },
      ],
    },
    {
      id: "waytara",
      summary: "What we help with, and what only the authorities can decide.",
      badge: "What WayTara does",
      title: "How WayTara",
      accent: "helps.",
      blocks: [
        {
          type: "list",
          items: [
            "We explain the scheme and tell you how it applies to your home, society or project.",
            "Where your quotation says so, we help prepare and submit the paperwork, using the information and documents you give us. You are responsible for their being true and complete.",
            "The subsidy is paid by the government to you. It is not a discount from WayTara, and the price in your quotation does not depend on it unless the quotation says otherwise in writing.",
            "We do not promise that you qualify, that your application will be approved, or when the money will reach you.",
            "After installation, you see the system on the WayTara dashboard: how the platform connects your equipment.",
          ],
        },
      ],
    },
  ],
  faqs: [
    {
      question: "What is PM Surya Ghar: Muft Bijli Yojana?",
      answer:
        "It is the Government of India's rooftop solar scheme for one crore households, launched on 13 February 2024 and approved by the Union Cabinet on 29 February 2024 with an outlay of ₹75,021 crore. It gives households a central subsidy on a grid-connected rooftop system, and housing societies a subsidy for common facilities.",
    },
    {
      question: "Is the electricity really free?",
      answer:
        "The government says households can get up to 300 units of electricity free each month. The units come from your own solar panels, not from a separate supply: your home uses the solar power first and net metering adjusts what you send to the grid. How much your bill falls depends on your use, your tariff and the sunshine.",
    },
    {
      question: "How much subsidy will I get?",
      answer:
        "₹30,000 for each of the first 2 kW and ₹18,000 for the third kW, so ₹60,000 for 2 kW and ₹78,000 for 3 kW or more, which is the most a household gets. Special-category states and union territories get 10% more. Check pmsuryaghar.gov.in for today's figures.",
    },
    {
      question: "Who can apply?",
      answer:
        "Residential electricity consumers, and housing societies and resident welfare associations. According to the portal's FAQ, other kinds of consumer should not apply on it. You need a valid connection with your distribution company and a roof that can take the panels.",
    },
    {
      question: "Can a housing society or RWA apply?",
      answer:
        "Yes. For common facilities, including EV charging, the subsidy is ₹18,000 per kW up to 500 kW, counted at 3 kW per house, and the limit includes any rooftop systems that individual residents install. It covers common loads, not each flat's own meter.",
    },
    {
      question: "Is there a loan for the rest of the cost?",
      answer:
        "The scheme provides for collateral-free, low-interest loans for household systems up to 3 kW, at around 7% when it was approved. Lenders and rates change, so ask your bank what it offers now. The subsidy is paid separately by the government.",
    },
    {
      question: "Where do I apply, and who can I call?",
      answer:
        "Apply on the national portal, pmsuryaghar.gov.in. The portal lists a toll-free number, 15555, for help. WayTara can explain the steps and, where your quotation says so, help with the paperwork, but the approval is always the authority's decision.",
    },
    {
      question: "Is the scheme ending soon?",
      answer:
        "On 10 November 2026 the national portal showed the scheme closing on 31 March 2027. Dates can be extended or changed, so check the portal, and plan your installation so it finishes well before any closing date.",
    },
  ],
  related: ["solar-subsidy", "solar-for-home", "reduce-electricity-bill-solar"],
  updated: "2026-11-11",
  updatedLabel: "11 November 2026",
};

export const GUIDES: Record<string, Guide> = {
  [solarForHome.slug]: solarForHome,
  [gridTypes.slug]: gridTypes,
  [subsidy.slug]: subsidy,
  [bill.slug]: bill,
  [scheme.slug]: scheme,
};

export const GUIDE_LIST: Guide[] = [solarForHome, gridTypes, subsidy, scheme, bill];
