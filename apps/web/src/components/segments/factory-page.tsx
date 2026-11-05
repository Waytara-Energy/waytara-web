import { Activity, BatteryCharging, Cable, Fuel, Gauge, LayoutDashboard, ShieldCheck, Sun, TrendingDown } from "lucide-react";
import { ProjectSteps } from "@/components/sections/project-steps";
import { Reveal } from "@/components/shared/reveal";
import { FaqList, type Faq } from "./faq-list";
import { EnquiryRoutes, EvidencePanel, FeatureColumns, InfoBand, PolicyRows, SegmentHero, SegmentSection, SupportPanel } from "./segment-parts";
import { SegmentShell } from "./segment-shell";

export const FACTORY_PATH = "/solutions/factory";
export const FACTORY_DESCRIPTION =
  "Industrial solar, battery storage and generator-integrated energy systems designed around your plant's operating requirements, with EMS for the equipment you already have.";

const ASSESS_HREF = "/planner?start=build&for=factory";
const EMS_HREF = "/technology#compatibility";

const MENU = [
  { id: "priorities", label: "Priorities" },
  { id: "provide", label: "What we provide" },
  { id: "battery", label: "When a battery fits" },
  { id: "bess", label: "Tamil Nadu BESS" },
  { id: "money", label: "Money & tax" },
  { id: "case", label: "Case study" },
  { id: "process", label: "How it works" },
  { id: "faq", label: "FAQ" },
  { id: "enquire", label: "Enquire" },
];

const PRIORITIES = [
  { icon: Gauge, title: "Manage electricity costs", body: "Understand when your factory uses power, what drives your bill and where energy can be optimised." },
  { icon: Fuel, title: "Reduce diesel dependence", body: "Integrate solar and storage with existing generators where this can reduce fuel use and running hours." },
  { icon: ShieldCheck, title: "Protect critical operations", body: "Design backup around the machinery and processes that cannot afford to stop." },
  { icon: Activity, title: "See where energy goes", body: "Monitor connected equipment, consumption, generation and performance through WayTara EMS." },
];

const PROVIDE = [
  {
    icon: Sun,
    tag: "Solar EPC",
    title: "Generate power on-site",
    body: "Rooftop, ground-mounted and canopy solar designed around your available space, operating hours and electricity consumption.",
  },
  {
    icon: BatteryCharging,
    tag: "Battery storage & integration",
    title: "Store and manage power",
    body: "Battery systems integrated with solar, the grid and existing DG infrastructure, for suitable peak-demand and backup requirements.",
  },
  {
    icon: LayoutDashboard,
    tag: "Energy management · EMS",
    title: "Monitor and manage your energy",
    body: "Bring compatible inverters, meters, batteries and generators into one monitoring and management environment. Existing systems can be assessed on their own, without new EPC work.",
  },
];

const BATTERY_CASES = [
  { icon: TrendingDown, title: "Peak-demand management", body: "Discharge during suitable demand peaks to reduce maximum-demand exposure." },
  { icon: Sun, title: "Solar energy utilisation", body: "Store surplus daytime generation for later use where the economics support it." },
  { icon: ShieldCheck, title: "Critical-load backup", body: "Support selected machinery and production processes during outages." },
  { icon: Cable, title: "DG integration", body: "Coordinate battery, solar and existing generators to reduce unnecessary generator runtime." },
];

const MONEY = [
  {
    tag: "Project economics",
    title: "Savings depend on your plant",
    body: "Consumption, tariff category, maximum demand, solar utilisation, DG fuel spend and battery operating costs all matter. We don't publish project returns because they would not be yours.",
  },
  {
    tag: "Tax treatment",
    title: "40% written-down-value depreciation",
    body: "Eligible solar power-generating assets may qualify for 40% written-down-value depreciation under the Income-tax Rules, 2026. This is a depreciation allowance, not a 40% subsidy or a reduction in tax payable. How a battery is classified needs separate tax advice.",
  },
  {
    tag: "Off-site renewable power",
    title: "Green Energy Open Access",
    body: "Eligible consumers with contracted demand or sanctioned load of at least 100 kW can explore green power procurement where on-site generation is not enough. Captive consumers have no minimum load limit. Transmission, wheeling and other charges must be part of the comparison.",
  },
  {
    tag: "Energy-performance reporting",
    title: "BEE PAT",
    body: "Certain designated industrial consumers must manage and report specific energy consumption. EMS can support visibility and data collection. It does not itself confer PAT compliance or Energy Saving Certificates.",
  },
];

const READY = [
  "Previous 12 months of electricity bills and maximum-demand information",
  "15-minute interval load data, if available",
  "Existing solar and battery details",
  "DG ratings, operating hours and diesel consumption",
  "Single-line electrical diagram and critical-load information",
];

