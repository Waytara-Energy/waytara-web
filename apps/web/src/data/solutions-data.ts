import * as React from "react";
import {
  Home,
  Building,
  Factory,
  Building2,
  Truck,
  Cpu,
  Sun,
  BatteryCharging,
  Zap,
  TrendingDown,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Smartphone,
  Sliders,
  DollarSign,
  Car,
  FileCheck,
  Server,
  Layers,
  Leaf,
} from "lucide-react";

export type SegmentSlug =
  | "home"
  | "apartment"
  | "factory"
  | "commercial"
  | "ev_fleet"
  | "ev-fleet"
  | "it_park"
  | "it-park";

export interface SystemMetric {
  label: string;
  value: string;
  unit: string;
  sub: string;
  icon: string;
}

export interface ChallengeComparison {
  traditionalPain: string;
  waytaraSolution: string;
}

export interface HardwareBlock {
  title: string;
  tag: string;
  specs: string[];
  description: string;
  icon: string;
}

export interface SegmentPackage {
  id: string;
  name: string;
  badge: string;
  tagline: string;
  solarKw: string;
  batteryKwh: string;
  inverterSurge: string;
  priceRange: string;
  payback: string;
  isPopular?: boolean;
  features: string[];
}

export interface FinancialMetric {
  label: string;
  value: string;
  sub: string;
  highlight?: boolean;
}

export interface CaseStudy {
  title: string;
  clientType: string;
  location: string;
  systemSize: string;
  monthlyBillBefore: string;
  monthlyBillAfter: string;
  annualSavings: string;
  co2Offset: string;
  quote: string;
  author: string;
}

export interface SegmentFaq {
  question: string;
  answer: string;
}

export interface SegmentSolutionData {
  id: string;
  slug: string;
  urlPath: string;
  name: string;
  category: string;
  tagline: string;
  heroImage: string;
  executiveSummary: string;
  metrics: SystemMetric[];
  challenges: ChallengeComparison[];
  hardwareArchitecture: HardwareBlock[];
  packages: SegmentPackage[];
  financialModel: {
    title: string;
    description: string;
    metrics: FinancialMetric[];
    subsidyOrTaxNote: string;
    lcoeComparison: {
      solarKwh: string;
      gridKwh: string;
      dieselKwh: string;
    };
  };
  caseStudy: CaseStudy;
  faqs: SegmentFaq[];
}

