export interface TeamMember {
  id: string;
  name: string;
  role: string;
  bio: string;
  initials: string;
  quote: string;
  avatarColor: string;
}

export interface TrustItem {
  id: string;
  title: string;
  summary: string;
  body: string;
  highlights: string[];
}

export const TEAM_MEMBERS: TeamMember[] = [
  {
    id: "manoj-waytara",
    name: "Manoj Kumar",
    role: "Founder & Chief Energy Architect",
    bio: "14+ years pioneering grid-integrated solar systems and utility-scale battery storage deployments.",
    initials: "MK",
    quote:
      "We refuse to treat solar as a commodity box sale. Every WayTara deployment is engineered as a resilient, synchronized microgrid with sub-20ms transfer speeds and 25-year structural reliability.",
    avatarColor: "bg-amber-500 text-white",
  },
  {
    id: "priya-sharma",
    name: "Dr. Priya Sharma",
    role: "VP of Power Systems Engineering",
    bio: "Ex-PowerGrid researcher specializing in microgrid telemetry, inverter synchrony, and BESS safety.",
    initials: "PS",
    quote:
      "By modeling 3D shadow curves, thermal clipping, and high-voltage string configurations before mounting a single rail, we guarantee maximum energy yield and zero battery degradation over decades.",
    avatarColor: "bg-pink-600 text-white",
  },
  {
    id: "rohit-verma",
    name: "Rohit Verma",
    role: "Head of Project Delivery & Safety",
    bio: "Overseen 350+ rooftop solar installations across Tier-1 Indian metros with zero safety incidents.",
    initials: "RV",
    quote:
      "Safety and grid compliance aren't afterthoughts. From CEIG clearances and chemical earthing to 150 km/h wind-load structural testing, we execute with zero compromise on engineering standards.",
    avatarColor: "bg-blue-600 text-white",
  },
  {
    id: "ananya-iyer",
    name: "Ananya Iyer",
    role: "Lead Software & IoT Engineer",
    bio: "Architect of the WayTara Cloud IoT gateway delivering millisecond power balancing and fault diagnosis.",
    initials: "AI",
    quote:
      "Tara AI turns static hardware into an autonomous power plant — orchestrating solar surplus, battery state-of-charge, and EV chargers in real time without human intervention.",
    avatarColor: "bg-emerald-600 text-white",
  },
  {
    id: "rajesh-kannan",
    name: "Rajesh Kannan",
    role: "Head of Operations & Maintenance",
    bio: "Managing 45+ MWp of operational rooftop assets with 99.8% uptime SLAs.",
    initials: "RK",
    quote:
      "Our single-warranty SLA means clients have one accountable partner. We monitor cloud telemetry 24/7 and deploy certified power engineers within guaranteed turnaround windows.",
    avatarColor: "bg-indigo-600 text-white",
  },
];

export const TRUST_ACCORDION_ITEMS: TrustItem[] = [
  {
    id: "standards",
    title: "MNRE Guidelines & IEC Safety Standards",
    summary: "Full adherence to Indian & International electrical codes",
    body: "Every WayTara deployment strictly adheres to Ministry of New and Renewable Energy (MNRE) benchmark specifications and international IEC standards (IEC 61215 for PV reliability, IEC 62109 for inverter electrical safety, and IEC 62619 for industrial lithium storage security). We manage 100% of DISCOM liaisons, net-metering synchronization, and CEIG approvals on your behalf.",
    highlights: [
      "MNRE ALMM Tier-1 compliant solar modules",
      "IEC 62619 certified thermal-runaway protected LFP battery packs",
      "CEA / DISCOM approved dual-source automatic transfer switches",
    ],
  },
  {
    id: "vetting",
    title: "Tier-1 Hardware & Supplier Vetting Protocol",
    summary: "Only bankable components with guaranteed 10 to 25 year lifespans",
    body: "We reject over 70% of commodity hardware flooding the Indian market. All PV modules, inverters, and battery cells in WayTara packages are sourced directly from BloombergNEF Tier-1 manufacturers, audited in-factory for cell micro-cracks, and tested under rigorous accelerated humidity-freeze test cycles.",
    highlights: [
      "Automated electroluminescence (EL) testing before rooftop mounting",
      "Grade-A prismatic LFP cells rated for 6,000+ deep discharge cycles",
      "IP65 / IP66 outdoor rated enclosures with anti-corrosion C5 coating",
    ],
  },
  {
    id: "checklist",
    title: "Our 30-Point Installation Quality Checklist",
    summary: "Standardized industrial-grade engineering protocol for every roof",
    body: "Our installation teams work from a strict 30-point ISO-9001 certified execution playbook covering structural wind load analysis (tested to 150 km/h gusts), hot-dip galvanized mounting structures, chemical earthing with copper-bonded rods (< 2 ohms resistance), dedicated DC/AC surge protection devices (SPDs), and UV-resistant flame-retardant cabling.",
    highlights: [
      "150 km/h wind-load rated hot-dip galvanized aluminum structures",
      "Dual-electrode chemical earthing with < 2 ohms resistance guaranteed",
      "Class-II DC/AC surge protection devices with optical lightning arresters",
    ],
  },
];
