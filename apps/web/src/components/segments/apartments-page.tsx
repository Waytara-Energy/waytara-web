import { BatteryCharging, LayoutDashboard, PlugZap, Sun } from "lucide-react";
import { ProjectSteps } from "@/components/sections/project-steps";
import { Reveal } from "@/components/shared/reveal";
import { FaqList, type Faq } from "./faq-list";
import { AudienceBand, EnquiryRoutes, EvidencePanel, FeatureColumns, SegmentHero, SegmentSection, SupportPanel } from "./segment-parts";
import { SegmentShell } from "./segment-shell";

export const APARTMENTS_PATH = "/solutions/apartment";
export const APARTMENTS_DESCRIPTION =
  "Solar, battery backup, EV charging and energy management for apartment communities and developers, designed around shared infrastructure and actual usage.";

const ASSESS_HREF = "/planner?start=build&for=apartment";
const DEVELOPER_HREF = "/planner?start=build&for=developer";

const MENU = [
  { id: "benefits", label: "Benefits" },
  { id: "projects", label: "Project types" },
  { id: "developers", label: "For developers" },
  { id: "research", label: "Research" },
  { id: "support", label: "Government support" },
  { id: "start", label: "How to start" },
  { id: "faq", label: "FAQ" },
  { id: "enquire", label: "Enquire" },
];

const BENEFITS = [
  { icon: Sun, title: "Reduce common electricity bills", body: "Solar for lifts, pumps, lighting, clubhouses and other shared facilities." },
  { icon: BatteryCharging, title: "Keep essential services running", body: "Battery storage and backup planning for selected critical common loads." },
  { icon: PlugZap, title: "Make EV charging easier", body: "Shared charging infrastructure, individual usage visibility and charging management." },
  { icon: LayoutDashboard, title: "Manage energy in one place", body: "Monitor connected solar, storage and EV charging equipment through WayTara EMS." },
];

const PROJECTS = [
  {
    icon: Sun,
    tag: "Common-area solar",
    title: "Society Common Power",
    body: "Reduce electricity purchased for shared facilities using rooftop and available-site solar.",
    includesLabel: "Typical applications",
    includes: ["Water pumps", "Lifts", "Lighting", "Clubhouse", "Sewage treatment plant"],
    note: "Best starting point: societies with recurring common-meter electricity bills and usable roof or canopy space.",
  },
  {
    icon: BatteryCharging,
    tag: "Solar + storage",
    title: "Community Backup & Energy Hub",
    body: "Combine solar, battery storage and existing DG infrastructure where appropriate to improve energy resilience and manage generator dependence.",
    includesLabel: "Typical applications",
    includes: ["Critical loads", "DG integration", "Battery storage", "Energy monitoring"],
    note: "Best starting point: communities looking to improve backup arrangements or reduce generator runtime where technically and economically viable.",
  },
  {
    icon: PlugZap,
    tag: "EV infrastructure",
    title: "Community EV Charging",
    body: "Install shared charging infrastructure that can grow with resident demand, with individual usage visibility and managed charging.",
    includesLabel: "Typical applications",
    includes: ["Resident charging", "RFID or app access", "OCPP-based charging software", "Load management"],
    note: "Best starting point: communities with existing EV owners or plans for future charging infrastructure.",
  },
];

const DEVELOPER_ITEMS = [
  { title: "Solar-ready rooftops", body: "Plan usable roof zones and electrical connections." },
  { title: "EV-ready parking", body: "Plan cable routes, distribution and future charger capacity." },
  { title: "Backup infrastructure", body: "Assess critical loads, DG and storage integration." },
  { title: "Connected operations", body: "Prepare for energy monitoring and management." },
];

const START_STEPS = [
  { title: "Quick feasibility screening", body: "We review the location, approximate number of homes, common-area bill and your stated priorities." },
  { title: "Only the relevant documents", body: "For an existing society, we start with the latest common-area electricity bill and available roof or site information." },
  { title: "A committee-ready proposal", body: "The recommended scope, estimated generation, expected bill impact, subsidy eligibility and assumptions, in a form you can circulate." },
  { title: "Site assessment", body: "We verify roof access, structure, metering, electrical capacity, existing DG and critical loads." },
  { title: "Approval and execution", body: "After committee or general-body approval, we proceed with the agreed approvals and installation." },
];

