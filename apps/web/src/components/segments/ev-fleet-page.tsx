import Link from "next/link";
import { Activity, ArrowRight, ArrowUpRight, BatteryCharging, CircleCheck, ClipboardList, Handshake, ListChecks, Moon, Network, PlugZap, SlidersHorizontal, Sun, Truck, Zap } from "lucide-react";
import { ProjectSteps } from "@/components/sections/project-steps";
import { Reveal } from "@/components/shared/reveal";
import { FaqList, type Faq } from "./faq-list";
import { CPMS_FEATURES } from "./capabilities";
import { EnquiryRoutes, FeatureColumns, InfoBand, NoteBlock, PlatformDiagram, PolicyRows, SegmentHero, SegmentSection, type Feature } from "./segment-parts";
import { SegmentShell } from "./segment-shell";

export const EV_FLEET_PATH = "/solutions/ev-fleet";
export const EV_FLEET_DESCRIPTION =
  "EV charging infrastructure for fleet depots and charging networks, with WayTara's own OCPP charge-point management software to monitor and manage compatible chargers.";

const PLAN_HREF = "/planner?start=charge&for=ev-fleet";
const CPMS_HREF = "/technology#compatibility";

const MENU = [
  { id: "entry", label: "Entry points" },
  { id: "setups", label: "Charging setups" },
  { id: "design", label: "Site design" },
  { id: "managed", label: "Managed charging" },
  { id: "solar", label: "Solar & storage" },
  { id: "cpms", label: "WayTara CPMS" },
  { id: "models", label: "Business models" },
  { id: "framework", label: "India framework" },
  { id: "process", label: "How it works" },
  { id: "faq", label: "FAQ" },
  { id: "enquire", label: "Enquire" },
];

const ENTRY = [
  { icon: Truck, title: "Fleet depots", body: "Charge company-owned vehicles around their routes, shifts and return-to-depot schedules, from logistics to buses." },
  { icon: Network, title: "Public charging", body: "Set up charging locations and run them as a service for customers, from highway sites to charging hubs." },
  { icon: PlugZap, title: "Chargers you already have", body: "Already have chargers installed? Connect compatible OCPP chargers to WayTara CPMS and manage them in one place." },
];

const SETUPS = [
  { icon: Moon, title: "Overnight AC charging", body: "Slower charging for vehicles that return to base and stay parked for hours, such as overnight or between shifts." },
  { icon: Zap, title: "DC fast charging", body: "Fast charging for vehicles that need a lot of energy in a short stop. It needs a stronger power connection." },
  { icon: SlidersHorizontal, title: "Mixed charging", body: "Combine slow and fast chargers and different charging schedules to match how your vehicles work day to day." },
];

const DESIGN_FACTORS = [
  { title: "Vehicles and energy needs", body: "How many vehicles operate daily, and how much energy does each need between trips?" },
  { title: "Charging points", body: "How many vehicles need to be connected at the same time?" },
  { title: "Charging window", body: "Are vehicles parked overnight, between shifts or only briefly?" },
  { title: "Available electrical capacity", body: "What can the existing connection supply, and what would an upgrade involve?" },
  { title: "Future fleet growth", body: "Can the electrical distribution and charging software handle more vehicles and chargers later?" },
];

const SOLAR = [
  { icon: Sun, title: "Daytime charging", body: "Use available solar power to charge vehicles that are parked during the day, while the sun is shining." },
  { icon: BatteryCharging, title: "Battery-backed charging", body: "Store power and use it when vehicles charge, where the extra equipment and energy losses make economic sense." },
];

const CPMS_TILES: Feature[] = [
  { icon: Activity, title: "Charger status", body: "Monitor your connected chargers: whether each is available or in use, and its operating status." },
  { icon: SlidersHorizontal, title: "Remote control", body: "Read charger information and start or stop a charging session remotely, on chargers that support it." },
  { icon: ClipboardList, title: "Charging records", body: "Understand how much each charger is used with session and energy records for every charger." },
  { icon: ListChecks, title: "Know your chargers", body: "See which OCPP features each charger offers, including smart-charging limits, before you plan around them." },
  ...(CPMS_FEATURES.monetisation
    ? [{ icon: Handshake, title: "Paid charging", body: "Set up users, access and payment for commercial charging." }]
    : []),
];