export const SEGMENT_SOLUTIONS_DATA: Record<string, SegmentSolutionData> = {
  home: {
    id: "home",
    slug: "home",
    urlPath: "/solutions/home",
    name: "Home Independence",
    category: "Residential & Independent Villas",
    tagline: "The Frontier of 24/7 Home Power Independence.",
    heroImage: "/images/segments/home.jpg",
    executiveSummary:
      "Engineered for villas and residences. WayTara couples Tier-1 TOPCon solar with smart LFP storage to deliver zero-flicker blackout backup for heavy ACs while cutting grid bills by up to 90%.",
    metrics: [
      {
        label: "Typical PV Capacity",
        value: "3 – 15",
        unit: "kWp",
        sub: "N-Type TOPCon Bifacial",
        icon: "Sun",
      },
      {
        label: "Smart LFP Storage",
        value: "5 – 20",
        unit: "kWh",
        sub: "Modular LiFePO4 (6000+ Cycles)",
        icon: "BatteryCharging",
      },
      {
        label: "Monthly Bill Offset",
        value: "Up to 90",
        unit: "%",
        sub: "Net-metered DISCOM credits",
        icon: "Zap",
      },
      {
        label: "Typical Payback",
        value: "3.2 – 4.2",
        unit: "Yrs",
        sub: "25-Yr System Lifespan",
        icon: "TrendingDown",
      },
    ],
    challenges: [
      {
        traditionalPain:
          "Frequent grid outages trigger lead-acid inverters that fail on heavy AC loads and require toxic water top-ups every few months.",
        waytaraSolution:
          "Sub-20ms seamless UPS-grade auto switchover with high surge capacity (200% for 10s) starting 2.0-ton ACs effortlessly with zero reboot on computers or Wi-Fi.",
      },
      {
        traditionalPain:
          "Escalating residential electricity tariff slabs (₹8.50 to ₹12.00/unit) result in exorbitant summer electricity bills.",
        waytaraSolution:
          "Direct solar self-consumption during the day and stored solar energy usage at night minimizes grid draw to baseline fixed meter charges.",
      },
      {
        traditionalPain:
          "Fragmented local contractors leave homeowners struggling with 4 different warranties for panels, inverters, batteries, and wiring.",
        waytaraSolution:
          "WayTara Single-Accountable Warranty: One contact number, guaranteed on-site technician turnaround SLA, and 24/7 automated cloud telemetry.",
      },
    ],
    hardwareArchitecture: [
      {
        title: "Tier-1 N-Type TOPCon Solar",
        tag: "Generation Tier",
        specs: ["22.5%+ Cell Efficiency", "Bifacial Rear-Side Gain (+15%)", "25-Yr Linear Warranty"],
        description:
          "Dual-glass monocrystalline modules capturing diffused light even on overcast monsoon days, mounted on elevated corrosion-resistant anodized aluminium superstructures.",
        icon: "Sun",
      },
      {
        title: "Smart LFP Wall Storage",
        tag: "Storage Tier",
        specs: ["LiFePO4 Chemistry", "Active Thermal BMS", "6,000 Deep Cycles (~15 Yrs)"],
        description:
          "Non-toxic, non-flammable prismatic cells with active balancing and CANbus telemetry reporting real-time cell temperatures and state-of-charge.",
        icon: "BatteryCharging",
      },
      {
        title: "Hybrid Bi-Directional PCS",
        tag: "Conversion Tier",
        specs: ["Dual MPPT Tracking", "98.4% Peak Efficiency", "<20ms Switchover"],
        description:
          "Intelligent inverter managing solar generation, battery charging/discharging, and grid net-metering synchronization automatically without human intervention.",
        icon: "Zap",
      },
      {
        title: "WayTara Cloud IoT & Remote Dashboard",
        tag: "Cloud Platform",
        specs: ["Live Mobile & Web Telemetry", "Historical Analytics", "Worldwide Inverter Management"],
        description:
          "Real-time mobile and web dashboard to monitor daily solar generation, track historical energy metrics, and remotely manage inverter operating modes anytime, from anywhere in the world.",
        icon: "Smartphone",
      },
    ],
    packages: [
      {
        id: "home-essential",
        name: "Home Essential",
        badge: "Grid-Tied High Efficiency",
        tagline: "Designed for urban homes with stable grid seeking maximum financial savings.",
        solarKw: "3 kW – 6 kWp",
        batteryKwh: "Storage-Ready (Expandable)",
        inverterSurge: "On-Grid String Inverter",
        priceRange: "₹1.95L – ₹3.6L",
        payback: "2.8 – 3.5 Years",
        features: [
          "MNRE PM Surya Ghar subsidy eligible (Up to ₹78,000)",
          "Bifacial N-Type TOPCon modules with 25-year warranty",
          "Bi-directional net-metering DISCOM approvals included",
          "WayTara live mobile app production telemetry",
        ],
      },
      {
        id: "home-independence",
        name: "Home Independence",
        badge: "Solar + Smart LFP Backup",
        tagline: "100% whole-home blackout protection and heavy AC load support.",
        solarKw: "5 kW – 10 kWp",
        batteryKwh: "10 kWh – 15 kWh LFP",
        inverterSurge: "200% High Surge Hybrid",
        priceRange: "₹4.5L – ₹7.2L",
        payback: "3.5 – 4.2 Years",
        isPopular: true,
        features: [
          "Sub-20ms seamless UPS-grade auto switchover",
          "Runs 1.5/2.0 Ton Inverter ACs, refrigerators & water pumps",
          "6,000+ cycle Lithium Iron Phosphate storage with 10-yr warranty",
          "Zero maintenance with active multi-point thermal BMS",
        ],
      },
      {
        id: "ev-ready-villa",
        name: "EV Ready Villa",
        badge: "Solar + BESS + 7.4 kW EV Charger",
        tagline: "Charge your EV directly on free sunshine with dynamic solar-sync.",
        solarKw: "8 kW – 15 kWp",
        batteryKwh: "15 kWh – 25 kWh LFP",
        inverterSurge: "Hybrid + Dynamic Breaker Guard",
        priceRange: "₹6.8L – ₹10.5L",
        payback: "3.2 – 3.9 Years",
        features: [
          "Integrated 7.4 kW / 11 kW Type-2 Smart EV Charger",
          "Dynamic Solar-Sync: Routes 100% excess sunshine into your EV",
          "Dynamic load management preventing main breaker trips",
          "Overnight home power & morning vehicle top-up assurance",
        ],
      },
    ],
    financialModel: {
      title: "Residential ROI & Financial Arbitrage",
      description:
        "With Indian residential DISCOM tariffs climbing 5-8% annually and central PM Surya Ghar subsidies granting up to ₹78,000, your system achieves full break-even in 3 to 4 years, delivering 21+ years of completely free electricity.",
      metrics: [
        { label: "Government Subsidy", value: "Up to ₹78,000", sub: "PM Surya Ghar direct DBT credit", highlight: true },
        { label: "25-Year Cumulative Savings", value: "₹28L – ₹55L", sub: "Calculated at ₹9/unit base + 5% annual escalation" },
        { label: "Internal Rate of Return (IRR)", value: "24.5%", sub: "Far outpaces fixed deposits & mutual fund averages" },
        { label: "Levelized Cost of Energy (LCOE)", value: "₹2.10 / kWh", sub: "Compared to DISCOM grid cost of ₹8.50 - ₹11.00 / kWh" },
      ],
      subsidyOrTaxNote:
        "Eligible for Central PM Surya Ghar Subsidies (₹30,000 for 1 kW, ₹60,000 for 2 kW, ₹78,000 for 3 kW+). WayTara handles 100% of documentation, DISCOM net-meter inspection, and DBT subsidy disbursement.",
      lcoeComparison: {
        solarKwh: "₹2.10",
        gridKwh: "₹9.50",
        dieselKwh: "₹28.00",
      },
    },
    caseStudy: {
      title: "Bangalore 4BHK Villa Total Independence",
      clientType: "Residential Villa (Sarjapur, Bengaluru)",
      location: "Bengaluru, Karnataka",
      systemSize: "10 kWp N-Type TOPCon + 15 kWh Smart LFP Storage + 7.4 kW EV Charger",
      monthlyBillBefore: "₹18,400 / Month",
      monthlyBillAfter: "₹1,250 / Month (Fixed Grid Charge)",
      annualSavings: "₹2,05,800 / Year",
      co2Offset: "12.4 Tons / Year",
      quote:
        "We haven't experienced a single power cut or flickering light since commissioning. Our two 1.5-ton ACs run all night on stored battery energy, and my Tata Curvv EV is charged 100% on surplus solar.",
      author: "Rajesh & Ananya Menon, Palm Meadows Villa",
    },
    faqs: [
      {
        question: "How much rooftop space is required for a 5 kW or 10 kW residential system?",
        answer:
          "A 5 kW system requires approximately 300-350 sq ft of shadow-free rooftop space, while a 10 kW system requires 600-700 sq ft. WayTara offers elevated galvanized superstructures that preserve your terrace floor for gardening or leisure.",
      },
      {
        question: "Can the system start and run multiple Air Conditioners during a power outage?",
        answer:
          "Yes. Our hybrid inverters are engineered with 200% surge capacity (up to 10 seconds), easily handling the high inductive starting current of 1.5-ton and 2.0-ton dual-inverter ACs without tripping.",
      },
      {
        question: "How does the PM Surya Ghar government subsidy claim work?",
        answer:
          "WayTara is an authorized vendor on the national PM Surya Ghar portal. We upload your project feasibility reports, schedule the DISCOM net-meter inspection, and ensure the subsidy amount (up to ₹78,000) is credited directly to your bank account.",
      },
      {
        question: "What is the lifespan and warranty on the Smart LFP battery?",
        answer:
          "We use Grade-A Lithium Iron Phosphate (LiFePO4) chemistry rated for 6,000+ deep cycles at 80% depth of discharge. That translates to 15+ years of daily cycling, backed by WayTara’s comprehensive 10-year replacement warranty.",
      },
    ],
  },

  apartment: {
    id: "apartment",
    slug: "apartment",
    urlPath: "/solutions/apartment",
    name: "Apartments & Gated Communities",
    category: "Gated Communities, RWAs & High-Rises",
    tagline: "Clean Power & EV Ready Infrastructure for Modern Communities.",
    heroImage: "/images/segments/apartment.jpg",
    executiveSummary:
      "Shared rooftop solar and central battery storage engineered to power common lifts, pumps, and STPs with automated EV sub-metering to slash monthly society maintenance fees.",
    metrics: [
      {
        label: "Typical PV Capacity",
        value: "25 – 150",
        unit: "kWp",
        sub: "Society Rooftop Canopy & Clubhouse",
        icon: "Sun",
      },
      {
        label: "Common BESS Storage",
        value: "30 – 150",
        unit: "kWh",
        sub: "Lifts & Water Pump Backup",
        icon: "BatteryCharging",
      },
      {
        label: "Maintenance Cost Cut",
        value: "65 – 85",
        unit: "%",
        sub: "Common DISCOM electricity bills",
        icon: "Zap",
      },
      {
        label: "Payback Period",
        value: "2.9 – 3.8",
        unit: "Yrs",
        sub: "RWA Capital Sinking Fund ROI",
        icon: "TrendingDown",
      },
    ],
    challenges: [
      {
        traditionalPain:
          "Huge diesel generator (DG) bills during outages costing ₹26–₹32 per kWh for running society water pumps, STPs, and lift banks.",
        waytaraSolution:
          "Integrated solar + BESS instantly handles common area inductive loads, reducing society diesel burn by over 80%.",
      },
      {
        traditionalPain:
          "Residents buying EVs create conflicts over parking lot electrical cabling, breaker overloading, and dispute over power billing.",
        waytaraSolution:
          "Turnkey sub-metered EV charging hubs with dynamic load balancing, RFID access, and automated billing settled directly to RWA accounts.",
      },
      {
        traditionalPain:
          "Complex society committee approvals and strict Electrical Inspectorate (CEIG) compliance hurdles.",
        waytaraSolution:
          "End-to-end EPC execution including CEIG structural safety clearance, lightning protection, net-metering approvals, and RWA general body presentation support.",
      },
    ],
    hardwareArchitecture: [
      {
        title: "High-Rise Canopy Solar Array",
        tag: "Generation Tier",
        specs: ["Wind Load Rated 180 km/h", "Elevated Shadow-Free Structure", "Bifacial High Output"],
        description:
          "High-yield solar canopies installed on society terrace slabs and clubhouse rooftops, engineered to withstand coastal and high-rise cyclonic wind pressures.",
        icon: "Sun",
      },
      {
        title: "Centralized Common Area BESS",
        tag: "Storage Tier",
        specs: ["High-Voltage Rack BESS", "Zero Toxic Emissions", "Fire-Suppression Integrated"],
        description:
          "Modular LFP storage banks providing silent, instant emergency power for fire pumps, sewage treatment aeration blowers, and elevator banks.",
        icon: "BatteryCharging",
      },
      {
        title: "Sub-Metered EV Charging Distribution",
        tag: "EV Tier",
        specs: ["OCPP 1.6J / 2.0.1", "Dynamic Load Shedding", "RFID & Mobile App Auth"],
        description:
          "Dedicated parking bay EV chargers that automatically charge vehicles from daytime solar surplus and bill individual flat owners automatically.",
        icon: "Car",
      },
      {
        title: "RWA Energy Management Dashboard",
        tag: "Software Tier",
        specs: ["Sub-Society Metering", "DG Sync Telemetry", "Automated Resident Invoicing"],
        description:
          "Cloud dashboard giving the society management committee transparent, real-time oversight of solar generation, pump run-hours, and EV charging revenue.",
        icon: "Smartphone",
      },
    ],
    packages: [
      {
        id: "society-essential",
        name: "Society Common Power",
        badge: "Rooftop Solar for Common Loads",
        tagline: "Zero out common lighting, clubhouses, and perimeter security bills.",
        solarKw: "25 kW – 50 kWp",
        batteryKwh: "Grid-Tied Solar Array",
        inverterSurge: "Commercial 3-Phase Inverter",
        priceRange: "₹12.5L – ₹24L",
        payback: "3.0 – 3.6 Years",
        features: [
          "Powers common lighting, water pumps & clubhouse amenities",
          "High-wind resistance elevated structure with CEIG approval",
          "Bi-directional HT/LT net-metering with DISCOM",
          "RWA committee transparent live web monitoring dashboard",
        ],
      },
      {
        id: "society-hybrid-lift",
        name: "Zero-Diesel Society Hub",
        badge: "Solar + Lift/Pump Battery Backup",
        tagline: "Replace noisy, polluting diesel generators for critical common utilities.",
        solarKw: "50 kW – 100 kWp",
        batteryKwh: "50 kWh – 100 kWh LFP BESS",
        inverterSurge: "Industrial Hybrid PCS",
        priceRange: "₹28L – ₹52L",
        payback: "3.2 – 3.9 Years",
        isPopular: true,
        features: [
          "Powers high-torque lift banks, STPs, and hydro-pneumatic pumps",
          "Sub-20ms instant auto-switchover — no stuck elevators during cuts",
          "Cuts society diesel generator fuel expenditure by 80%+",
          "10-Year full system warranty backed by WayTara rapid-response SLA",
        ],
      },
      {
        id: "society-ev-ready",
        name: "Community EV Microgrid",
        badge: "Solar + BESS + 10x EV Chargers",
        tagline: "Future-proof your gated society for the electric mobility era.",
        solarKw: "80 kW – 150 kWp",
        batteryKwh: "100 kWh – 150 kWh BESS",
        inverterSurge: "Dynamic EV Load Controller",
        priceRange: "₹48L – ₹85L",
        payback: "2.9 – 3.5 Years",
        features: [
          "Includes 8-16 Sub-metered Smart Level-2 EV parking dispensers",
          "Dynamic load balancing prevents society main transformer overload",
          "Automated monthly resident billing via UPI / payment gateway",
          "Generates revenue for the society sinking fund from external/guest charging",
        ],
      },
    ],
    financialModel: {
      title: "RWA Maintenance Savings & Sinking Fund Growth",
      description:
        "By replacing grid common area bills and high diesel running costs with on-site solar, high-rises can reduce individual resident monthly maintenance dues by ₹1.20 to ₹2.50 per sq ft.",
      metrics: [
        { label: "Annual Common Bill Savings", value: "₹8.5L – ₹26L", sub: "Returned directly to RWA reserve fund", highlight: true },
        { label: "Diesel Generator Burn Cut", value: "80% – 90%", sub: "Massive reduction in diesel procurement logistics" },
        { label: "Payback Period", value: "3.2 Years", sub: "Funded via RWA Capex or ESG green bank loans" },
        { label: "Community ESG Rating", value: "IGBC Platinum", sub: "Increases property resale value by 6-10%" },
      ],
      subsidyOrTaxNote:
        "Commercial / Multi-dwelling society metering qualifies for Group Net Metering and Virtual Net Metering in forward-looking states (Delhi, Karnataka, Maharashtra). WayTara manages all DISCOM licensing.",
      lcoeComparison: {
        solarKwh: "₹2.25",
        gridKwh: "₹10.20",
        dieselKwh: "₹29.50",
      },
    },
    caseStudy: {
      title: "Pune 320-Flat Gated Society Zero-Diesel Transition",
      clientType: "Gated High-Rise Society (Baner, Pune)",
      location: "Pune, Maharashtra",
      systemSize: "85 kWp Rooftop Solar + 60 kWh LFP BESS + 12x EV Charging Bays",
      monthlyBillBefore: "₹2,65,000 / Month (Common power + Diesel DG)",
      monthlyBillAfter: "₹52,000 / Month",
      annualSavings: "₹25,56,000 / Year",
      co2Offset: "102 Tons / Year",
      quote:
        "Our RWA reduced monthly maintenance by ₹1,400 per flat. The 12 EV parking chargers run seamlessly without straining the society transformer, and residents are thrilled.",
      author: "Col. Sanjeev Kulkarni (Retd.), President, Green Acres RWA",
    },
    faqs: [
      {
        question: "How do we get approvals from the RWA General Body and local DISCOM?",
        answer:
          "WayTara provides end-to-end assistance: 3D shadow analysis, ROI presentation decks for your RWA AGM, structural safety vetting, and all regulatory liaisons with CEIG and your local electricity board.",
      },
      {
        question: "How is electricity billed when individual residents charge their EVs?",
        answer:
          "Each charging bay has an automated RFID/app reader and dedicated sub-meter. Electricity consumed is logged automatically to the resident's account and settled directly via UPI, ensuring zero cost leakage for non-EV owners.",
      },
      {
        question: "Can our society terrace still be used for walking and events?",
        answer:
          "Yes. We design elevated solar canopies with 9 to 11 feet vertical clearance, leaving the rooftop floor 100% open for resident walking tracks, gazebos, and community gatherings.",
      },
    ],
  },

  factory: {
    id: "factory",
    slug: "factory",
    urlPath: "/solutions/factory",
    name: "Industrial & Manufacturing",
    category: "Factories, Heavy Engineering & Processing Plants",
    tagline: "High-Yield MW Solar & BESS for Uninterrupted Industrial Uptime.",
    heroImage: "/images/segments/factory.jpg",
    executiveSummary:
      "High-capacity MW solar and industrial BESS engineered to eliminate peak demand penalties, replace expensive diesel generators, and capture 40% Year-1 tax depreciation.",
    metrics: [
      {
        label: "Typical PV Capacity",
        value: "100 kW – 2",
        unit: "MWp",
        sub: "Industrial Metal Sheet & Ground PV",
        icon: "Sun",
      },
      {
        label: "Containerized BESS",
        value: "100 kWh – 2",
        unit: "MWh",
        sub: "Liquid-Cooled Industrial LFP",
        icon: "BatteryCharging",
      },
      {
        label: "Annual Operating Cut",
        value: "₹25L – ₹1.8",
        unit: "Cr/Yr",
        sub: "Direct electricity & DG savings",
        icon: "Zap",
      },
      {
        label: "Tax Depreciation Benefit",
        value: "40",
        unit: "%",
        sub: "Section 32 Year-1 Tax Write-Off",
        icon: "TrendingDown",
      },
    ],
    challenges: [
      {
        traditionalPain:
          "Crippling kVA maximum demand surge penalties and low power factor surcharges on industrial HT electricity bills.",
        waytaraSolution:
          "Tara AI autonomous peak-shaving: Instantly injects stored battery power during production motor start spikes, keeping contracted kVA within sanctioned limits.",
      },
      {
        traditionalPain:
          "Voltage sags and transient micro-cuts causing CNC machines, robotics, and polymer extrusion lines to halt and waste raw materials.",
        waytaraSolution:
          "Sub-10ms industrial microgrid switchover with active harmonic filtering, delivering pure sinusoidal clean power with zero production line scrap.",
      },
      {
        traditionalPain:
          "Industrial metal roof structural concerns and waterproofing risks from heavy conventional solar installations.",
        waytaraSolution:
          "Non-penetrating, lightweight standing-seam clamp mounting tested up to 200 km/h wind gusts, protecting factory metal shed warranties.",
      },
    ],
    hardwareArchitecture: [
      {
        title: "Industrial Monocrystalline PV",
        tag: "Generation Tier",
        specs: ["600W+ High Wattage Modules", "IP68 Junction Boxes", "Anti-PID & Salt-Mist Resistant"],
        description:
          "High-durability modules engineered for corrosive industrial atmospheres, chemical fumes, and heavy factory dust loads.",
        icon: "Sun",
      },
      {
        title: "Liquid-Cooled Megawatt BESS",
        tag: "Storage Tier",
        specs: ["Containerized IP55 Enclosure", "Liquid Thermal Management", "Aerosol Fire Protection"],
        description:
          "Modular high-voltage battery storage racks engineered for round-the-clock heavy cycling, peak shaving, and zero-diesel power backup.",
        icon: "BatteryCharging",
      },
      {
        title: "Industrial PCS & HT Transformer Sync",
        tag: "Power Conversion Tier",
        specs: ["11 kV / 33 kV Grid Sync", "Active Power Factor Correction", "DG Interlock Controls"],
        description:
          "Heavy-duty power conversion systems seamlessly synchronizing solar, battery, existing 11kV/33kV substations, and on-site diesel generators.",
        icon: "Zap",
      },
      {
        title: "SCADA & Industrial Microgrid Controller",
        tag: "Automation Tier",
        specs: ["Modbus TCP / RTU", "Time-of-Day (ToD) Arbitrage", "Cloud Predictive Maintenance"],
        description:
          "Industrial IoT gateway integrating directly with factory SCADA to optimize energy flow based on real-time DISCOM tariff blocks.",
        icon: "Cpu",
      },
    ],
    packages: [
      {
        id: "factory-peak-shaver",
        name: "kVA Demand Shaver",
        badge: "Solar + Peak BESS",
        tagline: "Eliminate peak demand surcharges and slash industrial HT bills.",
        solarKw: "150 kW – 350 kWp",
        batteryKwh: "100 kWh – 250 kWh BESS",
        inverterSurge: "Industrial 415V / 11kV Sync",
        priceRange: "₹42L – ₹95L",
        payback: "2.8 – 3.4 Years",
        features: [
          "Eliminates kVA demand penalty charges during motor start cycles",
          "40% Accelerated Tax Depreciation (Year-1 write-off)",
          "Non-penetrating standing-seam mounting for metal shed roofs",
          "Automated active power factor correction (Maintains 0.99 PF)",
        ],
      },
      {
        id: "factory-industrial-microgrid",
        name: "MW Industrial Microgrid",
        badge: "500 kW to 2 MW Turnkey EPC",
        tagline: "Turnkey clean power plant for heavy manufacturing facilities.",
        solarKw: "500 kW – 2 MWp",
        batteryKwh: "500 kWh – 1.5 MWh BESS",
        inverterSurge: "11 kV / 33 kV HT Substation",
        priceRange: "₹1.4Cr – ₹5.2Cr",
        payback: "2.5 – 3.2 Years",
        isPopular: true,
        features: [
          "Replaces 80%+ of diesel generator fuel consumption",
          "Full CEIG & State Electricity Regulatory Commission (SERC) compliance",
          "Cloud SCADA dashboard with Time-of-Day tariff arbitrage",
          "Comprehensive 10-Year O&M SLA with guaranteed generation yield",
        ],
      },
      {
        id: "factory-solar-capex",
        name: "Zero-Capex RESCO / OPEX",
        badge: "PPA Power Purchase Agreement",
        tagline: "Zero upfront capital investment — pay only for units consumed at 30% discount.",
        solarKw: "250 kW – 3 MWp",
        batteryKwh: "Custom Sizing",
        inverterSurge: "Turnkey WayTara Owned",
        priceRange: "₹0 Upfront Capex",
        payback: "Day 1 Positive Cashflow",
        features: [
          "WayTara finances, builds, operates, and maintains the solar plant",
          "Fixed discounted electricity tariff (e.g. ₹5.20 vs DISCOM ₹9.80/unit)",
          "15 to 25-year Power Purchase Agreement (PPA)",
          "Option to buyout the entire asset at depreciated cost after Year 5",
        ],
      },
    ],
    financialModel: {
      title: "Commercial Tax Depreciation & Industrial Economics",
      description:
        "Under Section 32 of the Indian Income Tax Act, commercial enterprises can claim 40% Accelerated Depreciation in Year 1 on solar energy equipment. This recovers up to 25-30% of total capital cost in the very first financial year.",
      metrics: [
        { label: "Accelerated Tax Write-Off", value: "40% in Year 1", sub: "Direct corporate tax liability reduction", highlight: true },
        { label: "Industrial IRR", value: "28.4%", sub: "High capital efficiency with rapid 2.8 yr payback" },
        { label: "kVA Penalty Elimination", value: "100%", sub: "Zero maximum demand penalties on monthly DISCOM bill" },
        { label: "LCOE vs Industrial Grid", value: "₹2.20 vs ₹9.50", sub: "Saves ₹7.30 per kWh generated for 25 years" },
      ],
      subsidyOrTaxNote:
        "Eligible for 40% Accelerated Depreciation under Section 32. WayTara provides complete chartered engineer performance certificates for seamless tax filing.",
      lcoeComparison: {
        solarKwh: "₹2.20",
        gridKwh: "₹9.50",
        dieselKwh: "₹27.00",
      },
    },
    caseStudy: {
      title: "Chennai Precision Auto-Components 450 kW Plant",
      clientType: "Auto Parts Manufacturing Facility (Oragadam, Chennai)",
      location: "Chennai, Tamil Nadu",
      systemSize: "450 kWp Rooftop Solar + 300 kWh Industrial BESS",
      monthlyBillBefore: "₹8,40,000 / Month",
      monthlyBillAfter: "₹2,10,000 / Month",
      annualSavings: "₹75,60,000 / Year",
      co2Offset: "540 Tons / Year",
      quote:
        "The automated peak shaving saved us ₹14 Lakhs in kVA penalties alone within the first 6 months. Our CNC production lines have experienced zero downtime, and the 40% tax depreciation significantly boosted our bottom line.",
      author: "V. Ramachandran, Managing Director, Apex Precision Engineering",
    },
    faqs: [
      {
        question: "Will installing solar void our industrial metal shed roof warranty?",
        answer:
          "No. We use specialized non-penetrating standing-seam aluminium clamps engineered specifically for Tata Bluescope, Kirby, and standard trapezoidal sheets without drilling any puncture holes.",
      },
      {
        question: "How does the system handle high inductive motor starting surges?",
        answer:
          "Our industrial PCS inverters feature a 250% instantaneous overload capacity and integrate active harmonic filtering, preventing tripping during heavy motor starts.",
      },
      {
        question: "Can WayTara finance the plant under a Zero-Capex OPEX / RESCO model?",
        answer:
          "Yes. For commercial and industrial facilities with strong credit ratings, we offer zero-capex PPAs where we fund 100% of installation and sell you solar power at 25-35% below your current DISCOM grid tariff.",
      },
    ],
  },

  commercial: {
    id: "commercial",
    slug: "commercial",
    urlPath: "/solutions/commercial",
    name: "Commercial & Workspaces",
    category: "Corporate Offices, Hospitals, Hotels & Retail",
    tagline: "Sustainable Energy for Modern Workspaces & Commercial Assets.",
    heroImage: "/images/segments/commercial.jpg",
    executiveSummary:
      "High-efficiency solar carports and rooftop PV engineered for hospitals, tech parks, and commercial hubs to stabilize daytime HVAC loads and optimize operational ESG metrics.",
    metrics: [
      {
        label: "Typical PV Capacity",
        value: "50 – 500",
        unit: "kWp",
        sub: "Commercial Rooftop & Solar Canopy",
        icon: "Sun",
      },
      {
        label: "Commercial BESS",
        value: "50 – 300",
        unit: "kWh",
        sub: "Critical Load & Server UPS",
        icon: "BatteryCharging",
      },
      {
        label: "Operating Expense Cut",
        value: "60 – 75",
        unit: "%",
        sub: "Commercial daytime electricity bills",
        icon: "Zap",
      },
      {
        label: "Typical Payback",
        value: "3.0 – 3.8",
        unit: "Yrs",
        sub: "Accelerated tax write-offs included",
        icon: "TrendingDown",
      },
    ],
    challenges: [
      {
        traditionalPain:
          "High commercial daytime tariffs (₹10.50 – ₹13.50/unit) driven by heavy HVAC air conditioning, lighting, and elevator loads.",
        waytaraSolution:
          "Solar generation peaks precisely when commercial building HVAC cooling loads are highest, cutting expensive daytime grid draw by up to 75%.",
      },
      {
        traditionalPain:
          "Hospital operation theatres, ICU equipment, and corporate server rooms cannot tolerate even a 1-second power interruption.",
        waytaraSolution:
          "Seamless sub-20ms high-reliability power conditioning with zero sine wave distortion, safeguarding medical and IT infrastructure.",
      },
      {
        traditionalPain:
          "Tenant billing disputes in multi-tenant commercial complexes over shared power and rooftop access.",
        waytaraSolution:
          "Automated digital sub-metering allocates solar generation credits accurately across individual corporate tenants.",
      },
    ],
    hardwareArchitecture: [
      {
        title: "Commercial High-Density PV",
        tag: "Generation Tier",
        specs: ["N-Type TOPCon Cells", "Class-A Fire Rated", "Anti-Reflective Glare Free"],
        description:
          "Aesthetic, high-yield solar modules designed for corporate urban aesthetics and strict airport/urban glare compliance.",
        icon: "Sun",
      },
      {
        title: "Modular Commercial BESS",
        tag: "Storage Tier",
        specs: ["Indoor/Outdoor IP54 Enclosure", "LFP Prismatic Chemistry", "Redundant BMS"],
        description:
          "Safe, space-efficient battery cabinets providing uninterruptible power for elevators, data racks, and essential hospital equipment.",
        icon: "BatteryCharging",
      },
      {
        title: "Multi-Gun Workplace EV Chargers",
        tag: "EV Tier",
        specs: ["Dual 22 kW Level-2 AC", "Employee App Access", "Revenue Management"],
        description:
          "Smart workplace EV charging stations offering employee perks and corporate fleet charging with zero grid penalty.",
        icon: "Car",
      },
      {
        title: "Tara AI Enterprise Dashboard",
        tag: "Software Tier",
        specs: ["LEED / IGBC ESG Reporting", "Multi-Site Management", "Automated Tenant Invoicing"],
        description:
          "Cloud dashboard tracking real-time carbon offsets, energy cost per sq ft, and automated tenant energy billing statements.",
        icon: "Smartphone",
      },
    ],
    packages: [
      {
        id: "comm-office",
        name: "Corporate Office Solar",
        badge: "HVAC & Lighting Offset",
        tagline: "Cut daytime office air conditioning and lighting bills by 70%.",
        solarKw: "50 kW – 150 kWp",
        batteryKwh: "Storage-Ready / Optional BESS",
        inverterSurge: "Commercial 3-Phase Inverter",
        priceRange: "₹24L – ₹65L",
        payback: "3.0 – 3.6 Years",
        features: [
          "Directly offsets heavy daytime central HVAC chiller power draw",
          "40% Year-1 Accelerated Depreciation tax benefit",
          "LEED / IGBC Green Building accreditation points",
          "WayTara turnkey engineering, CEIG approvals & net-metering",
        ],
      },
      {
        id: "comm-hospital",
        name: "Healthcare & Hospital Microgrid",
        badge: "Critical 24/7 Power Assurance",
        tagline: "Zero-interruption clean power for ICUs, diagnostics & surgical suites.",
        solarKw: "100 kW – 350 kWp",
        batteryKwh: "100 kWh – 300 kWh LFP BESS",
        inverterSurge: "Medical-Grade UPS Hybrid",
        priceRange: "₹55L – ₹1.4Cr",
        payback: "3.2 – 3.8 Years",
        isPopular: true,
        features: [
          "Sub-20ms seamless UPS-grade auto switchover for critical medical suites",
          "Replaces noisy diesel generator run-hours with silent, clean storage",
          "Automated battery self-testing and real-time remote telemetry",
          "24/7 dedicated WayTara medical-grade engineering dispatch SLA",
        ],
      },
      {
        id: "comm-retail",
        name: "Retail Mall & Hotel Canopy",
        badge: "Solar Canopy + Workplace EV",
        tagline: "Transform open parking lots into clean power generating shaded canopies.",
        solarKw: "150 kW – 500 kWp",
        batteryKwh: "150 kWh – 400 kWh BESS",
        inverterSurge: "Integrated Canopy System",
        priceRange: "₹85L – ₹2.6Cr",
        payback: "2.9 – 3.5 Years",
        features: [
          "Provides premium shaded parking for customers and guests",
          "Integrated dual-gun 22 kW AC / 60 kW DC fast charging stations",
          "Generates ancillary revenue from EV charging sessions",
          "Enhances corporate sustainability brand appeal and customer retention",
        ],
      },
    ],
    financialModel: {
      title: "Commercial Economics & Corporate ESG Value",
      description:
        "Commercial establishments benefit from high base DISCOM tariffs (₹11–₹14/unit) and Section 32 tax depreciation, achieving a rapid 3-year payback while elevating corporate ESG and green building credentials.",
      metrics: [
        { label: "First-Year Tax Depreciation", value: "40%", sub: "Substantially lowers corporate taxable profits", highlight: true },
        { label: "Operating Cost Cut", value: "65% – 75%", sub: "Insulates against future DISCOM commercial tariff hikes" },
        { label: "Green Building Rating", value: "+12 LEED Points", sub: "Accelerates LEED / IGBC Platinum certification" },
        { label: "25-Year Net ROI", value: "4.5x Capital", sub: "Guaranteed long-term positive cashflow" },
      ],
      subsidyOrTaxNote:
        "Commercial properties can claim 40% Accelerated Depreciation in Year 1 under Section 32 of the Income Tax Act.",
      lcoeComparison: {
        solarKwh: "₹2.20",
        gridKwh: "₹11.50",
        dieselKwh: "₹29.00",
      },
    },
    caseStudy: {
      title: "Hyderabad 200-Bed Multi-Specialty Hospital",
      clientType: "Private Hospital (Gachibowli, Hyderabad)",
      location: "Hyderabad, Telangana",
      systemSize: "180 kWp Rooftop Solar + 150 kWh Medical-Grade LFP BESS",
      monthlyBillBefore: "₹4,85,000 / Month",
      monthlyBillAfter: "₹1,45,000 / Month",
      annualSavings: "₹40,80,000 / Year",
      co2Offset: "216 Tons / Year",
      quote:
        "Patient care demands flawless power. WayTara’s system has completely eliminated diesel generator stutter and cuts our monthly electricity bills by over ₹3.4 Lakhs every single month.",
      author: "Dr. K. S. Rao, Chief Medical Director",
    },
    faqs: [
      {
        question: "Can the solar system be installed as a shaded parking canopy?",
        answer:
          "Yes. WayTara specializes in waterproof solar parking canopies that protect vehicles from sun and rain while generating high-yield solar electricity and hosting EV chargers.",
      },
      {
        question: "How does the system integrate with our existing diesel generators?",
        answer:
          "Our hybrid controllers feature automated generator interlocking. If battery storage runs low during a multi-day blackout, the controller can auto-start and sync the generator without any manual switching.",
      },
      {
        question: "What maintenance is required for commercial systems?",
        answer:
          "WayTara provides comprehensive Operations & Maintenance (O&M) including semi-automated panel robotic cleaning, thermographic drone inspections, and 24/7 cloud telemetry.",
      },
    ],
  },

  ev_fleet: {
    id: "ev_fleet",
    slug: "ev-fleet",
    urlPath: "/solutions/ev-fleet",
    name: "EV Fleet & Transit Depots",
    category: "Logistics, Delivery Hubs & Bus Depots",
    tagline: "Solar-Powered High-Speed Fast Charging Infrastructure.",
    heroImage: "/images/segments/ev-fleet.jpg",
    executiveSummary:
      "High-power DC fast charging depots paired with on-site solar and containerized BESS to charge commercial fleets rapidly without overloading local utility grids.",
    metrics: [
      {
        label: "DC Fast Charging",
        value: "60 – 360",
        unit: "kW",
        sub: "Dual-Gun CCS2 & GB/T Dispensers",
        icon: "Car",
      },
      {
        label: "Battery Buffer BESS",
        value: "100 – 500",
        unit: "kWh",
        sub: "Prevents Substation Bottlenecks",
        icon: "BatteryCharging",
      },
      {
        label: "Fuel Cost Savings",
        value: "Up to 68",
        unit: "%",
        sub: "Per km operational cost reduction",
        icon: "Zap",
      },
      {
        label: "Payback Period",
        value: "2.4 – 3.2",
        unit: "Yrs",
        sub: "High fleet asset utilization",
        icon: "TrendingDown",
      },
    ],
    challenges: [
      {
        traditionalPain:
          "Charging dozens of commercial EVs simultaneously causes grid transformer overloads and hefty maximum demand surge fines.",
        waytaraSolution:
          "Integrated BESS acts as a power buffer: Discharges stored solar energy during simultaneous fleet charging spikes, keeping grid draw steady and low.",
      },
      {
        traditionalPain:
          "High DISCOM EV charging tariffs (₹8.50 – ₹11.00/kWh) eat into fleet operating profit margins.",
        waytaraSolution:
          "Fueling vehicles directly with rooftop and canopy solar generation drops effective per-unit electricity cost to ~₹2.20/kWh.",
      },
      {
        traditionalPain:
          "Driver downtime and lack of centralized charging telemetry across hundreds of delivery vehicles.",
        waytaraSolution:
          "OCPP 2.0.1 cloud software with RFID automated driver authentication, fast billing, and fleet telematics integration.",
      },
    ],
    hardwareArchitecture: [
      {
        title: "High-Capacity Canopy Solar",
        tag: "Generation Tier",
        specs: ["High Wattage Bifacial", "Driveway Canopy Structure", "Heavy Vehicle Clearance"],
        description:
          "Elevated solar canopies constructed over fleet parking lanes and depot bays, generating power while shading fleet vehicles.",
        icon: "Sun",
      },
      {
        title: "High-C Rate Buffer BESS",
        tag: "Storage Tier",
        specs: ["1C/2C Fast Discharge", "Liquid-Cooled LFP", "Active Voltage Stabilization"],
        description:
          "Rapid-discharge battery banks designed to deliver sudden burst power to multi-gun DC fast chargers without straining the grid.",
        icon: "BatteryCharging",
      },
      {
        title: "Ultra-Fast DC Dispensers",
        tag: "Charging Tier",
        specs: ["60 kW to 240 kW DC", "Dual CCS-2 Guns", "IP55 Weatherproof"],
        description:
          "Industrial fast chargers offering 15-30 minute quick top-ups for electric delivery vans, 3-wheelers, and commercial buses.",
        icon: "Car",
      },
      {
        title: "Tara AI Fleet Charging Portal",
        tag: "Software Tier",
        specs: ["OCPP 2.0.1", "Dynamic Tariff Optimization", "Fleet API Webhooks"],
        description:
          "Software scheduling charging sessions during off-peak and solar-surplus hours, logging kWh consumption per driver and vehicle VIN.",
        icon: "Smartphone",
      },
    ],
    packages: [
      {
        id: "fleet-lastmile",
        name: "Last-Mile Delivery Depot",
        badge: "2W / 3W Hub",
        tagline: "Optimized for e-commerce, quick-commerce & 3-wheeler logistics fleets.",
        solarKw: "60 kW – 120 kWp",
        batteryKwh: "75 kWh – 150 kWh BESS",
        inverterSurge: "Multi-AC & 30 kW DC Fast",
        priceRange: "₹35L – ₹72L",
        payback: "2.4 – 3.0 Years",
        features: [
          "Charges 30-50 electric two-wheelers and 3W cargo autos simultaneously",
          "Dynamic load controller prevents depot main switchboard tripping",
          "Driver RFID automated authorization and cloud telemetry",
          "Reduces per-km delivery cost from ₹2.40 (diesel/petrol) to ₹0.45 (solar)",
        ],
      },
      {
        id: "fleet-commercial-dc",
        name: "Commercial DC Transit Hub",
        badge: "Van & Bus Hub",
        tagline: "Heavy-duty dual-gun DC fast charging for commercial 4W vans & electric buses.",
        solarKw: "150 kW – 500 kWp",
        batteryKwh: "200 kWh – 600 kWh BESS",
        inverterSurge: "120 kW – 240 kW DC Fast",
        priceRange: "₹85L – ₹2.8Cr",
        payback: "2.6 – 3.3 Years",
        isPopular: true,
        features: [
          "Dual-gun CCS2 DC fast charging up to 240 kW per dispenser",
          "Battery energy buffer avoids expensive transformer upgrades with DISCOM",
          "Direct solar-to-battery-to-vehicle zero-loss energy transfer",
          "Full fleet telematics API integration with ERP & logistics dispatch",
        ],
      },
    ],
    financialModel: {
      title: "Fleet Operating Unit Economics",
      description:
        "Switching commercial fleet charging from grid power or diesel fuel to on-site solar reduces fuel cost per kilometer by up to 68%, generating massive annual operational savings for logistics operators.",
      metrics: [
        { label: "Fuel Cost per Kilometer", value: "₹0.42 / km", sub: "Compared to ₹2.60 / km for diesel commercial vans", highlight: true },
        { label: "Annual Fleet Fuel Savings", value: "₹18L – ₹65L+", sub: "Based on 30-50 active commercial fleet vehicles" },
        { label: "Transformer Upgrade Avoided", value: "₹25L – ₹40L", sub: "BESS buffer eliminates costly substation enhancements" },
        { label: "Payback Period", value: "2.6 Years", sub: "Rapid ROI due to continuous daily fleet asset utilization" },
      ],
      subsidyOrTaxNote:
        "Eligible for 40% Year-1 Accelerated Depreciation under Section 32 and state EV infrastructure incentives.",
      lcoeComparison: {
        solarKwh: "₹2.20",
        gridKwh: "₹10.50",
        dieselKwh: "₹31.00",
      },
    },
    caseStudy: {
      title: "Bengaluru Logistics Hub 40-Van Electric Fleet",
      clientType: "E-Commerce Logistics Depot (Nelamangala, Bengaluru)",
      location: "Bengaluru, Karnataka",
      systemSize: "160 kWp Solar Canopy + 200 kWh BESS + 4x 60 kW DC Fast Chargers",
      monthlyBillBefore: "₹5,20,000 / Month (Grid + Diesel)",
      monthlyBillAfter: "₹1,35,000 / Month",
      annualSavings: "₹46,20,000 / Year",
      co2Offset: "320 Tons / Year",
      quote:
        "Our electric delivery vans achieve complete turnaround in 25 minutes. Charging directly on solar energy dropped our cost-per-package delivery by 34%, giving us a huge competitive edge.",
      author: "Aditya Nair, Operations Director, SwiftMile Logistics",
    },
    faqs: [
      {
        question: "Can we install fast chargers if our local grid transformer has limited sanctioned load?",
        answer:
          "Yes. Our battery buffer BESS charges steadily from solar and off-peak grid, then discharges rapid burst power to the DC fast chargers without exceeding your sanctioned transformer capacity.",
      },
      {
        question: "What charging standards and vehicle connector types are supported?",
        answer:
          "We deploy universal dual-gun chargers supporting CCS-2 (for passenger & commercial vans), Type-2 AC (for standard charging), and GB/T / Bharat DC-001 (for 2W/3W fleets).",
      },
    ],
  },

  it_park: {
    id: "it_park",
    slug: "it-park",
    urlPath: "/solutions/it-park",
    name: "IT Parks & Data Campuses",
    category: "Tech Parks, Data Centers & R&D Hubs",
    tagline: "Mission-Critical 99.999% Power Availability for Tech Infrastructure.",
    heroImage: "/images/segments/it-park.jpg",
    executiveSummary:
      "Zero-downtime microgrids engineered for data centers and IT campuses, combining high-yield solar with millisecond UPS transfer and intelligent peak-load shaving.",
    metrics: [
      {
        label: "Typical PV Capacity",
        value: "250 kW – 5",
        unit: "MWp",
        sub: "Campus Rooftop & Parking Canopies",
        icon: "Sun",
      },
      {
        label: "High-Voltage BESS",
        value: "250 kWh – 3",
        unit: "MWh",
        sub: "Tier-III Server Grade Storage",
        icon: "BatteryCharging",
      },
      {
        label: "Annual Energy Savings",
        value: "₹45L – ₹3.2",
        unit: "Cr/Yr",
        sub: "Peak tariff & DG offset",
        icon: "Zap",
      },
      {
        label: "Uptime SLA",
        value: "99.999",
        unit: "%",
        sub: "Zero sine wave disruption",
        icon: "TrendingDown",
      },
    ],
    challenges: [
      {
        traditionalPain:
          "Data centers and cloud servers cannot tolerate even millisecond grid frequency fluctuations or harmonics.",
        waytaraSolution:
          "Server-grade power conditioning with active harmonic mitigation, zero-break transfer, and clean sinusoidal power delivery.",
      },
      {
        traditionalPain:
          "High campus electricity bills compounded by severe Time-of-Day (ToD) peak tariff surcharges during business hours.",
        waytaraSolution:
          "Tara AI automated tariff arbitrage: Stores solar energy and discharges during peak tariff hours (6 PM – 10 PM) to avoid DISCOM peak penalty rates.",
      },
      {
        traditionalPain:
          "Global tech clients demand verifiable RE100 and ESG compliance for corporate tenant leasing.",
        waytaraSolution:
          "Real-time audited ESG telemetry tracking Scope 1 and Scope 2 carbon abatement with automated certificate generation.",
      },
    ],
    hardwareArchitecture: [
      {
        title: "Campus Solar Architecture",
        tag: "Generation Tier",
        specs: ["Bifacial TopCon Panels", "Solar Carport Structures", "Low-Glare Modules"],
        description:
          "High-efficiency solar panels installed across tech park building rooftops, clubhouse terraces, and multi-acre employee parking canopies.",
        icon: "Sun",
      },
      {
        title: "Server-Grade Container BESS",
        tag: "Storage Tier",
        specs: ["High-Voltage 1000V DC", "Tier-III Data Center UPS Tier", "N+1 Redundancy"],
        description:
          "Containerized high-voltage Lithium Iron Phosphate storage systems designed for zero-interruption data center and server room power continuity.",
        icon: "BatteryCharging",
      },
      {
        title: "Campus EV Charging Infrastructure",
        tag: "EV Tier",
        specs: ["Dual-Gun 22 kW AC Chargers", "Employee RFID Access", "Corporate Billing"],
        description:
          "Dozens of smart EV charging stations installed in employee parking bays, powered by daytime rooftop solar generation.",
        icon: "Car",
      },
      {
        title: "Enterprise Microgrid Controller",
        tag: "Software Tier",
        specs: ["AI Tariff Arbitrage", "SCADA Modbus TCP/IP", "Automated ESG Reporting"],
        description:
          "AI energy management system dynamically optimizing solar generation, battery storage dispatch, and grid export across multi-building campuses.",
        icon: "Server",
      },
    ],
    packages: [
      {
        id: "it-campus-microgrid",
        name: "Tech Campus Solar Microgrid",
        badge: "500 kW to 2 MW",
        tagline: "Turnkey clean energy infrastructure for modern technology campuses.",
        solarKw: "500 kW – 2 MWp",
        batteryKwh: "500 kWh – 1.5 MWh BESS",
        inverterSurge: "HT 11 kV Substation Sync",
        priceRange: "₹1.6Cr – ₹5.8Cr",
        payback: "2.8 – 3.5 Years",
        isPopular: true,
        features: [
          "Solar canopy parking + building rooftop integrated arrays",
          "Automated Time-of-Day (ToD) tariff arbitrage saves peak surcharges",
          "Integrated 20-40 employee EV charging stations",
          "Comprehensive 10-year turnkey O&M with guaranteed generation SLA",
        ],
      },
      {
        id: "it-datacenter-tier3",
        name: "Mission-Critical Data Center Hub",
        badge: "Tier-III / IV Compliant",
        tagline: "Ultra-clean sine wave power continuity for high-density compute & server racks.",
        solarKw: "1 MW – 5 MWp",
        batteryKwh: "1 MWh – 3 MWh High-Voltage BESS",
        inverterSurge: "33 kV / 11 kV N+1 Redundant",
        priceRange: "₹3.5Cr – ₹12.5Cr",
        payback: "2.6 – 3.2 Years",
        features: [
          "Zero-break sub-5ms transfer with medical/server grade surge protection",
          "Replaces noisy diesel generator run-hours with silent, clean LFP storage",
          "Direct integration with campus Building Management Systems (BMS)",
          "40% Year-1 tax depreciation benefits under Section 32",
        ],
      },
    ],
    financialModel: {
      title: "Enterprise Microgrid Economics & ESG Impact",
      description:
        "Tech parks achieve superior financial returns by eliminating peak tariff surcharges, capturing Section 32 tax write-offs, and commanding higher lease rates from ESG-conscious multinational tenants.",
      metrics: [
        { label: "Annual Operational Savings", value: "₹85L – ₹2.8Cr", sub: "Direct electricity & diesel displacement", highlight: true },
        { label: "Carbon Offset per Year", value: "1,200+ Tons CO₂", sub: "Audited Scope 2 emissions reduction" },
        { label: "First-Year Tax Depreciation", value: "40%", sub: "Accelerated tax write-off under Section 32" },
        { label: "Payback Period", value: "3.0 Years", sub: "Long-term 25-year asset appreciation" },
      ],
      subsidyOrTaxNote:
        "Eligible for 40% Year-1 Accelerated Depreciation under Section 32 and Green Building LEED Platinum energy points.",
      lcoeComparison: {
        solarKwh: "₹2.20",
        gridKwh: "₹11.80",
        dieselKwh: "₹30.00",
      },
    },
    caseStudy: {
      title: "Hyderabad Cyber Park 1.2 MW Solar + BESS Microgrid",
      clientType: "Technology Business Park (HITEC City, Hyderabad)",
      location: "Hyderabad, Telangana",
      systemSize: "1.2 MWp Solar Canopy & Rooftop + 1 MWh Containerized BESS",
      monthlyBillBefore: "₹24,50,000 / Month",
      monthlyBillAfter: "₹6,80,000 / Month",
      annualSavings: "₹2,12,40,000 / Year",
      co2Offset: "1,440 Tons / Year",
      quote:
        "Our tech tenants demand strict 100% clean power reliability. WayTara engineered a master microgrid that cut our power expenses by over ₹2 Crore annually while delivering the ESG metrics our Fortune 500 tenants require.",
      author: "P. Venkat Reddy, VP Facilities & Infrastructure",
    },
    faqs: [
      {
        question: "How does the system ensure zero power disruption for high-density server racks?",
        answer:
          "Our enterprise PCS systems operate with ultra-fast sub-5ms static transfer switches and active harmonic filters, preventing any voltage dips, frequency jitter, or reboot on sensitive IT equipment.",
      },
      {
        question: "Can the energy data be integrated into our existing Campus Building Management System (BMS)?",
        answer:
          "Yes. Our Tara AI IoT gateways support standard industrial protocols including BACnet IP, Modbus TCP/IP, and RESTful APIs for seamless integration with Schneider, Honeywell, or Siemens BMS platforms.",
      },
    ],
  },
};