const ASSESSMENT_PACK = [
  "Existing electricity expenditure",
  "Available solar opportunity",
  "Common-load and backup requirements",
  "EV charging provision",
  "Estimated economics, with assumptions",
  "Applicable government assistance",
  "Proposed scope and maintenance responsibilities",
];

export const APARTMENTS_FAQS: Faq[] = [
  {
    question: "Can solar power our lifts, pumps and common areas?",
    answer:
      "Yes. Solar can supply shared facilities such as lifts, water pumps, lighting, the clubhouse and sewage treatment. These loads behave very differently, so we look at what each one consumes before recommending a system size.",
  },
  {
    question: "Can we install solar without battery storage?",
    answer:
      "Yes. Grid-connected solar needs no battery. It reduces the electricity you buy for shared facilities, but like any standard grid-connected system it switches off when grid supply fails. Battery storage is added where selected loads need to keep running.",
  },
  {
    question: "Can batteries replace our diesel generator?",
    answer:
      "Not automatically. Batteries can cover selected critical loads and reduce generator runtime where it is technically and economically viable. We assess your loads and existing DG before suggesting anything, and we don't promise to remove diesel.",
  },
  {
    question: "Can residents use the same EV charging infrastructure?",
    answer:
      "Yes. Shared charging can be set up with access control, individual usage visibility and managed charging, so the load on the building stays controlled. The right setup depends on your parking layout and electrical capacity.",
  },
  {
    question: "Can we add solar or EV charging later?",
    answer:
      "Yes, though planning ahead makes it easier. Leaving roof zones, cable routes and electrical capacity ready costs less than changing a finished building, which is why we like to speak to developers early.",
  },
  {
    question: "What if we already have solar or a DG system?",
    answer:
      "We can design around it. WayTara EMS can connect compatible existing inverters and chargers to one dashboard, and new equipment can be planned to work with what you already have.",
  },
  {
    question: "How do we get government assistance?",
    answer:
      "Eligible RWAs and group housing societies may qualify for central assistance under PM Surya Ghar for rooftop solar that serves common facilities. We check eligibility, registration, approved equipment, metering and DISCOM requirements before quoting any benefit.",
  },
];