const MODELS = [
  { icon: Truck, title: "Your own fleet", body: "Charge your own vehicles to a plan, so they are ready when needed and your energy spend stays under control." },
  { icon: Network, title: "Charging as a business", body: "Offer charging to customers and manage your station availability and charging sessions through CPMS." },
  { icon: Handshake, title: "Host a charging site", body: "Let a charging operator set up chargers at your property and agree how costs and income are shared." },
];

const REVENUE_DRIVERS = [
  "Vehicles using the site",
  "Energy sold per charger",
  "Electricity and demand costs",
  "Service charges and pricing",
  "Land and equipment costs",
  "Chargers working reliably",
];

const FRAMEWORK = [
  {
    tag: "National framework · 2024",
    title: "Public charging is a de-licensed activity",
    body: "Private entities can set up and run public charging stations, provided the applicable technical, safety and performance requirements are met.",
  },
  {
    tag: "Connection",
    title: "Plan the electricity connection early",
    body: "The 2024 national framework provides for LT connections up to 150 kW for separately connected EV charging stations, subject to the prescribed conditions and how states implement it.",
  },
  {
    tag: "Connection timelines",
    title: "3, 7 or 15 days after a complete application",
    body: "The central framework specifies 3 days in metropolitan areas, 7 days in other municipal areas and 15 days in rural areas after a complete application. Where new distribution mains or a new substation are needed, it allows up to 90 days. These are connection timelines, not a project deployment guarantee.",
  },
  {
    tag: "Open protocols",
    title: "OCPP, OCPI and other open protocols",
    body: "The framework recognises open protocols to support charger communication, network interoperability and demand response.",
  },
  {
    tag: "Tariffs and commercial planning",
    title: "Check the current rules before you model returns",
    body: "The framework sets a single-part supply tariff for charging, separate metering (with sub-metering allowed behind existing HT connections) and service-charge ceilings for public and community charging, all subject to review. We point you to the official guidelines rather than print a table that could go out of date.",
  },
  {
    tag: "Tamil Nadu",
    title: "20,000 public charging stations announced",
    body: "The Tamil Nadu Budget 2026–27 announces 20,000 public charging stations over five years through public-private partnerships. It is a state deployment target, not a guaranteed contract or a direct subsidy for every private operator. For a Tamil Nadu project we assess location, connection feasibility, land, current tariff orders and any project-specific incentives, and verify whether the 2023 state EV policy's incentives are still open to claim.",
  },
];

const STEPS = [
  { title: "Understand your operation", body: "Vehicle numbers, charger requirements, charging windows, simultaneous demand and future growth." },
  { title: "Assess the site and connection", body: "We review sanctioned load, electrical infrastructure, parking, civil works and available space." },
  { title: "Design the charging system", body: "Charger types (AC or DC), distribution, load management and any solar or battery integration that fits." },
  { title: "Install and commission", body: "We complete the agreed EPC scope, electrical works, safety checks and charger commissioning." },
  { title: "Configure CPMS and manage operations", body: "We connect compatible chargers, configure the software and hand over the operating platform." },
];

const PREPARE = [
  "Vehicle types and number of vehicles",
  "Number of chargers planned",
  "Number of vehicles charging at the same time",
  "Charging window and daily energy requirement",
  "Existing sanctioned load and electricity connection",
  "Existing solar, battery or DG equipment, if any",
  "Future fleet expansion plans",
];

