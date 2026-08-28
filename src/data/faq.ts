export type FaqCategoryType = "solar_battery" | "software_hardware" | "money_roi";

export interface FaqItem {
  id: string;
  category: FaqCategoryType;
  question: string;
  answer: string;
  segmentRelevance?: ("home" | "commercial" | "ev_fleet")[];
}

export const FAQ_CATEGORIES = [
  { id: "solar_battery", label: "Solar, Battery & Storage" },
  { id: "software_hardware", label: "Software & Hardware" },
  { id: "money_roi", label: "Money & ROI" },
] as const;

export const FAQ_DATA: FaqItem[] = [
  // 1. Solar, Battery & Storage (4 Questions)
  {
    id: "sb-1",
    category: "solar_battery",
    question: "How much roof area is needed for a typical 5 kW residential system?",
    answer:
      "A 5 kW system using high-efficiency monocrystalline bi-facial panels typically requires approximately 300 to 380 square feet of shadow-free rooftop space. We offer elevated superstructures that keep your terrace usable for recreation or garden setups.",
    segmentRelevance: ["home", "commercial"],
  },
  {
    id: "sb-2",
    category: "solar_battery",
    question: "What happens on rainy or overcast monsoon days?",
    answer:
      "Modern mono-PERC and bi-facial modules absorb diffused ambient daylight and continue generating roughly 25% to 45% of peak capacity even under heavy cloud cover. When coupled with a WayTara battery, your property automatically balances solar, stored battery power, and grid backup without any manual intervention.",
    segmentRelevance: ["home", "commercial"],
  },
  {
    id: "sb-3",
    category: "solar_battery",
    question: "Why does WayTara use Lithium Iron Phosphate (LFP) over lead-acid?",
    answer:
      "Lead-acid batteries degrade rapidly in Indian summer heat, require hazardous water top-ups, and last barely 2-3 years (800-1000 cycles). WayTara exclusively deploys Smart LFP (LiFePO4) storage rated for 6,000+ deep cycles (12-15+ years lifespan), with zero maintenance, active BMS thermal protection, and 95% round-trip energy efficiency.",
    segmentRelevance: ["home", "ev_fleet"],
  },
  {
    id: "sb-4",
    category: "solar_battery",
    question: "Will my heavy appliances like Air Conditioners and pumps run during a power cut?",
    answer:
      "Yes. Our hybrid inverters are engineered with high surge capacities (up to 200% for 10 seconds) specifically to start heavy inductive motor loads such as 1.5-ton/2.0-ton inverter ACs, submersible water pumps, and refrigerators with seamless sub-20ms switchover — ensuring no reboot on desktop computers or Wi-Fi routers.",
    segmentRelevance: ["home", "commercial"],
  },

  // 2. Software & Hardware (4 Questions)
  {
    id: "sh-1",
    category: "software_hardware",
    question: "How does the WayTara App and Tara AI software manage my power?",
    answer:
      "The WayTara App connects to your on-site IoT gateway to deliver real-time live telemetry: daily generation, battery state-of-charge, grid export, and bill savings. Tara AI autonomously optimizes power flow — directing surplus sunshine into storage or EV charging, avoiding peak grid tariffs, and diagnosing faults before they affect your power supply.",
    segmentRelevance: ["home", "commercial", "ev_fleet"],
  },
  {
    id: "sh-2",
    category: "software_hardware",
    question: "Do you provide remote monitoring, firmware updates, and single-warranty service?",
    answer:
      "Yes. WayTara is your single accountable partner for hardware, IoT firmware, and electrical engineering. Our cloud gateway monitors telemetry 24/7 and delivers Over-The-Air (OTA) algorithm updates. If an on-site issue ever arises, our certified power engineers are dispatched with a guaranteed turnaround SLA.",
    segmentRelevance: ["home", "commercial", "ev_fleet"],
  },
  {
    id: "sh-3",
    category: "software_hardware",
    question: "Can I charge my Electric Vehicle (EV) directly from solar using smart software?",
    answer:
      "Yes. WayTara smart EV chargers integrate directly with Tara AI to enable Solar-Sync Charging. When surplus rooftop solar is detected, the system dynamically ramps up vehicle charging to absorb free solar energy before exporting to the grid at low feed-in tariffs.",
    segmentRelevance: ["home", "commercial", "ev_fleet"],
  },
  {
    id: "sh-4",
    category: "software_hardware",
    question: "What tier of hardware components does WayTara deploy?",
    answer:
      "We exclusively use BloombergNEF Tier-1 N-type TOPCon panels, IEC 62619 certified Grade-A prismatic LFP battery cells, and high-efficiency hybrid inverters with dual MPPT tracking, IP65 weatherproofing, and 25-year structural warranties.",
    segmentRelevance: ["home", "commercial", "ev_fleet"],
  },

  // 3. Money & ROI (4 Questions)
  {
    id: "m-1",
    category: "money_roi",
    question: "What is the typical payback period for an integrated WayTara system?",
    answer:
      "Most residential and commercial systems achieve full payback in 3.0 to 4.5 years. With escalating grid power tariffs across Indian DISCOMs (averaging 5-8% annual hikes) and central PM Surya Ghar subsidies up to ₹78,000 for residential rooftops, your capital investment produces an effective internal rate of return (IRR) of 22%–28% annually.",
    segmentRelevance: ["home", "commercial"],
  },
  {
    id: "m-2",
    category: "money_roi",
    question: "Are there low-interest financing and EMI options available?",
    answer:
      "Yes. WayTara has partnered with leading green financing institutions and nationalized banks (including SBI, Canara Bank, and leading NBFCs) to offer collateral-free solar loans with EMI schemes starting as low as ₹2,999/month. In most cases, your monthly loan EMI is less than your previous monthly grid electricity bill.",
    segmentRelevance: ["home"],
  },
  {
    id: "m-3",
    category: "money_roi",
    question: "How do commercial tax benefits (Accelerated Depreciation) work?",
    answer:
      "Under Section 32 of the Indian Income Tax Act, commercial enterprises and businesses can claim 40% Accelerated Depreciation in Year 1 on solar energy equipment. This substantially reduces corporate tax liability and can recover up to 25-30% of total project cost within the very first financial year.",
    segmentRelevance: ["commercial", "ev_fleet"],
  },
  {
    id: "m-4",
    category: "money_roi",
    question: "How does net metering credit excess generation back to my bill?",
    answer:
      "A bi-directional net meter installed by your local DISCOM records both the power you pull from the grid and the excess solar electricity you export. At the end of each billing cycle, exported units are subtracted from imported units. Any surplus credit is carried forward or monetized per state DISCOM regulations.",
    segmentRelevance: ["home", "commercial"],
  },
];