/** Apartments, RWAs & Developers: the second page on the segment template, with a separate proposition for builders and developers. */
export function ApartmentsPage() {
  return (
    <SegmentShell
      name="Apartments, RWAs & Developers"
      path={APARTMENTS_PATH}
      description={APARTMENTS_DESCRIPTION}
      faqs={APARTMENTS_FAQS}
      menu={MENU}
      hero={
        <SegmentHero
          eyebrow="Apartments · RWAs · Developers"
          title="Lower common-area energy costs."
          accent="Build communities ready for what's next."
          body="Solar, battery backup, EV charging and energy management for apartment communities, designed around shared infrastructure and actual usage."
          primary={{ label: "Get a community energy assessment", href: ASSESS_HREF }}
          secondary={{ label: "Planning a new development?", href: DEVELOPER_HREF }}
          secondaryHint="For builders and developers"
          image="/images/segments/apartment.jpg"
        />
      }
    >
      <SegmentSection
        id="benefits"
        badge="Why it matters"
        title="What can we improve"
        accent="in your community?"
        summary="For associations, committees and property managers. Four things we can help with, with no equipment specifications to wade through."
      >
        <FeatureColumns items={BENEFITS} />
      </SegmentSection>

      <SegmentSection
        id="projects"
        badge="Project types"
        title="Three ways to upgrade"
        accent="your community."
        summary="Each stands on its own. All three can be combined into one community energy project."
      >
        <FeatureColumns items={PROJECTS} />
      </SegmentSection>

      <AudienceBand
        id="developers"
        badge="For builders and developers"
        title="Make your next development"
        accent="energy-ready from day one."
        summary="Plan solar, EV charging, electrical infrastructure and energy management into your residential project before the building is handed over."
        items={DEVELOPER_ITEMS}
        closing={{
          title: "One engineering partner across the energy scope.",
          body: "From design and electrical integration to installation, commissioning and connected energy management. The best time to talk is before the electrical design is frozen.",
        }}
        cta={{ label: "Discuss an upcoming development", href: DEVELOPER_HREF }}
      />

      <SegmentSection
        id="research"
        badge="Research"
        title="Why communities are"
        accent="worth assessing."
        summary="Don't only ask how much electricity your society uses. Ask what uses it. Pumps, lifts, sewage treatment, lighting and EV charging behave very differently."
      >
        <Reveal direction="up" duration={800} distance={24}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <EvidencePanel
              source="WRI India + TIDE · study of 10 Bengaluru apartment complexes"
              figure="8 of 10"
              text="Studied communities had enough assessed rooftop potential to potentially meet their annual common-service electricity demand through rooftop solar."
              caveat="Research findings, not guaranteed results for every apartment. Roof space, consumption, occupancy and equipment condition matter."
            />
            <EvidencePanel
              source="WRI India + TIDE · same study"
              figure="45%"
              text="Of the aggregate common-area connected load in the study was accounted for by water pumping assets."
              caveat="This is why we assess common facilities before recommending a system size."
            />
          </div>
        </Reveal>
      </SegmentSection>

      <SegmentSection
        id="support"
        badge="Government support"
        title="Support for"
        accent="apartment communities."
        summary="Different from the individual homeowner scheme: this one is for common facilities."
      >
        <SupportPanel
          kicker="PM Surya Ghar · common facilities"
          headline="₹18,000/kW"
          figures={[
            { value: "Up to 500 kW", label: "Scheme capacity ceiling" },
            { value: "3 kW per house", label: "Capacity-based limit" },
          ]}
          intro="Central financial assistance for eligible group housing societies and RWAs installing rooftop solar for common facilities, including EV charging."
          conditions={[
            "The 500 kW ceiling includes any individual residential rooftop installations already counted within the society.",
            "The subsidised RWA connection must serve common facilities, not supply individual flats.",
            "Eligibility, registration, approved equipment, metering and DISCOM requirements are checked before any benefit is quoted.",
            "This is solar assistance. It is not a blanket subsidy for batteries or EV chargers.",
            "Individual-home subsidy figures do not apply to societies. Any additional state assistance is checked separately.",
          ]}
          link={{ label: "Check subsidy eligibility for our community", href: ASSESS_HREF }}
        />
      </SegmentSection>

      <ProjectSteps
        id="start"
        badge="How to start"
        title="Easy for a committee"
        accent="to begin."
        summary="You don't need electrical drawings, load schedules or datasheets before you contact us."
        steps={START_STEPS}
      />

      <section className="scroll-mt-28 pb-[clamp(2.5rem,5vw,5rem)]">
        <div className="fluid-container">
          <Reveal direction="up" duration={800} distance={24}>
            <div className="grid grid-cols-1 gap-8 rounded-2xl border border-theme-border bg-theme-surface px-7 py-9 sm:px-10 lg:grid-cols-5 lg:items-center lg:gap-12">
              <div className="lg:col-span-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-theme-muted">Community Energy Assessment</p>
                <p className="mt-3 text-xl font-semibold text-theme-primary">Something you can take to your committee meeting.</p>
                <p className="mt-2 text-sm leading-relaxed text-theme-secondary">Not just a quotation: a pack that covers the whole picture.</p>
              </div>
              <ul className="grid grid-cols-1 gap-x-8 gap-y-2.5 sm:grid-cols-2 lg:col-span-3">
                {ASSESSMENT_PACK.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-theme-secondary">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </section>

      <SegmentSection id="faq" badge="FAQ" title="Common questions from" accent="apartment communities.">
        <Reveal direction="up" duration={700} distance={16}>
          <FaqList faqs={APARTMENTS_FAQS} />
        </Reveal>
      </SegmentSection>

      <EnquiryRoutes
        heading="Let's make your community"
        accent="energy-ready."
        newRoute={{
          label: "Get a community energy assessment",
          href: ASSESS_HREF,
          hint: "Existing apartments, RWAs and associations. Whether you manage a building or are planning an upgrade, we help assess the right energy infrastructure.",
        }}
        existingRoute={{
          label: "Discuss your upcoming development",
          href: DEVELOPER_HREF,
          hint: "Builders, developers and project consultants planning a new residential development.",
        }}
      />
    </SegmentShell>
  );
}
