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
