// One list of destinations for the public site, so the header, the mobile menu and the footer never drift apart.
// Several of these routes are built in later steps of the website plan (docs/WEBSITE_PLAN.md); see docs/WEBSITE_PROGRESS.md.

export interface NavDestination {
  label: string;
  href: string;
  /** One short line, shown in the Solutions menu. */
  blurb?: string;
  /** A photo for the property types (public/images/segments). */
  image?: string;
}

/** The six kinds of property WayTara serves, one page each. Slugs match the existing /solutions/[segment] routes. */
export const SOLUTION_SEGMENTS: NavDestination[] = [
  { label: "Homes & Villas", href: "/solutions/home", blurb: "Solar, battery backup and EV charging", image: "/images/segments/home.jpg" },
  { label: "Apartments, RWAs & Developers", href: "/solutions/apartment", blurb: "Common areas, backup and shared charging", image: "/images/segments/apartment.jpg" },
  { label: "Commercial & Workspaces", href: "/solutions/commercial", blurb: "Offices, hospitals, retail and hotels", image: "/images/segments/commercial.jpg" },
  { label: "Factory & Industrial", href: "/solutions/factory", blurb: "Solar, storage and monitoring for plants", image: "/images/segments/factory.jpg" },
  { label: "EV Fleets & Charging", href: "/solutions/ev-fleet", blurb: "Charging sites and the software to run them", image: "/images/segments/ev-fleet.jpg" },
  { label: "IT Parks & Campuses", href: "/solutions/it-park", blurb: "One connected view across a campus", image: "/images/segments/it-park.jpg" },
];

/** The three things WayTara does, as anchors on the Solutions hub. */
export const SOLUTION_NEEDS: NavDestination[] = [
  { label: "Build", href: "/solutions#build", blurb: "Solar, storage and EV chargers, designed and installed" },
  { label: "Charge", href: "/solutions#charge", blurb: "EV charging with our own management software" },
  { label: "Manage", href: "/solutions#manage", blurb: "Connect the equipment you already have to one dashboard" },
];

export const SOLUTIONS_HUB: NavDestination = { label: "Solutions", href: "/solutions" };

/** Plain links that sit next to the Solutions menu. */
export const PRIMARY_LINKS: NavDestination[] = [
  { label: "Platform", href: "/technology" },
  { label: "Why WayTara", href: "/why-waytara" },
  { label: "About Us", href: "/about" },
];

export const PARTNER_LINK: NavDestination = { label: "Partner", href: "/partner" };
export const CONTACT_LINK: NavDestination = { label: "Contact", href: "/contact" };
export const PLANNER_LINK: NavDestination = { label: "Energy Planner", href: "/planner" };

/** The header's one primary action. On the planner itself it turns into a way to reach a person instead. */
export function getStartedFor(pathname: string | null): NavDestination {
  return pathname?.startsWith("/planner") ? { label: "Talk to us", href: CONTACT_LINK.href } : { label: "Get Started", href: PLANNER_LINK.href };
}

export const LEGAL_LINKS: NavDestination[] = [
  { label: "Terms of Service", href: "/terms" },
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Cookie Policy", href: "/cookies" },
  { label: "Warranty Policy", href: "/warranty" },
];

export interface PageMenu {
  label: string;
  href: string;
  /** The sections of that page, each opening at its place on the page. */
  items: NavDestination[];
}

/**
 * The header's other four items, each a dropdown of that page's sections (the same idea as Solutions). Order is the order in the header. The
 * anchors are the section ids on each page: change a page's ids and change them here too.
 */