export const SEGMENT_KEYS = [
  "home",
  "apartment",
  "factory",
  "commercial",
  "ev_fleet",
  "it_park",
] as const;

export function normalizeSegmentSlug(slug?: string | null): string {
  if (!slug) return "home";
  const clean = slug.toLowerCase().replace(/-/g, "_");
  if (clean === "ev_fleet" || clean === "evfleet" || clean === "ev") return "ev_fleet";
  if (clean === "it_park" || clean === "itpark" || clean === "it") return "it_park";
  if (SEGMENT_SOLUTIONS_DATA[clean]) return clean;
  return "home";
}

export interface TopologyFlowStep {
  step: number;
  title: string;
  desc: string;
  icon: string;
}

export interface TopologyComponent {
  name: string;
  role: string;
  specs: string;
}

export interface SolarTopologyDetail {
  id: "on_grid" | "hybrid" | "off_grid";
  name: string;
  badge: string;
  tagline: string;
  shortDesc: string;
  howItWorksTitle: string;
  howItWorksDesc: string;
  flowSteps: TopologyFlowStep[];
  components: TopologyComponent[];
  pros: string[];
  cons: string[];
  subsidyAndPricing: {
    subsidyText: string;
    subsidyEligible: boolean;
    priceRange: string;
    payback: string;
  };
  idealFor: string[];
}

