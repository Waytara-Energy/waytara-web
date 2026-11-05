import Link from "next/link";
import { ArrowRight, BatteryCharging, LayoutDashboard, PlugZap, Sun } from "lucide-react";
import { ProjectSteps } from "@/components/sections/project-steps";
import { Reveal } from "@/components/shared/reveal";
import { OFFERS } from "@/data/offers";
import { FaqList, type Faq } from "./faq-list";
import { HomeSupport } from "./home-support";
import { EnquiryRoutes, EvidencePanel, FeatureColumns, SegmentHero, SegmentSection } from "./segment-parts";
import { SegmentShell } from "./segment-shell";

export const HOMES_PATH = "/solutions/home";
export const HOMES_DESCRIPTION =
  "Rooftop solar, battery backup and EV charging designed around your home, with one dashboard to see how it all works together.";

const PLAN_HREF = "/planner?start=build&for=home";
const EXISTING_HREF = "/technology#compatibility";

const MENU = [
  { id: "benefits", label: "Benefits" },
  { id: "provide", label: "What we provide" },
  { id: "setup", label: "Choosing a setup" },
  { id: "support", label: "Government support" },
  { id: "research", label: "Research" },
  { id: "process", label: "How it works" },
  { id: "faq", label: "FAQ" },
  { id: "enquire", label: "Enquire" },
];

const BENEFITS = [
  {
    icon: Sun,
    title: "Use more of your own solar power",
    body: "Generate electricity during the day and use it to run your home's appliances. Surplus power can be exported to the grid under the applicable DISCOM settlement arrangement.",
  },
  {
    icon: BatteryCharging,
    title: "Keep essential loads running",
    body: "Add battery storage to keep selected lights, fans, appliances and other important loads running during a power cut. Backup depends on what you want to run and for how long.",
  },
  {
    icon: PlugZap,
    title: "Charge your EV at home",
    body: "Install a dedicated EV charger and plan charging alongside your home's electricity demand and solar generation. Charging controls depend on compatible equipment and integration.",
  },
  {
    icon: LayoutDashboard,
    title: "See your energy in one place",
    body: "Bring supported solar inverter and EV charger data into the WayTara dashboard. Monitor your connected equipment and use available charging and energy-management controls from one interface.",
  },
];

const SETUPS = [
  {
    icon: Sun,
    tag: "Lower upfront cost",
    title: "Grid-connected solar",
    body: "Reduce grid electricity use with rooftop solar. No battery required. Best when your main goal is reducing electricity bills and grid supply is reliable.",
  },
  {
    icon: BatteryCharging,
    tag: "Backup included",
    title: "Solar + battery backup",
    body: "Generate, store and use solar power, while keeping your grid connection. Best when you want selected appliances to keep running during power cuts.",
  },
];

export const HOMES_FAQS: Faq[] = [
  {
    question: "Will solar keep my home running during a power cut?",
    answer:
      "Not on its own. Standard grid-connected solar inverters switch off when grid supply fails, which is a safety requirement that protects utility workers. A suitably designed solar and battery system can keep selected loads running instead.",
  },
  {
    question: "How much battery backup do I need?",
    answer: "It depends on which appliances you want to run and for how long, not on your monthly bill. We work this out when we assess your home.",
  },
  {
    question: "What happens to the solar power I don't use?",
    answer:
      "Surplus power can be credited against your grid electricity, depending on the metering arrangement available for your connection. We assess the applicable DISCOM rules before recommending a system.",
  },
  {
    question: "Is the government subsidy taken off my quotation?",
    answer:
      "No. Under PM Surya Ghar the assistance is paid by direct benefit transfer after the required process, so it is not an automatic upfront discount. Eligibility, equipment and vendor requirements apply.",
  },
  {
    question: "Can my EV charger be part of the system?",
    answer:
      "Yes. Your charging requirements can be included in either design. Charging schedules, available solar generation and electrical capacity decide how it fits in, and charging controls depend on compatible equipment.",
  },
  {
    question: "I already have solar or an EV charger. Can I still use WayTara?",
    answer:
      "Possibly. WayTara EMS connects compatible inverters and EV chargers to one dashboard, so you may not need to replace anything. Tell us the make and model and we will check.",
  },
];

