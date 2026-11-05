import { BatteryCharging, Building, Building2, Cpu, GraduationCap, LayoutDashboard, Leaf, PlugZap, Sun, Users, Server, Truck, UserRound, Gauge, Activity } from "lucide-react";
import { ProjectSteps } from "@/components/sections/project-steps";
import { Reveal } from "@/components/shared/reveal";
import { CPMS_FEATURES } from "./capabilities";
import { FaqList, type Faq } from "./faq-list";
import { EnquiryRoutes, FeatureColumns, InfoBand, PlatformDiagram, PolicyRows, SegmentHero, SegmentSection } from "./segment-parts";
import { SegmentShell } from "./segment-shell";

export const IT_PARK_PATH = "/solutions/it-park";
export const IT_PARK_DESCRIPTION =
  "Plan, monitor and manage solar, battery storage and EV charging across an IT park, data centre or institutional campus, with one connected view of energy.";

const EPC_HREF = "/planner?start=build&for=it-park";
const EMS_HREF = "/technology#compatibility";

const M = CPMS_FEATURES.monetisation;

const MENU = [
  { id: "campuses", label: "Campus types" },
  { id: "provide", label: "What we provide" },
  { id: "connected", label: "One connected view" },
  { id: "charging", label: "Campus charging" },
  { id: "reporting", label: "Energy reporting" },
  { id: "stage", label: "New or existing" },
  { id: "codes", label: "Codes & procurement" },
  { id: "process", label: "How it works" },
  { id: "faq", label: "FAQ" },
  { id: "enquire", label: "Enquire" },
];

const CAMPUSES = [
  { icon: Building2, title: "IT and business parks", body: "Multiple buildings, common utilities, tenant areas, parking and employee charging." },
  { icon: Server, title: "Data centres", body: "Continuous power demand, backup infrastructure, cooling systems and renewable energy planning." },
  { icon: GraduationCap, title: "Universities and institutions", body: "Academic blocks, hostels, laboratories, administration buildings and campus mobility." },
  { icon: Building, title: "Corporate campuses", body: "Office buildings, employee facilities, common areas, fleet charging and sustainability goals." },
];

const PROVIDE = [
  {
    icon: Sun,
    title: "Solar and renewable energy",
    body: "Rooftop solar, solar carports and renewable power integration to reduce dependence on conventional grid electricity.",
  },
  {
    icon: BatteryCharging,
    title: "Battery storage and backup",
    body: "Assess storage for selected loads, peak demand management and better use of renewable generation, integrated with existing power infrastructure where technically suitable.",
  },
  {
    icon: PlugZap,
    title: "Campus EV charging",
    body: "Charging for employees, visitors, tenants and fleet vehicles, with centralised charger management and charging records.",
  },
  {
    icon: LayoutDashboard,
    title: "Energy monitoring and management",
    body: "Connect compatible inverters, batteries, meters and chargers to monitor energy flows and manage supported equipment from one platform.",
  },
];

const CHARGING = [
  {
    icon: UserRound,
    title: "Employee charging",
    body: M ? "Access management, usage records and charging allocation." : "Usage records and charging sessions for employee charging.",
  },
  {
    icon: Users,
    title: "Visitor charging",
    body: M ? "Controlled access and paid charging where offered." : "Charging for visitors, with a session record for every charger.",
  },
  {
    icon: Building2,
    title: "Tenant charging",
    body: M ? "Track charging energy and sessions for different users and tenants." : "Track charging energy and sessions across the campus's chargers.",
  },
  {
    icon: Truck,
    title: "Fleet charging",
    body: M ? "Manage charging schedules and energy consumption for campus vehicles." : "See charging energy and sessions for campus vehicles, and start or stop supported chargers remotely.",
  },
];

const REPORTING = [
  { icon: Gauge, title: "Energy consumption", body: "Track electricity usage, grid imports and consumption trends." },
  { icon: Sun, title: "Renewable energy", body: "Monitor solar generation, self-consumption and exported energy." },
  { icon: BatteryCharging, title: "Energy storage", body: "Review battery charging, discharging and utilisation." },
  { icon: Leaf, title: "Carbon estimates", body: "Calculate estimated emissions and renewable-energy impact from the energy data available." },
];

const DASHBOARD_METRICS = [
  "Energy by building or circuit, where metered",
  "Peak demand, where measurement intervals permit",
  "Solar generation and self-consumption",
  "Battery charge, discharge and utilisation",
  "DG energy and runtime, where metered",
  "EV charger energy, sessions and utilisation",
  "Energy intensity, where floor-area data is provided",
  "Equipment-level history and trends",
];