const STEPS = [
  { title: "Understand your operation", body: "Tell us about your electricity use, production schedule, machinery, existing solar and generators." },
  { title: "Assess the facility", body: "We review energy bills, demand patterns, critical loads, motor requirements, roof and electrical infrastructure." },
  { title: "Engineer your solution", body: "You receive a proposed system design, equipment details, expected performance and a project quotation." },
  { title: "Install, integrate and commission", body: "We carry out the agreed EPC scope, integrate the equipment and configure EMS where it is included." },
  { title: "Monitor and manage", body: "You get visibility into connected equipment and energy performance through WayTara EMS." },
];

export const FACTORY_FAQS: Faq[] = [
  {
    question: "Can a battery replace our diesel generator?",
    answer:
      "Not as a rule. Solar and batteries can work alongside existing DG sets and reduce generator runtime in suitable conditions, but we don't assume the generator can be removed. Critical loads, starting currents and backup duration decide what is realistic.",
  },
  {
    question: "Does every factory need battery storage?",
    answer:
      "No. A battery should solve a real operating or financial problem, such as peak demand, critical-load backup or generator runtime. Many factories do well with solar alone.",
  },
  {
    question: "Can we add storage to our existing solar installation?",
    answer: "Often, depending on your inverters, the electrical arrangement and what the battery is meant to do. We check compatibility during assessment.",
  },
  {
    question: "Can solar reduce our maximum-demand charges?",
    answer:
      "Solar can help, but not reliably on its own, because maximum demand can occur when solar output is low. Storage can be assessed for peak-demand management. We look at your demand data before saying what is possible.",
  },
  {
    question: "Does Tamil Nadu's new BESS policy give every factory a battery subsidy?",
    answer:
      "No. The policy is not a general capital subsidy for factory batteries. Its provisions mostly concern MW-scale projects, and any charge waiver needs TNERC approval and compliance with the policy's conditions. A battery used entirely on-site may benefit little from it.",
  },
  {
    question: "Can WayTara manage an existing plant without installing new solar?",
    answer: "Yes. We can assess EMS integration with your existing equipment, subject to communication and compatibility requirements.",
  },
];