export const EV_FLEET_FAQS: Faq[] = [
  {
    question: "Do I need one charger for every vehicle?",
    answer:
      "Not always. It depends on how many vehicles must charge at the same time and how long they stay parked. Vehicles that stay overnight can often share chargers or take turns, while short turnarounds need more charging points or faster charging. We size it from your operating schedule.",
  },
  {
    question: "Can smart charging help avoid a connection upgrade?",
    answer:
      "It can reduce simultaneous peak demand and may defer an upgrade, but that is not guaranteed. A load study has to show whether your supply can deliver the energy you need within your operating window, and the charger models must support the controls involved.",
  },
  {
    question: "Can rooftop solar charge my fleet overnight?",
    answer:
      "Not directly. Solar generates in the day, so for an overnight fleet it mostly offsets the facility's daytime consumption. Battery storage can move some solar energy into the night, but its cost, capacity and cycling need to be evaluated.",
  },
  {
    question: "Can WayTara manage chargers from other manufacturers?",
    answer:
      "Compatible OCPP chargers, yes. Tell us the make, model, OCPP version and network setup, and we assess compatibility and what onboarding would need. The functions available depend on each charger's supported OCPP features and firmware.",
  },
  {
    question: "Can I charge customers and earn revenue?",
    answer:
      "Public charging can be a commercial service, and the national framework sets how fees are made up: electricity tariff, service charge, land cost where applicable and GST. What you earn depends on utilisation, tariffs, service fees and your land, equipment and maintenance costs, so we don't quote a figure. Tell us the setup you have in mind and we will discuss what is needed.",
  },
  {
    question: "Can I add CPMS to an existing charging network?",
    answer: "If your chargers support OCPP, usually yes, without replacing them. We start with the charger make, model, OCPP version and network setup.",
  },
  {
    question: "Do public charging stations require a licence?",
    answer:
      "Public charging is a de-licensed activity under the national framework: private entities can set up and run stations if the applicable technical, safety and performance requirements are met. Connection, local approvals and tariff rules still apply.",
  },
];