const STAGES = [
  {
    icon: Cpu,
    tag: "New development",
    title: "Plan before construction is complete",
    body: "The right time to design energy and connectivity is alongside the project.",
    includes: ["Assess site energy demand", "Plan solar and battery infrastructure", "Include EV charging and electrical provisions", "Design the monitoring and connectivity architecture with the project"],
  },
  {
    icon: Activity,
    tag: "Existing campus",
    title: "Start with your current infrastructure",
    body: "You don't need to start over to get a connected view.",
    includes: ["Assess electricity consumption", "Connect compatible existing equipment", "Identify opportunities for solar and storage", "Bring existing chargers into CPMS where supported"],
  },
];

const CODES = [
  {
    tag: "Energy codes",
    title: "Check the code that applies to your project",
    body: "For new commercial buildings, energy-efficiency requirements need to be checked against the applicable state and local building regulations. Tamil Nadu has notified ECBC for implementation, and the newer national ECSBC 2024 should be checked for its applicable state adoption and project requirements.",
  },
  {
    tag: "Renewable procurement",
    title: "Green energy open access",
    body: "For larger campuses, buying renewable electricity through green energy open access may be worth evaluating. Eligibility, charges, banking and approvals depend on the applicable regulations and on the consumer's connection and contract arrangements.",
  },
];

const STEPS = [
  { title: "Assess", body: "Understand the campus, its electricity use, connected infrastructure and future requirements." },
  { title: "Design", body: "Develop the EPC and connectivity plan around site priorities and electrical constraints." },
  { title: "Install and integrate", body: "Supply, install, commission and connect the agreed infrastructure." },
  { title: "Monitor and manage", body: "Use EMS and CPMS to monitor energy and charging operations and manage supported assets." },
];

export const IT_PARK_FAQS: Faq[] = [
  {
    question: "Can WayTara monitor a data centre's energy?",
    answer:
      "We can support energy monitoring and renewable-energy integration around the facility. Operational continuity comes first, so equipment connections and control boundaries are assessed for each site, and we report only what the connected equipment measures.",
  },
  {
    question: "Do you report PUE or other data-centre efficiency metrics?",
    answer:
      "Not as standard. Metrics such as PUE need total facility energy and IT-equipment energy measurements, so we calculate them only where the required measurement boundaries exist.",
  },
  {
    question: "Can WayTara produce sustainability or ESG reports?",
    answer:
      "WayTara provides energy data for sustainability reporting: consumption, solar generation, battery activity and estimated emissions calculated from the data available. It is not complete ESG or carbon-accounting software, and regulatory submissions may need additional records and independent verification.",
  },
  {
    question: "Can we connect equipment we already have across several buildings?",
    answer: "Compatible inverters, batteries, meters and chargers can be connected to one platform. We assess compatibility building by building.",
  },
  {
    question: "Can we add EV charging for employees, visitors, tenants and fleet vehicles?",
    answer:
      "Yes. We install charging for each group and manage compatible OCPP chargers centrally, with session records. How charging power is shared depends on charger capabilities and the site's management policy.",
  },
  {
    question: "Is a new campus different from an existing one?",
    answer:
      "Yes. On a new campus we plan energy infrastructure and monitoring with the project, before construction is complete. On an existing campus we start from the current infrastructure, connect compatible equipment and look for solar and storage opportunities.",
  },
];

