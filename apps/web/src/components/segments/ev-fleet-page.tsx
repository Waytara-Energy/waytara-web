import Link from "next/link";
import { Activity, ArrowRight, ArrowUpRight, BatteryCharging, ClipboardList, Handshake, ListChecks, Moon, Network, PlugZap, SlidersHorizontal, Sun, Truck, Zap } from "lucide-react";
import { ProjectSteps } from "@/components/sections/project-steps";
import { Reveal } from "@/components/shared/reveal";
import { FaqList, type Faq } from "./faq-list";
import { CPMS_FEATURES } from "./capabilities";
import { EnquiryRoutes, FeatureColumns, InfoBand, PlatformDiagram, PolicyRows, SegmentHero, SegmentSection, type Feature } from "./segment-parts";
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
  { icon: Truck, title: "Fleet charging depots", body: "Charge company-owned vehicles around their routes, shifts and return-to-depot schedules.", note: "Logistics · Delivery · Buses · Commercial fleets" },
  { icon: Network, title: "Public charging networks", body: "Establish charging locations and operate them as a commercial charging service.", note: "CPOs · Highway sites · Commercial charging hubs" },
  { icon: PlugZap, title: "Existing charging networks", body: "Already have chargers installed? Connect compatible OCPP chargers to WayTara CPMS and manage your charging operations through one platform.", note: "Chargers already in the ground" },
];

const SETUPS = [
  {
    icon: Moon,
    tag: "Longer parking windows",
    title: "Depot AC charging",
    body: "Suitable where vehicles return to base and stay parked overnight or between shifts. More charging points can be coordinated across the available electrical capacity.",
  },
  {
    icon: Zap,
    tag: "Shorter turnaround",
    title: "DC fast charging",
    body: "For vehicles that need a lot of energy within a short turnaround window. It needs more power infrastructure and careful connection planning.",
  },
  {
    icon: SlidersHorizontal,
    tag: "Combined operations",
    title: "Managed mixed charging",
    body: "Combine different charger ratings and charging schedules, sharing the available power according to vehicle priority and departure requirements.",
  },
];

const DESIGN_FACTORS = [
  { title: "Vehicles and energy needs", body: "How many vehicles operate daily, and how much energy does each need between trips?" },
  { title: "Charging points", body: "How many vehicles need to be connected at the same time?" },
  { title: "Charging window", body: "Are vehicles parked overnight, between shifts or only briefly?" },
  { title: "Available electrical capacity", body: "What can the existing connection supply, and what would an upgrade involve?" },
  { title: "Future fleet growth", body: "Can the electrical distribution and charging software handle more vehicles and chargers later?" },
];

const SOLAR = [
  { icon: Sun, title: "Daytime charging", body: "Use available solar generation to support vehicle charging while the fleet is parked during daylight." },
  {
    icon: BatteryCharging,
    title: "Battery-supported charging",
    body: "Store available energy and use it during suitable charging periods, where the extra equipment and energy losses make economic sense.",
  },
];

const CPMS_TILES: Feature[] = [
  { icon: Activity, title: "Charger management", body: "Monitor connected chargers, their availability and operating status." },
  { icon: SlidersHorizontal, title: "Remote management", body: "Read charger information and use supported controls remotely, such as starting or stopping a session." },
  { icon: ClipboardList, title: "Session and energy records", body: "Understand charger utilisation and charging activity." },
  { icon: ListChecks, title: "Know what each charger supports", body: "See which OCPP features a charger offers, including smart-charging limits, before you plan around them." },
  ...(CPMS_FEATURES.monetisation
    ? [{ icon: Handshake, title: "Charging monetisation", body: "Support commercial charging operations: users, access and paid charging." }]
    : []),
];

const MODELS = [
  { icon: Truck, tag: "Captive fleet", title: "Charge your own vehicles", body: "Use charging infrastructure for your fleet's daily operations. The value comes from planned charging, vehicle availability and control over energy expenditure.", note: "Aim: operational efficiency and predictable fleet charging." },
  { icon: Network, tag: "Public CPO", title: "Operate charging as a service", body: "Offer charging to customers and manage station availability and sessions through CPMS.", note: "Aim: build utilisation and a sustainable charging business." },
  { icon: Handshake, tag: "Hosted / revenue-sharing", title: "Turn a suitable site into a charging destination", body: "Partner with a charging operator, host infrastructure at a suitable property and agree how site costs and charging revenue are shared.", note: "Aim: make productive use of parking and location." },
];