export interface TopologyComparisonRow {
  parameter: string;
  onGrid: string;
  hybrid: string;
  offGrid: string;
}

export const SOLAR_TOPOLOGIES_DATA: Record<string, SolarTopologyDetail> = {
  on_grid: {
    id: "on_grid",
    name: "On-Grid Solar System",
    badge: "Net-Metered • Up to ₹78,000 Subsidy",
    tagline: "Direct DISCOM grid synchronization for maximum electricity bill reduction with zero battery overhead.",
    shortDesc:
      "An on-grid solar system works in direct synchronization with your local electricity board (DISCOM) grid. It generates clean solar energy during the day to run your home appliances and automatically exports any surplus units through a bi-directional Net Meter. At night or during overcast weather, you seamlessly draw banked power credits from the grid.",
    howItWorksTitle: "How an On-Grid Solar System Works",
    howItWorksDesc:
      "A 5-step synchronized cycle connecting rooftop solar modules to the national utility grid via a smart bidirectional net-metering interface.",
    flowSteps: [
      {
        step: 1,
        title: "Daylight Solar Generation",
        desc: "High-efficiency N-Type TOPCon bifacial panels capture sunlight and generate clean direct current (DC) electricity.",
        icon: "Sun",
      },
      {
        step: 2,
        title: "High-Efficiency Inversion",
        desc: "The on-grid string inverter converts DC power to 230V/415V AC electricity synchronized with the grid frequency and voltage.",
        icon: "Zap",
      },
      {
        step: 3,
        title: "Instant Self-Consumption",
        desc: "Your active household appliances (fans, lights, ACs, refrigerators) consume solar power first, reducing grid power consumption to zero.",
        icon: "Home",
      },
      {
        step: 4,
        title: "Surplus Net-Meter Export",
        desc: "Excess units not consumed by your home are automatically exported to the DISCOM grid through a Bi-Directional Net Meter, banking financial units.",
        icon: "ArrowUpRight",
      },
      {
        step: 5,
        title: "Nighttime Grid Banking",
        desc: "At night, power is imported from the grid. At the end of the billing cycle, DISCOM offsets your import against exported units for near-zero bills.",
        icon: "Moon",
      },
    ],
    components: [
      {
        name: "Tier-1 N-Type TOPCon Solar Modules",
        role: "High-Yield Solar Generation",
        specs: "550Wp+ glass-glass bifacial panels with 22.5%+ efficiency and 25-year performance warranty.",
      },
      {
        name: "On-Grid String Inverter",
        role: "DC to AC Synchronous Conversion",
        specs: "98.4%+ efficiency, dual MPPT trackers, and built-in anti-islanding line safety protection.",
      },
      {
        name: "Bi-Directional Net Meter",
        role: "Two-Way Import/Export Billing",
        specs: "DISCOM-calibrated smart meter recording units exported vs. units imported from the utility grid.",
      },
      {
        name: "ACDB / DCDB Protective Switchgear",
        role: "Surge & Overcurrent Protection",
        specs: "Type-II surge protection devices (SPDs), IP65 rotary DC isolators, and heavy copper earthing.",
      },
    ],
    pros: [
      "Lowest initial capital cost (no battery bank required)",
      "100% eligible for Central PM Surya Ghar Subsidies (up to ₹78,000 direct DBT)",
      "Fastest payback period in the solar industry (2.8 – 3.5 years)",
      "Zero battery replacement or recurring chemical maintenance costs",
    ],
    cons: [
      "Shuts down automatically during power cuts to prevent line back-feeding (Anti-Islanding safety for linemen)",
      "Requires active DISCOM net-metering approval and inspection",
    ],
    subsidyAndPricing: {
      subsidyText: "Eligible for full Central PM Surya Ghar subsidies (₹30,000 for 1kW, ₹60,000 for 2kW, ₹78,000 for 3kW+).",
      subsidyEligible: true,
      priceRange: "₹1.95L – ₹3.6L (3 kW – 6 kWp)",
      payback: "2.8 – 3.5 Years",
    },
    idealFor: [
      "Urban homes, villas, and apartments with stable 24/7 grid electricity seeking maximum financial savings.",
      "Commercial office buildings, factories, and retail establishments aiming for near-zero monthly electricity bills.",
      "Property owners looking for the fastest return on investment (ROI) with minimal maintenance.",
    ],
  },
  hybrid: {
    id: "hybrid",
    name: "Hybrid Solar System",
    badge: "Solar + Smart LFP Storage + Grid Sync",
    tagline: "The ultimate energy resilience: net-metered savings by day and sub-20ms seamless battery backup during blackouts.",
    shortDesc:
      "A hybrid solar system combines the financial benefits of an on-grid system with the energy security of an off-grid system. It powers active appliances on solar during the day, charges an intelligent Lithium Iron Phosphate (LFP) battery bank, exports surplus units to the DISCOM grid, and automatically switches to battery power in under 20 milliseconds during power cuts with zero flicker.",
    howItWorksTitle: "How a Hybrid Solar System Works",
    howItWorksDesc:
      "An intelligent tripartite energy system coordinating solar yield, high-capacity lithium storage, and the DISCOM grid for 24/7 uninterrupted power.",
    flowSteps: [
      {
        step: 1,
        title: "Daylight Powering & Storage",
        desc: "Solar generation directly powers daytime home loads while simultaneously charging the smart LFP battery bank to 100%.",
        icon: "Sun",
      },
      {
        step: 2,
        title: "Grid Net-Meter Export",
        desc: "Once battery storage is fully charged, surplus solar power is exported to the DISCOM grid via net metering for bill credits.",
        icon: "Zap",
      },
      {
        step: 3,
        title: "Sub-20ms Blackout Switchover",
        desc: "During grid failures or voltage sags, the hybrid inverter isolates in <20ms, running heavy AC loads without any equipment reboot.",
        icon: "BatteryCharging",
      },
      {
        step: 4,
        title: "Evening Peak Battery Shaving",
        desc: "Stored battery energy discharges during expensive evening hours, shielding you from peak DISCOM tariffs.",
        icon: "TrendingDown",
      },
      {
        step: 5,
        title: "24/7 Cloud Remote Control",
        desc: "WayTara Cloud IoT continuously monitors generation, battery health, and load draw with global remote inverter controls.",
        icon: "Smartphone",
      },
    ],
    components: [
      {
        name: "Bifacial TOPCon PV Array",
        role: "High-Efficiency Solar Harvesting",
        specs: "Dual-glass N-Type modules capturing both direct and ground-reflected albedo sunshine.",
      },
      {
        name: "Bidirectional Hybrid Inverter",
        role: "Smart Multi-Port Power Routing",
        specs: "200% surge capacity for running 1.5/2.0 Ton ACs and inductive water pumps with sub-20ms UPS switchover.",
      },
      {
        name: "Smart LiFePO4 Battery Storage",
        role: "Modular 24/7 Energy Reserve",
        specs: "6,000+ cycle Lithium Iron Phosphate storage with multi-point thermal BMS and 10-year warranty.",
      },
      {
        name: "Bi-Directional Net Meter",
        role: "Grid Export & Bill Offsetting",
        specs: "Approved net-metering interface enabling up to 95% total electricity bill reduction.",
      },
    ],
    pros: [
      "100% immunity to grid power cuts with sub-20ms instant UPS switchover",
      "Full DISCOM net-metering eligibility to achieve ₹0 monthly electricity bills",
      "Eligible for PM Surya Ghar rooftop solar subsidies on the solar PV portion",
      "Easily starts and runs heavy inductive loads like 1.5/2.0 Ton Inverter ACs and refrigerators during blackouts",
    ],
    cons: [
      "Moderate initial capital investment due to lithium battery storage integration",
      "Requires dedicated wall or floor space for the modular battery enclosure",
    ],
    subsidyAndPricing: {
      subsidyText: "Solar PV portion eligible for PM Surya Ghar subsidy (up to ₹78,000). Battery bank is self-financed with high financial ROI.",
      subsidyEligible: true,
      priceRange: "₹4.5L – ₹7.2L (5 kW – 10 kWp with 10–15 kWh Storage)",
      payback: "3.5 – 4.2 Years",
    },
    idealFor: [
      "Homes and luxury villas experiencing frequent, unpredictable power cuts or voltage dips.",
      "Properties running critical medical equipment, smart home automation, and work-from-home IT setups.",
      "EV owners seeking overnight solar vehicle charging and complete blackout protection.",
    ],
  },
  off_grid: {
    id: "off_grid",
    name: "Off-Grid Solar System",
    badge: "100% Independent • Zero Grid Connection",
    tagline: "Complete standalone micro-power plant engineered for remote sites, farmhouses, and zero-grid locations.",
    shortDesc:
      "An off-grid solar system operates completely disconnected from the electrical utility grid. It is an independent, self-contained microgrid that pairs an oversized solar PV array with high-capacity Lithium or deep-cycle battery storage and an MPPT charge controller to provide 24/7 reliable electricity anywhere in the world.",
    howItWorksTitle: "How an Off-Grid Solar System Works",
    howItWorksDesc:
      "An autonomous standalone generation and deep storage system engineered for remote locations with zero dependency on DISCOM transmission lines.",
    flowSteps: [
      {
        step: 1,
        title: "Dedicated Solar Harvesting",
        desc: "Solar modules capture all available sunlight and feed high-voltage DC power into integrated MPPT charge controllers.",
        icon: "Sun",
      },
      {
        step: 2,
        title: "Direct Appliance Energization",
        desc: "The off-grid inverter supplies continuous, regulated 230V/415V AC electricity directly to all active property appliances.",
        icon: "Zap",
      },
      {
        step: 3,
        title: "Deep Battery Bank Charging",
        desc: "100% of excess solar power is directed into high-capacity LiFePO4 batteries to store energy for nighttime and overcast days.",
        icon: "BatteryCharging",
      },
      {
        step: 4,
        title: "Nighttime Autonomous Discharging",
        desc: "At night, the battery bank discharges smoothly through pure sine wave inversion to power lighting, refrigeration, and cooling loads.",
        icon: "Moon",
      },
      {
        step: 5,
        title: "Auxiliary Generator Integration",
        desc: "Built-in dry contact relays can automatically trigger an auxiliary diesel/petrol generator during extended monsoon rain periods.",
        icon: "Layers",
      },
    ],
    components: [
      {
        name: "High-Density PV Modules",
        role: "Oversized Daylight Generation",
        specs: "Generously sized bifacial solar array guaranteeing adequate battery charging even on cloudy and monsoon days.",
      },
      {
        name: "Off-Grid Pure Sine Wave Inverter",
        role: "Standalone Inversion & MPPT Control",
        specs: "Heavy-duty inverter with dual high-voltage MPPT controllers and generator auto-start signaling.",
      },
      {
        name: "Deep-Cycle LiFePO4 Storage Bank",
        role: "24/7 Autonomous Energy Reserve",
        specs: "Sized for 1 to 2 days of weather autonomy with multi-cell balancing BMS and 6,000+ cycle lifespan.",
      },
      {
        name: "Generator Auto-Start Controller",
        role: "Emergency Weather Backup",
        specs: "Seamless dry-contact integration for auxiliary generator synchronization during prolonged rainy spells.",
      },
    ],
    pros: [
      "100% energy sovereignty with zero dependence on DISCOM infrastructure or grid availability",
      "No monthly electricity bills, no tariff escalation, and no meter fixed charges forever",
      "Can be installed anywhere: remote farmhouses, agricultural lands, hills, and islands",
      "Immune to grid voltage fluctuations, brownouts, and transmission line failures",
    ],
    cons: [
      "Higher initial battery storage cost to ensure multi-day weather autonomy",
      "Cannot export surplus power for DISCOM revenue (no net metering)",
      "PM Surya Ghar residential DBT subsidy is not applicable for non-grid systems",
    ],
    subsidyAndPricing: {
      subsidyText: "PM Surya Ghar residential subsidy requires grid connection. Off-grid systems qualify for 40% accelerated commercial tax depreciation.",
      subsidyEligible: false,
      priceRange: "₹3.8L – ₹8.5L (3 kW – 10 kW with 10–25 kWh LFP Storage)",
      payback: "4.2 – 5.5 Years (Compared to diesel generator fuel costs)",
    },
    idealFor: [
      "Remote farmhouses, agricultural estates, plantation bungalows, and eco-tourism resorts.",
      "Locations where DISCOM grid connection costs (transformers and cabling) are prohibitively expensive.",
      "Areas experiencing severe 6+ hour daily power outages or extreme voltage fluctuations.",
    ],
  },
};