/** Homes & Villas: the reference page for the segment template (docs/WEBSITE_PLAN.md section 7). */
export function HomesPage() {
  return (
    <SegmentShell
      name="Homes & Villas"
      path={HOMES_PATH}
      description={HOMES_DESCRIPTION}
      faqs={HOMES_FAQS}
      menu={MENU}
      hero={
        <SegmentHero
          eyebrow="Homes & Villas"
          title="Solar, battery backup and EV charging,"
          accent="designed around your home."
          body="WayTara designs and installs rooftop solar, battery storage and EV chargers around your home's energy needs. Bring supported inverter and EV charger equipment together through one dashboard, so you can see your energy system in one place."
          primary={{ label: "Plan a home energy system", href: PLAN_HREF }}
          secondary={{ label: "Connect my existing system", href: EXISTING_HREF }}
          secondaryHint="Existing equipment · EMS"
          image="/images/segments/home.jpg"
        />
      }
    >
      <SegmentSection
        id="benefits"
        badge="Why it matters"
        title="More from the energy"
        accent="your home uses."
        summary="Generate power from your roof, store energy for when you need it, charge your EV and see how everything works together."
      >
        <FeatureColumns items={BENEFITS} />
        <Reveal direction="up" duration={700} distance={16}>
          <p className="mt-8 max-w-2xl text-sm leading-relaxed text-theme-secondary">
            <span className="font-semibold text-theme-primary">Already have solar or an EV charger? </span>
            You may not need to replace your existing equipment to gain better visibility. Ask us about connecting compatible systems to WayTara EMS.{" "}
            <Link href={EXISTING_HREF} className="font-semibold text-theme-highlight underline-offset-4 hover:underline">
              Connect my existing system
            </Link>
          </p>
        </Reveal>
      </SegmentSection>

      <SegmentSection
        id="provide"
        badge="What we provide"
        title="One home,"
        accent="three ways in."
        summary="Choose any one on its own, or combine all three."
      >
        <FeatureColumns items={OFFERS.map(({ icon, tag, title, body, includes }) => ({ icon, tag, title, body, includes }))} />
      </SegmentSection>

      <SegmentSection
        id="setup"
        badge="Choosing a setup"
        title="What does your"
        accent="home need?"
        summary="The right setup depends on your electricity use, backup needs and available space. Here are the main approaches."
      >
        <FeatureColumns items={SETUPS} />
        <Reveal direction="up" duration={700} distance={16}>
          <div className="mt-8 grid grid-cols-1 gap-x-10 gap-y-6 text-sm leading-relaxed text-theme-secondary md:grid-cols-3">
            <p>
              <span className="block font-semibold text-theme-primary">Good to know</span>
              Solar alone doesn&apos;t provide backup during a power cut. Standard grid-connected inverters disconnect when grid supply fails.
            </p>
            <p>
              <span className="block font-semibold text-theme-primary">What about off-grid?</span>
              For properties without a usable grid connection, we can assess standalone solar and battery systems designed around the site&apos;s energy needs.
            </p>
            <p>
              <span className="block font-semibold text-theme-primary">Planning for an EV?</span>
              Your charging requirements can be included in either design. Charging schedules, available solar generation and electrical capacity decide how it fits in.
            </p>
          </div>
          <Link href="/planner?for=home" className="group mt-8 inline-flex items-center gap-1.5 text-sm font-semibold text-theme-highlight underline-offset-4 hover:underline">
            Not sure what fits? Try the energy planner
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
        </Reveal>
      </SegmentSection>

      <SegmentSection
        id="support"
        badge="Government support"
        title="Support for"
        accent="your home."
        summary="Eligible residential solar installations may qualify for central assistance under PM Surya Ghar. Additional state incentives may apply depending on where you live."
      >
        <Reveal direction="up" duration={800} distance={24}>
          <HomeSupport />
        </Reveal>
        <Reveal direction="up" duration={700} distance={16}>
          <div className="mt-10 grid grid-cols-1 gap-x-10 gap-y-6 text-sm leading-relaxed text-theme-secondary md:grid-cols-3">
            <p>
              <span className="block font-semibold text-theme-primary">What about the electricity you don&apos;t use?</span>
              Surplus power can be credited to your electricity account under the applicable metering arrangement. The settlement depends on your state, DISCOM and
              connection.
            </p>
            <p>
              <span className="block font-semibold text-theme-primary">Need help with the process?</span>
              WayTara helps assess your property&apos;s suitability, plan the installation and work through the applicable approval and documentation process.
            </p>
            <p>
              <span className="block font-semibold text-theme-primary">Looking at financing?</span>
              Eligible homeowners can also explore solar loans through participating banks.
            </p>
          </div>
        </Reveal>
      </SegmentSection>

      <SegmentSection
        id="research"
        badge="Research"
        title="What the research"
        accent="says."
        summary="Independent studies, not WayTara promises. Your own results depend on how you use energy."
      >
        <Reveal direction="up" duration={800} distance={24}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <EvidencePanel
              source="Indian household research · CEEW · 2026"
              figure="53–73%"
              text="Reported bill reduction across two household consumption groups among surveyed rooftop-solar adopters, depending on their original bill band."
              caveat="Pan-India survey of 17,094 households. Not a WayTara savings guarantee."
            />
            <EvidencePanel
              source="Residential EV charging · AEEE / Kazam · 2026"
              figure="80–90%"
              text="Of daily EV energy demand was met by home charging in the study's dataset."
              caveat="Based on over 100,000 residential charging data points. Not a WayTara result."
            />
          </div>
        </Reveal>
      </SegmentSection>

      <ProjectSteps id="process" />

      <SegmentSection id="faq" badge="FAQ" title="Common questions," accent="answered.">
        <Reveal direction="up" duration={700} distance={16}>
          <FaqList faqs={HOMES_FAQS} />
        </Reveal>
      </SegmentSection>

      <EnquiryRoutes
        heading="Ready to plan"
        accent="your home's energy?"
        newRoute={{ label: "Plan a home energy system", href: PLAN_HREF, hint: "Solar, battery storage and EV charging, designed and installed around your home." }}
        existingRoute={{ label: "Connect my existing system", href: EXISTING_HREF, hint: "Bring compatible solar inverters and EV chargers into the WayTara dashboard." }}
      />
    </SegmentShell>
  );
}