/** IT Parks & Campuses: multi-building energy and charging, with reporting limited to what connected equipment can measure. */
export function ItParkPage() {
  return (
    <SegmentShell
      name="IT Parks & Campuses"
      path={IT_PARK_PATH}
      description={IT_PARK_DESCRIPTION}
      faqs={IT_PARK_FAQS}
      menu={MENU}
      hero={
        <SegmentHero
          eyebrow="IT parks · Data centres · Campuses"
          title="One campus."
          accent="A connected view of energy."
          body="Plan, monitor and manage solar, battery storage and EV charging across your IT park, data centre or institutional campus."
          primary={{ label: "Request an EPC assessment", href: EPC_HREF }}
          secondary={{ label: "Request an EMS / CPMS assessment", href: EMS_HREF }}
          secondaryHint="Existing infrastructure"
          image="/images/segments/it-park.jpg"
        />
      }
    >
      <SegmentSection
        id="campuses"
        badge="Campus types"
        title="Energy management for"
        accent="complex campuses."
        summary="One site can hold several buildings, tenants, utility systems, backup sources and charging locations. Each has a different energy requirement."
      >
        <FeatureColumns items={CAMPUSES} />
      </SegmentSection>

      <SegmentSection
        id="provide"
        badge="What we provide"
        title="Build and manage your campus"
        accent="energy infrastructure."
        summary="Bring new equipment and what you already have into one plan."
      >
        <FeatureColumns items={PROVIDE} />
      </SegmentSection>

      <SegmentSection
        id="connected"
        badge="One connected view"
        title="See your campus as one"
        accent="connected energy system."
        summary="Instead of treating solar, backup power and EV charging as separate installations, WayTara brings compatible equipment into one operating view, with no separate dashboard for each system."
      >
        <Reveal direction="up" duration={800} distance={24}>
          <PlatformDiagram
            inputs={["Solar and inverters", "Battery storage", "Energy meters", "EV chargers"]}
            note="Monitor energy performance, identify consumption patterns and manage supported assets. What can be read or controlled depends on the make, model and enabled features of each device."
          />
        </Reveal>
      </SegmentSection>

      <SegmentSection
        id="charging"
        badge="Campus charging"
        title="Manage charging"
        accent="across your campus."
        summary="EV charging is more than installing charging points in a car park. A campus needs to manage who charges, when, and how electricity is shared."
      >
        <FeatureColumns items={CHARGING} />
        <Reveal direction="up" duration={700} distance={16}>
          <p className="mt-6 max-w-3xl text-sm leading-relaxed text-theme-secondary">
            WayTara CPMS supports centralised charger management and session records for compatible OCPP chargers. Charging allocation and power control depend on charger
            capabilities and the configured site management policy.
          </p>
        </Reveal>
      </SegmentSection>

      <SegmentSection
        id="reporting"
        badge="Energy reporting"
        title="Energy visibility and"
        accent="sustainability reporting."
        summary="Monitor energy performance across your connected infrastructure and turn operational data into useful reports."
      >
        <FeatureColumns items={REPORTING} />
        <Reveal direction="up" duration={700} distance={16}>
          <div className="mt-8 rounded-2xl border border-theme-border bg-theme-surface px-7 py-7 sm:px-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-theme-muted">Energy data for sustainability reporting</p>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-theme-secondary">
              Periodic energy and emissions summaries from connected equipment data can support internal sustainability tracking and supply energy figures for wider ESG reporting.
              We keep three kinds of information apart: what is measured automatically, what is a calculated estimate, and what you supply yourself.
            </p>
            <p className="mt-3 max-w-3xl text-xs leading-relaxed text-theme-muted">
              Reporting coverage depends on installed meters, connected equipment, available data and the information you provide. Regulatory submissions may need additional
              records and independent verification. Efficiency metrics such as PUE need total facility and IT-load measurements, so we report only what the connected equipment can
              measure or calculate reliably.
            </p>
          </div>
        </Reveal>
      </SegmentSection>

      <InfoBand
        kicker="Campus dashboard"
        title="What it can bring together."
        body="Where the equipment is metered and connected. We label each report by its real coverage: we won't show total facility use if only the solar inverter and chargers are monitored."
        items={DASHBOARD_METRICS}
      />

      <SegmentSection
        id="stage"
        badge="New or existing"
        title="New campus or"
        accent="existing facility?"
        summary="The starting point is different, and so is the cost of waiting."
      >
        <FeatureColumns items={STAGES} />
      </SegmentSection>

      <SegmentSection
        id="codes"
        badge="Codes and procurement"
        title="Energy codes and"
        accent="renewable procurement."
        summary="Two things to check early, alongside the engineering."
      >
        <PolicyRows items={CODES} />
      </SegmentSection>

      <ProjectSteps
        id="process"
        badge="How a campus project works"
        title="Four steps to"
        accent="one connected campus."
        summary="Existing campus? Start by connecting what you already have."
        steps={STEPS}
        ringAt={2}
      />

      <SegmentSection id="faq" badge="FAQ" title="Questions from" accent="campus teams.">
        <Reveal direction="up" duration={700} distance={16}>
          <FaqList faqs={IT_PARK_FAQS} />
        </Reveal>
      </SegmentSection>

      <EnquiryRoutes
        heading="Make your campus energy"
        accent="work together."
        newRoute={{ label: "Request an EPC assessment", href: EPC_HREF, hint: "New project. Plan solar, battery storage and campus EV charging." }}
        existingRoute={{ label: "Request an EMS / CPMS assessment", href: EMS_HREF, hint: "Existing infrastructure. Connect and manage compatible energy equipment and chargers." }}
      />
    </SegmentShell>
  );
}
