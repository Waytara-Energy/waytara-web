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
  { icon: Building2, title: "IT and business parks", body: "Many buildings, shared utilities, parking and staff charging." },
  { icon: Server, title: "Data centres", body: "Power that never stops, with backup and cooling to match." },
  { icon: GraduationCap, title: "Universities", body: "Classrooms, hostels, labs and campus transport." },
  { icon: Building, title: "Corporate campuses", body: "Offices, shared spaces and fleet charging." },
];

const PROVIDE = [
  { icon: Sun, title: "Solar", body: "Rooftop solar and solar car parks to use less grid power." },
  { icon: BatteryCharging, title: "Battery backup", body: "Store power for key loads and for busy times." },
  { icon: PlugZap, title: "EV charging", body: "Chargers for staff, visitors, tenants and fleets, managed from one place." },
  { icon: LayoutDashboard, title: "One dashboard", body: "Connect compatible inverters, batteries, meters and chargers in one view." },
];

const CHARGING = [
  { icon: UserRound, title: "Staff charging", body: M ? "Control who can charge, with a record of every session." : "A record of every charging session." },
  { icon: Users, title: "Visitor charging", body: M ? "Let guests charge, with paid charging where you offer it." : "Charging for guests, with a record of each session." },
  { icon: Building2, title: "Tenant charging", body: "Track the energy and sessions across the campus chargers." },
  { icon: Truck, title: "Fleet charging", body: "Track fleet charging, and start or stop supported chargers from anywhere." },
];

const REPORTING = [
  { icon: Gauge, title: "Energy use", body: "Track electricity use and grid imports over time." },
  { icon: Sun, title: "Solar", body: "See what your solar makes, uses and exports." },
  { icon: BatteryCharging, title: "Battery", body: "See how the battery charges and discharges." },
  { icon: Leaf, title: "Carbon estimates", body: "See estimated emissions from the energy data we measure." },
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
    title: "New campus",
    body: "Plan your energy and monitoring while the campus is being built.",
    includes: ["Estimate your energy needs", "Plan solar and batteries", "Leave room for EV charging", "Build in monitoring from day one"],
  },
  {
    icon: Activity,
    title: "Existing campus",
    body: "Start with what you have. You don't need to start over.",
    includes: ["Check your current energy use", "Connect compatible equipment", "Find room for solar and storage", "Bring in chargers that support it"],
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
        summary="One site can hold many buildings, tenants and power sources, each with different needs."
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
        summary="A campus needs to know who charges, when, and how much."
      >
        <FeatureColumns items={CHARGING} />
        <Reveal direction="up" duration={700} distance={16}>
          <p className="mt-10 max-w-3xl text-sm leading-relaxed text-theme-secondary">
            WayTara CPMS keeps session records for compatible OCPP chargers. What it can control depends on each charger.
          </p>
        </Reveal>
      </SegmentSection>

      <SegmentSection
        id="reporting"
        badge="Energy reporting"
        title="Energy visibility and"
        accent="sustainability reporting."
        summary="Turn your energy data into reports you can use."
      >
        <FeatureColumns items={REPORTING} />
        <Reveal direction="up" duration={700} distance={16}>
          <div className="mt-12 rounded-2xl border border-theme-border bg-theme-surface px-7 py-7 sm:px-8">
            <p className="text-lg font-semibold text-theme-primary">Data for your sustainability reports.</p>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-theme-secondary">
              Regular summaries can feed your own sustainability reporting. We keep three things apart: what we measure, what we estimate, and what you tell us.
            </p>
            <p className="mt-3 max-w-3xl text-xs leading-relaxed text-theme-muted">
              What we can report depends on your meters and connected equipment. Official filings may need extra records and checks. We only report measures such as PUE
              when the right meters are in place.
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
        summary="You start in a different place, depending on where you are."
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