export const TOPOLOGY_COMPARISON_MATRIX: TopologyComparisonRow[] = [
  {
    parameter: "Grid Connection",
    onGrid: "100% Connected (Required)",
    hybrid: "Connected (Flexible)",
    offGrid: "Zero Connection (100% Standalone)",
  },
  {
    parameter: "Battery Storage Bank",
    onGrid: "Not Required",
    hybrid: "Yes (Lithium LiFePO4)",
    offGrid: "Yes (High-Capacity LiFePO4)",
  },
  {
    parameter: "Power During Grid Outages",
    onGrid: "Shuts Down (Anti-Islanding Safety)",
    hybrid: "Seamless Sub-20ms Backup (Zero Flicker)",
    offGrid: "100% Continuous 24/7 Power",
  },
  {
    parameter: "Net-Metering Bill Export",
    onGrid: "Yes (Up to 90% Bill Offset)",
    hybrid: "Yes (Up to 95% Bill Offset)",
    offGrid: "No (Self-Contained Microgrid)",
  },
  {
    parameter: "PM Surya Ghar Subsidy",
    onGrid: "Eligible (Up to ₹78,000 Direct DBT)",
    hybrid: "Eligible (On Solar PV Portion)",
    offGrid: "Not Eligible (Grid Connection Required)",
  },
  {
    parameter: "Typical Payback Period",
    onGrid: "2.8 – 3.5 Years",
    hybrid: "3.5 – 4.2 Years",
    offGrid: "4.2 – 5.5 Years (vs. Diesel Generator)",
  },
  {
    parameter: "Best Suited Location",
    onGrid: "Urban homes with stable grid",
    hybrid: "Homes with power cuts & luxury villas",
    offGrid: "Remote farmhouses, hills & zero-grid sites",
  },
];