export const PAGE_MENUS: PageMenu[] = [
  {
    label: "Platform",
    href: "/technology",
    items: [
      { label: "Overview", href: "/technology#overview", blurb: "Three parts, one platform" },
      { label: "How it connects", href: "/technology#how", blurb: "From the equipment to your dashboard" },
      { label: "Energy management", href: "/technology#energy", blurb: "See your energy, manage what is supported" },
      { label: "Charging management", href: "/technology#charging", blurb: "Run your chargers from one place" },
      { label: "Step by step", href: "/technology#steps", blurb: "From connected equipment to your dashboard" },
      { label: "Live demo", href: "/technology#demo", blurb: "The dashboard on sample data" },
      { label: "Check compatibility", href: "/technology#compatibility", blurb: "Does it work with your equipment?" },
    ],
  },
  {
    label: "Why WayTara",
    href: "/why-waytara",
    items: [
      { label: "Four reasons", href: "/why-waytara#reasons", blurb: "What is different about how we work" },
      { label: "One system", href: "/why-waytara#one-system", blurb: "Separate suppliers, or one system" },
      { label: "Our promise", href: "/why-waytara#promise", blurb: "What we will do, and what we won't" },
    ],
  },
  {
    label: "About Us",
    href: "/about",
    items: [
      { label: "Who we are", href: "/about#who", blurb: "Three things, done as one" },
      { label: "Vision and team", href: "/about#our-team", blurb: "The people behind WayTara" },
      { label: "Where we are", href: "/about#where", blurb: "Visit us in Mylapore, Chennai" },
    ],
  },
  {
    label: "Partner",
    href: "/partner",
    items: [
      { label: "Who we look for", href: "/partner#who", blurb: "Teams that do good installation work" },
      { label: "How it works", href: "/partner#how", blurb: "From application to a conversation" },
      { label: "Apply", href: "/partner#apply", blurb: "Tell us about your company" },
      { label: "FAQ", href: "/partner#faq", blurb: "Questions from installers" },
    ],
  },
  {
    label: "Support",
    href: "/support",
    items: [
      { label: "Sign-in problems", href: "/support#sign-in", blurb: "Password, codes and getting back in" },
      { label: "Devices and monitoring", href: "/support#devices", blurb: "A device offline or readings missing" },
      { label: "Billing and plans", href: "/support#billing", blurb: "Payments, plans and invoices" },
      { label: "Raise a ticket", href: "/support#ticket", blurb: "Ask the team from your dashboard" },
      { label: "Tell us what is wrong", href: "/support#contact", blurb: "If you cannot sign in" },
    ],
  },
];

export interface HeaderMenu {
  label: string;
  /** Where the label itself leads. */
  href: string;
  /** The small label above the large links. */
  bigLabel: string;
  /** The large links: the sections of the page (or the property types for Solutions). */
  big: NavDestination[];
  asideTitle: string;
  /** The few small links on the right. */
  aside: NavDestination[];
}

const ASIDE: Record<string, { title: string; links: NavDestination[] }> = {
  Platform: { title: "Next", links: [PLANNER_LINK, { label: "Solutions", href: "/solutions" }] },
  "Why WayTara": { title: "Next", links: [PLANNER_LINK, { label: "Platform", href: "/technology" }] },
  "About Us": { title: "More", links: [CONTACT_LINK, { label: "Partner with us", href: "/partner" }] },
  Partner: { title: "More", links: [CONTACT_LINK, { label: "About Us", href: "/about" }] },
  Support: { title: "Quick links", links: [{ label: "Forgot password", href: "/forgot-password" }, { label: "Sign in", href: "/login" }, CONTACT_LINK] },
};

/** What each header item opens: the same full-width panel for all five. */
export const HEADER_MENUS: HeaderMenu[] = [
  {
    label: "Solutions",
    href: SOLUTIONS_HUB.href,
    bigLabel: "Explore Solutions",
    big: [{ label: "All solutions", href: SOLUTIONS_HUB.href }, ...SOLUTION_SEGMENTS],
    asideTitle: "By need",
    aside: [...SOLUTION_NEEDS, { label: "Not sure? Use the Energy Planner", href: PLANNER_LINK.href }],
  },
  ...PAGE_MENUS.map((m) => ({
    label: m.label,
    href: m.href,
    bigLabel: `Explore ${m.label}`,
    big: m.items,
    asideTitle: ASIDE[m.label].title,
    aside: ASIDE[m.label].links,
  })),
];
