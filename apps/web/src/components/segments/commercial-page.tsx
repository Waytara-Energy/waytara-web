import { BatteryCharging, Building2, Gauge, HeartPulse, LayoutDashboard, Lightbulb, ParkingSquare, PlugZap, Store, Sun, Wind } from "lucide-react";
import { ProjectSteps } from "@/components/sections/project-steps";
import { Reveal } from "@/components/shared/reveal";
import { FaqList, type Faq } from "./faq-list";
import { EnquiryRoutes, EvidencePanel, FeatureColumns, InfoBand, NoteBlock, PolicyRows, SegmentHero, SegmentSection } from "./segment-parts";
import { SegmentShell } from "./segment-shell";

export const COMMERCIAL_PATH = "/solutions/commercial";
export const COMMERCIAL_DESCRIPTION =
  "Solar, battery storage, EV charging and energy management for offices, hospitals, hotels and retail, designed around your building's operating hours, energy demand and existing infrastructure.";

const ASSESS_HREF = "/planner?start=build&for=commercial";
const EMS_HREF = "/technology#compatibility";

const MENU = [
  { id: "priorities", label: "Priorities" },
  { id: "provide", label: "What we provide" },
  { id: "structure", label: "Project structure" },
  { id: "policy", label: "Money & policy" },
  { id: "cases", label: "Case studies" },
  { id: "process", label: "How it works" },
  { id: "faq", label: "FAQ" },
  { id: "enquire", label: "Enquire" },
];

const PRIORITIES = [
  { icon: Wind, title: "Cooling", body: "See how much power your air conditioning uses and when it runs, so you can spot where it is wasted." },
  { icon: Lightbulb, title: "Lights and lifts", body: "Track the power used by lights, lifts, pumps and other shared equipment across the building." },
  { icon: Gauge, title: "Equipment", body: "See which machines and refrigeration use the most power, and how their use changes over the day." },
  { icon: ParkingSquare, title: "Parking and EV charging", body: "Add chargers for staff, visitors or vehicles, and consider solar car parks where they fit." },
];

const BUILDING_TYPES = [
  { icon: Building2, title: "Offices", body: "Busiest in the day, so solar fits well. Add chargers for staff and visitors, and watch cooling and lighting." },
  { icon: HeartPulse, title: "Hospitals", body: "Power is needed day and night, so reliable backup comes first, alongside your existing UPS and generators." },
  { icon: Store, title: "Shops, malls and hotels", body: "Long opening hours and lots of cooling and refrigeration. Solar, batteries and chargers can work together." },
];

const PROVIDE = [
  { icon: Sun, title: "Make your own power", body: "Solar on your roof, on the ground or over car parks, sized around your space and your building's use." },
  { icon: BatteryCharging, title: "Store power", body: "Batteries for backup on key loads, and to use solar power later where the savings justify it." },
  { icon: PlugZap, title: "Charge vehicles", body: "Chargers for staff, visitors and fleets, managed from WayTara's charging software in one place." },
  { icon: LayoutDashboard, title: "Manage your energy", body: "Connect the equipment you already have to one dashboard, even if you are not adding any new solar." },
];

const STRUCTURES = [
  { icon: Building2, title: "Own it", body: "You pay for the system and own it, so the savings are yours. You are responsible for the agreed operation and upkeep." },
  { icon: Sun, title: "Pay only for the power", body: "A developer funds and runs the system. You buy the power it makes, under a contract. Not every project qualifies." },
];

const POLICY = [
  {
    tag: "Central capital subsidy",
    title: "No general PM Surya Ghar subsidy for private commercial premises",
    body: "The residential assistance under PM Surya Ghar is not a selling point for offices, hospitals, hotels or retail. Government information distinguishes commercial premises from the residential subsidy framework.",
  },
  {
    tag: "Tax treatment · Income-tax Rules 2026",
    title: "40% written-down-value depreciation",
    body: "Eligible solar power-generating systems fall in the 40% depreciation category under Appendix I of the Income-tax Rules, 2026. This is a depreciation allowance, not a 40% cash subsidy or a reduction in tax payable. Eligibility and the actual benefit depend on asset ownership and your tax position.",
  },
  {
    tag: "Tamil Nadu · Grid settlement",
    title: "Exported solar units are not offset one-for-one",
    body: "Commercial consumers shouldn't assume surplus exported solar will offset imported electricity unit for unit. TNERC Order No. 8/2021 provides distinct net-billing or net-feed-in and gross-metering mechanisms for non-domestic consumers, with capacity and connection conditions. We assess the applicable arrangement before modelling any savings.",
  },
  {
    tag: "Larger commercial loads",
    title: "Green Energy Open Access",
    body: "Businesses with at least 100 kW of sanctioned load or contracted demand can explore buying green power through open access. Multiple connections can be aggregated within the same distribution division, and captive consumers follow a separate route. Transmission, wheeling, cross-subsidy and other charges apply.",
  },
  {
    tag: "Building performance",
    title: "Energy benchmarking",
    body: "BEE's commercial-building programmes rate actual energy performance, including energy use per square metre. WayTara EMS can support monitoring and data visibility. Any formal BEE rating or compliance process is separate.",
  },
];

