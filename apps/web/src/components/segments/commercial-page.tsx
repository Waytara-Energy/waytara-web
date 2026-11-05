import { BatteryCharging, Building2, Gauge, HeartPulse, LayoutDashboard, Lightbulb, ParkingSquare, PlugZap, Store, Sun, Wind } from "lucide-react";
import { ProjectSteps } from "@/components/sections/project-steps";
import { Reveal } from "@/components/shared/reveal";
import { FaqList, type Faq } from "./faq-list";
import { EnquiryRoutes, EvidencePanel, FeatureColumns, InfoBand, PolicyRows, SegmentHero, SegmentSection } from "./segment-parts";
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
  { icon: Wind, title: "Cooling and ventilation", body: "Understand HVAC consumption, operating schedules and opportunities to reduce unnecessary energy use." },
  { icon: Lightbulb, title: "Lighting and shared systems", body: "Monitor lighting, lifts, pumps and other common electrical loads." },
  { icon: Gauge, title: "Equipment and refrigeration", body: "Improve visibility into equipment consumption and operating patterns." },
  { icon: ParkingSquare, title: "Parking and EV charging", body: "Add workplace, visitor or fleet charging and consider solar carports where suitable." },
];

const BUILDING_TYPES = [
  {
    icon: Building2,
    title: "Offices",
    body: "Daytime cooling, lighting, lifts, occupancy schedules and employee charging. Solar can align with working-hour consumption.",
  },
  {
    icon: HeartPulse,
    title: "Hospitals and healthcare",
    body: "Continuous energy demand, critical equipment and existing UPS and DG infrastructure. Reliability and electrical coordination are essential.",
  },
  {
    icon: Store,
    title: "Retail, malls and hotels",
    body: "Extended operating hours, cooling, refrigeration, kitchens, laundry and parking. Solar, storage and EV infrastructure can be assessed together.",
  },
];

const PROVIDE = [
  {
    icon: Sun,
    tag: "EPC · Solar",
    title: "Generate power on-site",
    body: "Rooftop solar, ground-mounted systems and solar canopies designed around available space and the building's consumption.",
    note: "For property owners looking to reduce purchased grid electricity.",
  },
  {
    icon: BatteryCharging,
    tag: "EPC · Storage",
    title: "Plan for backup and flexibility",
    body: "Battery systems for selected critical loads, suitable solar integration and energy shifting where the economics justify it.",
    note: "For buildings that need a better-coordinated energy and backup arrangement.",
  },
  {
    icon: PlugZap,
    tag: "EPC · EV charging",
    title: "Bring charging to your workplace",
    body: "Install employee and visitor chargers, integrate solar carports and manage supported charging stations through WayTara's OCPP software.",
    note: "For offices, hotels, shopping centres and commercial fleets.",
  },
  {
    icon: LayoutDashboard,
    tag: "EMS · Existing buildings",
    title: "Understand and manage your energy",
    body: "Connect supported inverters, meters, storage and charging equipment to the WayTara dashboard. Monitor performance and use the management features available.",
    note: "For existing buildings that want better energy visibility without necessarily installing new solar.",
  },
];

const STRUCTURES = [
  {
    icon: Building2,
    tag: "CAPEX · Customer-owned",
    title: "Own your energy system",
    body: "The building owner funds the installation and owns the system. Energy savings accrue to the owner, who is responsible for the agreed operating and maintenance arrangements.",
  },
  {
    icon: Sun,
    tag: "OPEX / RESCO · Third-party funded",
    title: "Use solar power without funding it all upfront",
    body: "A project developer finances and operates the system, and the property buys the electricity it generates under an agreed PPA or other contract. Third-party funding depends on project eligibility, financing partners and whether the contract works.",
  },
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
        summary="Different buildings have different energy priorities. A hospital's 24-hour load shouldn't be treated like a nine-to-six office."
      >
        <FeatureColumns items={PRIORITIES} />
        <Reveal direction="up" duration={700} distance={16}>
          <p className="mb-5 mt-14 text-[11px] font-semibold uppercase tracking-[0.12em] text-theme-muted">Different buildings, different priorities</p>
        </Reveal>
        <FeatureColumns items={BUILDING_TYPES} />
      </SegmentSection>

      <SegmentSection
        id="provide"
        badge="What we provide"
        title="What WayTara can do"
        accent="for your property."
        summary="Solar, storage and EV charging are EPC projects. EMS is its own path: an existing building can come to us for EMS alone."
      >
        <FeatureColumns items={PROVIDE} />
      </SegmentSection>

      <SegmentSection
        id="structure"
        badge="Project structure"
        title="An investment model"
        accent="that fits your property."
        summary="Owners and tenants don't always have the same financial interests, so the structure matters."
      >
        <FeatureColumns items={STRUCTURES} />
        <Reveal direction="up" duration={700} distance={16}>
          <div className="mt-8 rounded-2xl border border-theme-border bg-theme-surface px-7 py-7 sm:px-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-theme-muted">One question to settle early</p>
            <p className="mt-2 text-lg font-semibold text-theme-primary">Who owns the roof, and who pays the electricity bill?</p>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-theme-secondary">
              In a leased building, roof rights, lease duration, landlord consent and the tenant&apos;s power arrangement can decide which project model is practical.
            </p>
          </div>
        </Reveal>
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
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
        kicker="EMS enquiry · Already have a building energy system?"
        title="You don't need another solar installation to get started."
        body="Share the details of your existing solar, meters, storage, EV chargers or other supported equipment. WayTara will assess compatibility, integration requirements and the right dashboard scope."
        cta={{ label: "Explore EMS for my property", href: EMS_HREF }}
      />

      <InfoBand
        kicker="What to prepare"
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