/** A picture of how managed charging shares site capacity between vehicles. Illustrative only; it makes no claim about a product feature. */
function AllocationSketch() {
  // Share of each charger's maximum power in this example: two priority vehicles at full power, the rest sharing what is left.
  const rows = [
    { name: "Vehicle 01", share: 100, priority: true },
    { name: "Vehicle 02", share: 100, priority: true },
    { name: "Vehicle 03", share: 55, priority: false },
    { name: "Vehicle 04", share: 55, priority: false },
    { name: "Vehicle 05", share: 55, priority: false },
    { name: "Vehicle 06", share: 55, priority: false },
    { name: "Vehicle 07", share: 55, priority: false },
    { name: "Vehicle 08", share: 55, priority: false },
  ];
  return (
    <div>
      <p className="text-lg font-semibold tracking-tight text-theme-primary">Eight charging points, one site connection</p>
      <ul className="mt-6 space-y-3" aria-label="An example of charging power shared between eight vehicles">
        {rows.map((row) => (
          <li key={row.name} className="grid grid-cols-[5.5rem_1fr] items-center gap-3 text-xs text-theme-secondary">
            <span>{row.name}</span>
            <span className="relative h-2.5 overflow-hidden rounded-full bg-theme-border" role="img" aria-label={`${row.share}% of the charger's maximum power`}>
              <span className={row.priority ? "absolute inset-y-0 left-0 rounded-full bg-emerald-500" : "absolute inset-y-0 left-0 rounded-full bg-emerald-500/45"} style={{ width: `${row.share}%` }} />
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-5 flex flex-wrap gap-x-5 gap-y-1 text-xs text-theme-muted">
        <span className="inline-flex items-center gap-2"><span className="size-2.5 rounded-full bg-emerald-500" aria-hidden="true" />Priority: leaves soonest</span>
        <span className="inline-flex items-center gap-2"><span className="size-2.5 rounded-full bg-emerald-500/45" aria-hidden="true" />Shares the rest</span>
      </div>
      <p className="mt-4 text-xs leading-relaxed text-theme-muted">
        Illustration of the idea only. Actual allocation depends on the site&apos;s available capacity, the vehicles&apos; needs and what each charger supports.
      </p>
    </div>
  );
}

/** EV Fleets & Charging: depots, public networks and existing networks, with WayTara CPMS as a product in its own right. */
export function EvFleetPage() {
  return (
    <SegmentShell
      name="EV Fleets & Charging"
      path={EV_FLEET_PATH}
      description={EV_FLEET_DESCRIPTION}
      faqs={EV_FLEET_FAQS}
      menu={MENU}
      hero={
        <SegmentHero
          eyebrow="EV fleets · Depots · Charging networks"
          title="Charging that fits your fleet."
          accent="One platform to run your network."
          body="WayTara designs and installs EV charging infrastructure, then connects compatible chargers to its own charge-point management and energy-management platforms. Plan your electrical capacity, manage charging operations and bring energy and charging together."
          primary={{ label: "Plan a new charging site", href: PLAN_HREF }}
          secondary={{ label: "Manage existing chargers", href: CPMS_HREF }}
          secondaryHint="CPMS · OCPP · Charging operations"
          image="/images/segments/ev-fleet.jpg"
        />
      }
    >
      <SegmentSection
        id="entry"
        badge="What you operate"
        title="What are you looking"
        accent="to operate?"
        summary="A fleet depot and a public charging network need different things. Start with the one that looks like yours."
      >
        <FeatureColumns items={ENTRY} />
        <Reveal direction="up" duration={700} distance={16}>
          <div className="mt-12 flex justify-center">
            <Link href={CPMS_HREF} className="group inline-flex items-center gap-1.5 text-sm font-semibold text-theme-highlight underline-offset-4 hover:underline">
              Explore WayTara CPMS for chargers you already have
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          </div>
        </Reveal>
      </SegmentSection>

      <SegmentSection
        id="setups"
        badge="Charging setups"
        title="The right setup depends on"
        accent="your operating schedule."
        summary="Pick chargers by how long vehicles stay parked and how soon they must be back on the road."
      >
        <FeatureColumns items={SETUPS} />
      </SegmentSection>

      <ProjectSteps
        id="design"
        badge="Site design"
        title="Design the depot around"
        accent="five things."
        summary="Start with the charging operation, not the charger catalogue. The number charging at once and the charging window often matter more than fleet size."
        steps={DESIGN_FACTORS}
      />

      <SegmentSection
        id="managed"
        badge="Managed charging"
        title="More chargers without every one"
        accent="drawing maximum power."
        summary="Eight charging points don't all need to run at full rated power at the same moment. Sharing the site's available capacity between active sessions can cut the peak."
      >
        <Reveal direction="up" duration={800} distance={24}>
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12">
            <AllocationSketch />
            <div>
              <p className="text-lg font-semibold tracking-tight text-theme-primary">What managed charging can help with</p>
              <ul className="mt-5 space-y-3">
                {[
                  "Spread available power across several active sessions",
                  "Prioritise vehicles due to leave sooner",
                  "Set charging limits for individual chargers or the whole site",
                  "Reduce unnecessary simultaneous peak demand",
                  "Potentially avoid or defer an electrical connection upgrade",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-[15px] text-theme-secondary">
                    <CircleCheck className="mt-0.5 size-[1.1rem] shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-sm leading-relaxed text-theme-muted">
                This is not a guarantee that an upgrade can always be avoided. A load study has to show whether your supply can deliver the energy you need within the operating window.
                What is possible also depends on the metering at the site and on each charger&apos;s supported OCPP features and firmware.
                {CPMS_FEATURES.loadAllocation && " WayTara CPMS applies the configured limits and priorities to compatible chargers."}
              </p>
            </div>
          </div>
        </Reveal>
      </SegmentSection>

      <SegmentSection
        id="solar"
        badge="Solar and storage"
        title="Make charging work with"
        accent="your energy supply."
        summary="Solar, batteries and charging can be planned together. The charging schedule decides how much they help."
      >
        <FeatureColumns items={SOLAR} />
        <Reveal direction="up" duration={700} distance={16}>
          <NoteBlock title="Charging overnight?">
            <p>Solar makes power in the day, so for an overnight fleet it mostly covers your daytime use. A battery can move some of it to the night. Check the cost first.</p>
          </NoteBlock>
        </Reveal>
      </SegmentSection>

      <SegmentSection
        id="cpms"
        badge="WayTara CPMS"
        title="Your charging network."
        accent="Under your control."
        summary="Manage compatible OCPP chargers and their charging sessions from one platform."
      >
        <FeatureColumns items={CPMS_TILES} />
        <Reveal direction="up" duration={700} distance={16}>
          <div className="mt-12 flex justify-center">
            <Link href={CPMS_HREF} className="group inline-flex items-center gap-1.5 text-sm font-semibold text-theme-highlight underline-offset-4 hover:underline">
              Explore WayTara CPMS
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          </div>
        </Reveal>
        <Reveal direction="up" duration={800} distance={24}>
          <PlatformDiagram
            inputs={["EV chargers", "Solar inverters and storage"]}
            note="Already operating a charging site? You may not need a new charger or a new solar installation to explore WayTara CPMS. What can be read or controlled depends on the make, model and enabled features of each device."
          />
        </Reveal>
      </SegmentSection>

      <SegmentSection
        id="models"
        badge="Business models"
        title="Choose your charging"
        accent="business model."
        summary="Not every charging site has to be a public business."
      >
        <FeatureColumns items={MODELS} />
        <InfoBand
          bare
          title="More use beats more chargers."
          body="A charging fee includes the electricity tariff, a service charge, land cost and GST. Work out your income after all of these."
          items={REVENUE_DRIVERS}
        />
      </SegmentSection>

      <SegmentSection
        id="framework"
        badge="India's charging framework"
        title="The rules, in"
        accent="plain terms."
        summary="Enough to plan with confidence, not a regulation handbook. Always check the current guidelines before you commit."
      >
        <PolicyRows items={FRAMEWORK} />
        <Reveal direction="up" duration={700} distance={16}>
          <p className="mt-6 text-xs leading-relaxed text-theme-muted">
            Source: Ministry of Power, Guidelines for Installation and Operation of EV Charging Infrastructure 2024, effective 17 September 2024.{" "}
            <a href="https://powermin.gov.in" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-theme-highlight underline-offset-4 hover:underline">
              Ministry of Power
              <ArrowUpRight className="size-3" aria-hidden="true" />
            </a>
          </p>
        </Reveal>
      </SegmentSection>

      <ProjectSteps
        id="process"
        badge="How a charging project works"
        title="From charging requirements to"
        accent="an operating network."
        summary="Already have chargers? Start with the software."
        steps={STEPS}
      />

      <div className="fluid-container flex justify-center pb-[clamp(2.5rem,5vw,5rem)]">
        <Link href={CPMS_HREF} className="group inline-flex items-center gap-1.5 text-sm font-semibold text-theme-highlight underline-offset-4 hover:underline">
          Already have chargers? Connect them to WayTara CPMS
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </Link>
      </div>

      <InfoBand
        title="For a new depot or site, start with:"
        body="If the load information isn't available, an engineering assessment can establish it. We don't guess charger capacities or connection requirements from fleet size alone."
        items={PREPARE}
      />

      <SegmentSection id="faq" badge="FAQ" title="Questions from fleet operators" accent="and charging-site owners.">
        <Reveal direction="up" duration={700} distance={16}>
          <FaqList faqs={EV_FLEET_FAQS} />
        </Reveal>
      </SegmentSection>

      <EnquiryRoutes
        heading="Build your charging"
        accent="operation with WayTara."
        newRoute={{ label: "Plan a new charging site", href: PLAN_HREF, hint: "EPC · Electrical infrastructure · CPMS" }}
        existingRoute={{ label: "Manage my existing charging network", href: CPMS_HREF, hint: "OCPP · CPMS · Charger management" }}
      />
    </SegmentShell>
  );
}