const PREPARE = [
  "Latest 12 months of electricity bills",
  "Contracted demand or sanctioned load, and maximum-demand details",
  "Interval consumption data, if available",
  "Roof layout, and ownership or lease information",
  "Existing solar, DG, UPS, meters and EV chargers",
  "Operating hours and occupancy pattern",
];

const STEPS = [
  { title: "Understand your building", body: "Operating hours, energy bills, roof ownership, existing infrastructure and what you want to improve." },
  { title: "Assess the opportunity", body: "We review consumption, demand, site conditions, electrical infrastructure and project feasibility." },
  { title: "Design and proposal", body: "You receive the proposed system, equipment, financial assumptions, delivery model and quotation." },
  { title: "Install and integrate", body: "We carry out the agreed EPC scope, coordinate approvals and integrate the relevant equipment." },
  { title: "Monitor and manage", body: "Supported assets connect to WayTara EMS, giving you ongoing visibility into energy performance." },
];

export const COMMERCIAL_FAQS: Faq[] = [
  {
    question: "Does my business qualify for a rooftop-solar subsidy?",
    answer:
      "The PM Surya Ghar residential subsidy doesn't apply to private commercial premises. For businesses the benefit comes from how the system is used and owned: self-consumption, tariff treatment, depreciation under the Income-tax rules and, for larger loads, open access. We assess which of these apply before modelling any savings.",
  },
  {
    question: "Can solar work in a leased commercial building?",
    answer:
      "Often, but it depends on who owns the roof and who pays the electricity bill. Roof rights, lease duration, landlord consent and the tenant's power arrangement decide which project structure is practical.",
  },
  {
    question: "Is a battery necessary with commercial solar?",
    answer:
      "No. Solar can work without storage, especially in buildings with daytime demand. Batteries are considered for selected critical loads, backup or shifting energy where the economics justify it.",
  },
  {
    question: "Can we install solar without interrupting business operations?",
    answer:
      "We plan the installation around your operations and coordinate approvals and electrical work in advance. How much interruption there is, if any, depends on the building and the connection work, and we agree it with you during design.",
  },
  {
    question: "Can we install EV chargers for employees and visitors?",
    answer:
      "Yes. We install employee, visitor and fleet chargers, can integrate solar carports, and manage supported charging stations through WayTara's OCPP software.",
  },
  {
    question: "Can WayTara manage an existing building without installing solar?",
    answer:
      "Yes. WayTara EMS connects supported inverters, meters, storage and charging equipment to one dashboard, so you can monitor performance and use the management features available, with no new solar plant needed.",
  },
  {
    question: "Can solar power be used for the entire building?",
    answer:
      "Usually it supplies part of the load. How much depends on roof or carport space, the building's consumption profile, its operating hours and the grid connection arrangement. A hospital running around the clock looks very different from an office working nine to six.",
  },
];

