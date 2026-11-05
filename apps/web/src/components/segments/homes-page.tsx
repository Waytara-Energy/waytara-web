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
  { icon: Sun, title: "Use your own solar power", body: "Run your home on power from your own roof. Extra power can go to the grid under your DISCOM's arrangement." },
  { icon: BatteryCharging, title: "Lights on in a power cut", body: "Add a battery to keep the lights, fans and other things you choose running when the power goes out." },
  { icon: PlugZap, title: "Charge your EV at home", body: "Install a home charger that works with your solar and your home's power use, so charging fits your day." },
  { icon: LayoutDashboard, title: "See it all in one place", body: "Watch your solar, battery and EV charger on one dashboard, and use the supported controls from there." },
];

const SETUPS = [
  {
    icon: Sun,
    title: "Solar only",
    body: "Lowers your electricity bill. The simplest and lowest-cost way to start, best when your grid supply is reliable.",
    includes: ["No battery needed", "Switches off in a power cut"],
  },
  {
    icon: BatteryCharging,
    title: "Solar + battery",
    body: "Stores solar power for later and keeps chosen appliances running in a power cut, while you stay on the grid.",
    includes: ["Backup for what you choose", "Still connected to the grid"],
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
        summary="Make power, store it, charge your EV and see it all in one place."
      >
        <FeatureColumns items={BENEFITS} />
        <Reveal direction="up" duration={700} distance={16}>
          <p className="mt-10 text-sm leading-relaxed text-theme-secondary">
            <span className="font-semibold text-theme-primary">Already have solar or an EV charger? </span>
            You may not need to replace it. We can check if it connects to WayTara.{" "}
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
        <FeatureColumns items={OFFERS.map(({ icon, title, blockBody, includes }) => ({ icon, title, body: blockBody, includes }))} />
      </SegmentSection>

      <SegmentSection
        id="setup"
        badge="Choosing a setup"
        title="What does your"
        accent="home need?"
        summary="It depends on your electricity use, your backup needs and the space you have."
      >
        <FeatureColumns items={SETUPS} />
        <Reveal direction="up" duration={700} distance={16}>
          <div className="mt-12 grid grid-cols-1 gap-x-10 gap-y-6 text-sm leading-relaxed text-theme-secondary md:grid-cols-3">
            <p>
              <span className="block font-semibold text-theme-primary">Good to know</span>
              Solar on its own stops working when the grid goes down. A battery fixes that.
            </p>
            <p>
              <span className="block font-semibold text-theme-primary">No grid connection?</span>
              We can design a standalone solar and battery system.
            </p>
            <p>
              <span className="block font-semibold text-theme-primary">Have an EV?</span>
              We can include charging in either setup.
            </p>
          </div>
          <div className="mt-10 flex justify-center">
            <Link href="/planner?for=home" className="group inline-flex items-center gap-1.5 text-sm font-semibold text-theme-highlight underline-offset-4 hover:underline">
              Not sure what fits? Try the energy planner
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          </div>
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