/** Factory & Industrial: control costs, protect production, with EMS as its own route. */
export function FactoryPage() {
  return (
    <SegmentShell
      name="Factory & Industrial"
      path={FACTORY_PATH}
      description={FACTORY_DESCRIPTION}
      faqs={FACTORY_FAQS}
      menu={MENU}
      hero={
        <SegmentHero
          eyebrow="Factories · Industrial facilities · Manufacturing"
          title="Control energy costs."
          accent="Protect critical production."
          body="WayTara designs and installs industrial solar, battery storage and generator-integrated energy systems around your plant's operating requirements. Already have an energy system? WayTara EMS connects and manages compatible equipment through one platform."
          primary={{ label: "Assess my factory", href: ASSESS_HREF }}
          secondary={{ label: "Manage my existing plant", href: EMS_HREF }}
          secondaryHint="Monitoring and management · EMS"
          image="/images/segments/factory.jpg"
        />
      }
    >
      <SegmentSection
        id="priorities"
        badge="On the factory floor"
        title="What matters"
        accent="in your plant?"
        summary="We start with how your plant runs, not with panel wattage or battery capacity."
      >
        <FeatureColumns items={PRIORITIES} />
      </SegmentSection>

      <SegmentSection
        id="provide"
        badge="What we provide"
        title="Energy solutions built"
        accent="around your operation."
        summary="Solar and storage are EPC projects. EMS is its own route, so a plant that already has equipment can start there."
      >
        <FeatureColumns items={PROVIDE} />
        <Reveal direction="up" duration={700} distance={16}>
          <p className="mt-6 text-sm text-theme-secondary">EV charging infrastructure can also be added for factory fleets and site vehicles where required.</p>
        </Reveal>
      </SegmentSection>

      <SegmentSection
        id="battery"
        badge="Battery storage"
        title="When does a battery"
        accent="make sense?"
        summary="A battery should solve a real operating or financial problem. It shouldn't be included just because the project has solar."
      >
        <FeatureColumns items={BATTERY_CASES} />
        <Reveal direction="up" duration={700} distance={16}>
          <div className="mt-8 grid grid-cols-1 gap-x-10 gap-y-6 text-sm leading-relaxed text-theme-secondary md:grid-cols-3">
            <p>
              <span className="block font-semibold text-theme-primary">The right battery starts with your load profile.</span>
              We assess operating patterns, peak demand, motor starting requirements, critical loads, DG usage and tariff structure before recommending storage.
            </p>
            <p>
              <span className="block font-semibold text-theme-primary">kW is power.</span>
              It sets how much the battery can deliver at once.
            </p>
            <p>
              <span className="block font-semibold text-theme-primary">kWh is energy.</span>
              It sets how much the battery stores, and so how long it can supply a load.
            </p>
          </div>
        </Reveal>
      </SegmentSection>

      <SegmentSection
        id="bess"
        badge="Tamil Nadu BESS Policy 2026"
        title="Battery storage is becoming"
        accent="part of industrial planning."
        summary="A new state policy puts storage on the agenda for MW-scale projects. It is not a subsidy for an individual factory's battery."
      >
        <SupportPanel
          kicker="Tamil Nadu · BESS Policy 2026"
          headline="2.5 GW / 10 GWh"
          intro="The state's announced battery storage target for the policy period."
          figures={[
            { value: "10% + 4 h", label: "Minimum battery power and discharge time for specified new solar projects of 1 MW and above" },
            { value: "10 years", label: "Possible transmission and wheeling charge waiver for eligible BESS projects" },
          ]}
          conditionsTitle="What this could mean for industrial projects"
          conditions={[
            "Large solar projects can require integrated battery storage.",
            "Standalone BESS above 1 MW AC can be developed on eligible private consumer networks.",
            "Covered BESS projects need energy management, battery management, monitoring and reporting infrastructure.",
            "Charge waivers need TNERC approval and compliance with the policy's conditions. A battery used entirely on-site may benefit little.",
            "This is not a general factory battery subsidy. The policy's commencement depends on Gazette publication, so confirm implementation status and your project's eligibility before relying on any incentive.",
          ]}
          link={{ label: "Explore a BESS opportunity for your facility", href: ASSESS_HREF }}
        />
      </SegmentSection>

      <SegmentSection
        id="money"
        badge="The financial picture"
        title="Mechanisms, not"
        accent="invented returns."
        summary="Actual tariff, depreciation and eligibility treatment is evaluated for your consumer category, project ownership and the regulations that apply."
      >
        <PolicyRows items={MONEY} />
      </SegmentSection>

      <SegmentSection
        id="case"
        badge="Case study"
        title="What an industrial project"
        accent="can look like."
        summary="A published project by another company, shown to illustrate the approach. It is not a WayTara installation."
      >
        <Reveal direction="up" duration={800} distance={24}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <EvidencePanel
              source="Published industry case study · Chennai"
              figure="800 kW"
              text="Asian Paints rooftop solar, coordinated with grid supply and four existing diesel generator sets. It shows why industrial systems should be engineered around the site, not installed as disconnected parts."
              caveat="Tata Power's reported project, not a WayTara project or a guaranteed customer outcome."
            />
            <EvidencePanel
              source="Same project · as reported by Tata Power"
              figure="₹78 lakh"
              text="Annual energy-expenditure savings reported, with an annual emissions reduction of about 640 tonnes."
              caveat="Reported results for one site. Your savings depend on your own consumption, tariff and operations."
            />
          </div>
        </Reveal>
      </SegmentSection>

      <ProjectSteps
        id="process"
        badge="How a factory project works"
        title="From plant assessment to"
        accent="a working energy system."
        summary="Already have an industrial energy system? You don't need a new solar project to start."
        steps={STEPS}
      />

      <InfoBand
        kicker="EMS enquiry · Already have an industrial energy system?"
        title="Start with EMS. You don't need a new solar project."
        items={[
          "Share your existing inverter, meter, battery and DG details",
          "WayTara checks equipment compatibility and communication options",
          "We assess integration and dashboard requirements",
          "You receive an EMS proposal for your facility",
        ]}
        cta={{ label: "Explore EMS for my factory", href: EMS_HREF }}
      />

      <InfoBand
        kicker="What to have ready"
        title="Start with your latest electricity bill."
        body="A description of what you want to improve is enough to begin. During assessment the engineering team may ask for the items here. If interval data isn't available, a measurement exercise can come first, in place of an invented capacity or quotation."
        items={READY}
      />

      <SegmentSection id="faq" badge="FAQ" title="Questions from" accent="industrial customers.">
        <Reveal direction="up" duration={700} distance={16}>
          <FaqList faqs={FACTORY_FAQS} />
        </Reveal>
      </SegmentSection>

      <EnquiryRoutes
        heading="Let's understand your factory's"
        accent="energy requirements."
        newRoute={{ label: "Request an industrial energy assessment", href: ASSESS_HREF, hint: "Solar · BESS · DG integration · EPC" }}
        existingRoute={{ label: "Discuss EMS for your existing plant", href: EMS_HREF, hint: "Monitoring · Integration · Energy management" }}
      />
    </SegmentShell>
  );
}