/** Commercial & Workspaces: offices, hospitals, hotels and retail. */
export function CommercialPage() {
  return (
    <SegmentShell
      name="Commercial & Workspaces"
      path={COMMERCIAL_PATH}
      description={COMMERCIAL_DESCRIPTION}
      faqs={COMMERCIAL_FAQS}
      menu={MENU}
      hero={
        <SegmentHero
          eyebrow="Offices · Hospitals · Hotels · Retail"
          title="Lower energy costs."
          accent="Smarter buildings."
          body="Solar, battery storage, EV charging and energy management for commercial properties, designed around your building's operating hours, energy demand and existing infrastructure."
          primary={{ label: "Assess my property", href: ASSESS_HREF }}
          secondary={{ label: "Explore EMS", href: EMS_HREF }}
          secondaryHint="Existing building · Energy management"
          image="/images/segments/commercial.jpg"
        />
      }
    >
      <SegmentSection
        id="priorities"
        badge="Building priorities"
        title="Where can your"
        accent="building improve?"
        summary="A hospital that runs all night is not a nine-to-six office."
      >
        <FeatureColumns items={PRIORITIES} />
        <Reveal direction="up" duration={700} distance={16}>
          <h3 className="mb-10 mt-20 text-[clamp(1.4rem,2vw,1.9rem)] font-bold tracking-tight text-theme-primary">Different buildings, different needs.</h3>
        </Reveal>
        <FeatureColumns items={BUILDING_TYPES} />
      </SegmentSection>

      <SegmentSection
        id="provide"
        badge="What we provide"
        title="What WayTara can do"
        accent="for your property."
        summary="We install solar, batteries and chargers. An existing building can also come to us just for energy management."
      >
        <FeatureColumns items={PROVIDE} />
      </SegmentSection>

      <SegmentSection
        id="structure"
        badge="Project structure"
        title="An investment model"
        accent="that fits your property."
        summary="Two ways to pay for it. Which one suits you depends on who owns the building."
      >
        <FeatureColumns items={STRUCTURES} />
        <NoteBlock title="Who owns the roof, and who pays the electricity bill?" className="mx-auto max-w-4xl">
          <p>In a rented building, the answer decides which option can work.</p>
        </NoteBlock>
      </SegmentSection>

      <SegmentSection
        id="policy"
        badge="Money and policy"
        title="Financial and"
        accent="regulatory points."
        summary="Not a generic commercial solar subsidy. The benefit comes from the right mix of self-consumption, tariff treatment, project ownership and operating hours."
      >
        <PolicyRows items={POLICY} />
      </SegmentSection>

      <SegmentSection
        id="cases"
        badge="Case studies"
        title="What commercial projects"
        accent="have achieved."
        summary="Two third-party projects, shown for context. They are not WayTara installations and not typical or guaranteed results."
      >
        <Reveal direction="up" duration={800} distance={24}>
          <div className="grid grid-cols-1 gap-x-14 gap-y-14 md:grid-cols-2">
            <EvidencePanel
              source="Healthcare · Chennai"
              figure="3.15 MWp"
              text="Chettinad Hospital rooftop installation, built in three stages between 2021 and 2024. Approximately ₹3 crore annual savings reported by Orb Energy."
              caveat="Vendor-reported estimate, not a guaranteed result. Site conditions and commercial tariffs decide the actual economics."
            />
            <EvidencePanel
              source="Retail · Karnataka"
              figure="110 kWp"
              text="Parekh's Signature Mall rooftop installation. Approximately ₹10.6 lakh annual savings reported by Orb Energy."
              caveat="Vendor-reported estimate, not a guaranteed result. Site conditions and commercial tariffs decide the actual economics."
            />
          </div>
        </Reveal>
      </SegmentSection>

      <ProjectSteps
        id="process"
        badge="How it works"
        title="From building assessment to"
        accent="an integrated system."
        summary="Already have a building energy system? You don't need another solar installation to start."
        steps={STEPS}
      />

      <InfoBand
        title="You don't need another solar installation to get started."
        body="Share the details of your existing solar, meters, storage, EV chargers or other supported equipment. WayTara will assess compatibility, integration requirements and the right dashboard scope."
        cta={{ label: "Explore EMS for my property", href: EMS_HREF }}
      />

      <InfoBand
        title="Keep the first enquiry light."
        body="For a proper engineering assessment we will ask for these. The first enquiry doesn't need a full electrical drawing package."
        items={PREPARE}
      />

      <SegmentSection id="faq" badge="FAQ" title="Questions commercial" accent="customers ask.">
        <Reveal direction="up" duration={700} distance={16}>
          <FaqList faqs={COMMERCIAL_FAQS} />
        </Reveal>
      </SegmentSection>

      <EnquiryRoutes
        heading="Let's make your building"
        accent="work smarter."
        newRoute={{ label: "Assess my commercial property", href: ASSESS_HREF, hint: "EPC · Solar · Storage · EV charging" }}
        existingRoute={{ label: "Discuss EMS for my building", href: EMS_HREF, hint: "Existing infrastructure · Monitoring · Integration" }}
      />
    </SegmentShell>
  );
}