export const SOLAR_TOPOLOGY_CONSOLIDATED_FAQS = [
  {
    question: "What is the key difference between On-Grid, Hybrid, and Off-Grid solar systems?",
    answer: "An On-Grid system works in direct synchronization with the DISCOM grid to export surplus power via a bi-directional Net Meter for bill credits, but shuts down during power cuts for lineman safety. A Hybrid system (WayTara Flagship) provides the best of both worlds: full DISCOM net-metering plus a smart Lithium (LFP) battery bank that switches on in sub-20ms during power cuts with zero flicker. An Off-Grid system is a 100% standalone microgrid with zero grid connection, relying entirely on high-capacity LiFePO4 batteries for 24/7 power in remote locations.",
  },
  {
    question: "How much does an On-Grid vs. Hybrid vs. Off-Grid solar system cost in India (2026)?",
    answer: "In 2026, On-Grid residential systems range between ₹55,000 to ₹65,000 per kW (a 1 kW turnkey system costs ~₹65,000–₹75,000, while a 3 kW system costs ~₹1.95L–₹2.15L before Central Subsidies). Hybrid solar systems with smart LFP storage typically cost ₹85,000 to ₹1,25,000 per kW depending on battery backup capacity (5 kWh to 15 kWh). Off-Grid solar systems range from ₹1,10,000 to ₹1,60,000 per kW due to heavy-duty MPPT charge controllers and large autonomous LiFePO4 battery banks.",
  },
  {
    question: "Is there a government subsidy for On-Grid, Hybrid, and Off-Grid solar systems?",
    answer: "Yes. Under the central PM Surya Ghar: Muft Bijli Yojana, residential On-Grid and Hybrid systems (solar PV component) receive direct bank transfer (DBT) subsidies of ₹30,000 for 1 kW, ₹60,000 for 2 kW, and up to ₹78,000 for 3 kW and above. Off-Grid systems do not qualify for residential PM Surya Ghar DBT subsidies because DISCOM grid synchronization is mandatory, but commercial/agricultural off-grid installations qualify for 40% accelerated tax depreciation under Section 32 of the Income Tax Act.",
  },
  {
    question: "Does an On-Grid solar system need a battery, and do solar panels work at night?",
    answer: "No, an on-grid solar system does not require a battery bank. Solar panels generate clean electricity exclusively during daylight hours. At night, your premises seamlessly draw power from the DISCOM grid, utilizing the banked energy credits generated during the day. If you need continuous power during night-time grid outages without drawing from DISCOM, a Hybrid or Off-Grid system with Lithium storage is required.",
  },
  {
    question: "Can I run an Air Conditioner (AC), refrigerator, and heavy loads on an Off-Grid or Hybrid solar system?",
    answer: "Yes, absolutely. WayTara Hybrid and Off-Grid systems are engineered with industrial pure sine-wave inverters capable of handling high inductive motor starting surges (up to 3x nominal rating). You can effortlessly power 1.5-Ton or 2.0-Ton Inverter ACs, submersible water pumps, refrigerators, and heavy kitchen appliances. A minimum 3 kW to 5 kW inverter capacity with a 5 kWh–10 kWh Lithium battery bank is recommended for multi-hour AC operation.",
  },
  {
    question: "How many batteries are required for an Off-Grid vs. Hybrid solar system?",
    answer: "Hybrid systems typically require 1 to 2 modular Lithium Iron Phosphate (LiFePO4) battery modules (5 kWh to 10 kWh) for 4 to 8 hours of critical evening peak shaving and blackout resilience. Off-Grid systems require 2 to 4 high-capacity LiFePO4 modules (10 kWh to 25 kWh) to ensure 24 to 48 hours of complete electrical autonomy across consecutive cloudy or monsoon days.",
  },
  {
    question: "Which is better for my property: On-Grid, Hybrid, or Off-Grid solar?",
    answer: "Choose On-Grid if you have stable 24/7 grid electricity with rare outages and want the fastest payback (2.8–3.5 years) and highest PM Surya Ghar subsidy. Choose Hybrid if you experience frequent power cuts, voltage dips, or run critical home-office / medical loads and desire zero-flicker backup alongside zero power bills. Choose Off-Grid if your property is a remote farmhouse, estate, resort, or agricultural land with no reliable grid connectivity.",
  },
  {
    question: "What is the typical payback period and equipment lifespan?",
    answer: "On-grid systems achieve full capital payback in 2.8 to 3.5 years; Hybrid systems break even in 3.5 to 4.2 years (offsetting power bills and diesel generator fuel); and Off-Grid systems break even in 4.2 to 5.5 years against diesel generator operating costs. All WayTara Tier-1 N-Type TOPCon bifacial modules carry a 25-year performance warranty (84.8%+ retained output), while Lithium LFP battery banks deliver over 6,000 charge cycles (15+ years lifespan).",
  },
];