const REVENUE_DRIVERS = [
  "Vehicles actually using the site",
  "Energy sold per charger",
  "Electricity and demand-related costs",
  "Service charges and pricing structure",
  "Land, equipment, maintenance and payment costs",
  "Charger availability and operating performance",
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
    <div className="rounded-2xl border border-theme-border bg-theme-surface p-6 sm:p-7">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-theme-muted">Eight charging points, one site connection</p>
      <ul className="mt-5 space-y-2.5" aria-label="An example of charging power shared between eight vehicles">
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
        summary="A fleet depot and a public charging network don't have the same requirements, so start with the one that looks like yours."
      >
        <FeatureColumns items={ENTRY} />
        <Reveal direction="up" duration={700} distance={16}>
          <Link href={CPMS_HREF} className="group mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-theme-highlight underline-offset-4 hover:underline">
            Explore WayTara CPMS for chargers you already have
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
        </Reveal>
      </SegmentSection>

      <SegmentSection
        id="setups"
        badge="Charging setups"
        title="The right setup depends on"
        accent="your operating schedule."
        summary="Choose a charger by how long vehicles stay parked and how quickly they must return to service. It isn't simply AC versus DC: it is whether vehicles get the energy they need before their next trip."
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
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-theme-muted">What managed charging can help with</p>
              <ul className="mt-4 space-y-3">
                {[
                  "Spread available power across several active sessions",
                  "Prioritise vehicles due to leave sooner",
                  "Set charging limits for individual chargers or the whole site",
                  "Reduce unnecessary simultaneous peak demand",
                  "Potentially avoid or defer an electrical connection upgrade",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-theme-secondary">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-sm leading-relaxed text-theme-secondary">
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
        summary="Solar, battery storage and EV charging can be designed together, but the charging schedule decides how much value they create."
      >
        <FeatureColumns items={SOLAR} />
        <Reveal direction="up" duration={700} distance={16}>
          <div className="mt-8 rounded-2xl border border-theme-border bg-theme-surface px-7 py-7 sm:px-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-theme-muted">What about overnight depots?</p>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-theme-secondary">
              Solar generates during the day. If your fleet charges overnight, solar mostly offsets the facility&apos;s daytime consumption instead of supplying the vehicles directly.
              Battery storage can move some solar energy into the night, but its cost, capacity and cycling need to be evaluated.
            </p>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-theme-secondary">
              WayTara can connect compatible inverters and chargers, monitor energy flows and use the supported controls to coordinate equipment. Solar-following and battery-aware
              charging policies are set up to match the site&apos;s metering and control arrangement.
            </p>
          </div>
        </Reveal>
      </SegmentSection>

      <SegmentSection
        id="cpms"
        badge="WayTara CPMS"
        title="Your charging network."
        accent="Under your control."
        summary="Manage compatible OCPP chargers and charging sessions from one platform. For fleet operators, independent charge-point operators, charging-site owners and commercial property operators."
      >
        <FeatureColumns items={CPMS_TILES} />
        <Reveal direction="up" duration={700} distance={16}>
          <Link href={CPMS_HREF} className="group mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-theme-highlight underline-offset-4 hover:underline">
            Explore WayTara CPMS
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
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
        summary="Not every charging installation needs to be a public charging business."
      >
        <FeatureColumns items={MODELS} />
        <Reveal direction="up" duration={700} distance={16}>
          <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-5 lg:gap-12">
            <div className="lg:col-span-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-theme-muted">What decides a charging site&apos;s revenue</p>
              <p className="mt-2 text-lg font-semibold text-theme-primary">Utilisation matters more than the number of chargers.</p>
              <p className="mt-2 text-sm leading-relaxed text-theme-secondary">
                Public charging fees under the national framework comprise the electricity tariff, a service charge, land cost where applicable and GST. Work out the economics after all of these, not from the selling price per unit alone.
              </p>
            </div>
            <ul className="grid grid-cols-1 gap-x-8 gap-y-2.5 self-center sm:grid-cols-2 lg:col-span-3">
              {REVENUE_DRIVERS.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-theme-secondary">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
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

      <InfoBand
        kicker="Existing charger network · CPMS"
        title="Start with the chargers you already own."
        body="Tell us the charger make, model, OCPP version and network setup. WayTara can assess compatibility and what onboarding your existing network needs."
        cta={{ label: "Connect my chargers to WayTara CPMS", href: CPMS_HREF }}
      />

      <InfoBand
        kicker="What to prepare"
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
