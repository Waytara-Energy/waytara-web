import { Router, Server, Zap } from "lucide-react";
import { FittedDemo } from "@/components/sections/dashboard-showcase";
import { Reveal } from "@/components/shared/reveal";
import { FaqList, type Faq } from "@/components/segments/faq-list";
import { FeatureColumns, NoteColumns, SegmentSection } from "@/components/segments/segment-parts";
import { CPMS_PLATFORM_FEATURES, EMS_PLATFORM_FEATURES } from "@/components/segments/feature-sets";
import { CompatibilityForm } from "./compatibility-form";
import { GatewayPicture } from "./gateway-picture";
import { PageHero, PageShell } from "./page-shell";

export const PLATFORM_PATH = "/technology";
export const PLATFORM_DESCRIPTION =
  "How WayTara connects solar inverters, batteries, meters and EV chargers to one platform: energy management for supported equipment and charge-point management for compatible OCPP chargers.";

const PARTS = [
  {
    icon: Router,
    title: "WayTara gateway",
    body: "One small box at your site connects your inverters, batteries and meters and shares a single connection with WayTara, so no device needs a network of its own. Chargers connect directly.",
  },
  {
    icon: Zap,
    title: "Energy management",
    body: "Live readings, history, alerts and reports for connected equipment, plus controls for the settings we have tested on supported equipment.",
  },
  {
    icon: Server,
    title: "Charger management",
    body: "Status, sessions and remote controls for compatible OCPP chargers, in the same platform and the same dashboard as your energy.",
  },
];

const NEXT_STEPS = [
  { title: "We read your make and model", body: "We check it against the equipment WayTara supports." },
  { title: "We tell you what connecting involves", body: "Whether it uses the gateway or the charger's own connection, and what that would take." },
  { title: "You decide", body: "You don't need to replace anything to ask." },
];

export const PLATFORM_FAQS: Faq[] = [
  {
    question: "Do I need to replace my existing inverter or charger?",
    answer:
      "Often not. If your equipment is supported, the gateway or the charger's own OCPP connection brings it onto the platform. We check your make and model first.",
  },
  {
    question: "Which inverters and chargers are supported?",
    answer:
      "Deye hybrid inverters are supported today, and OCPP 1.6J chargers can connect to the charging platform. Other equipment is assessed case by case, so send us the make and model using the form on this page.",
  },
  {
    question: "Can WayTara control my equipment, or only monitor it?",
    answer:
      "Both, within limits. Everything supported can be monitored. Control covers selected, tested settings on supported inverters and the supported commands on compatible chargers. It is not unrestricted battery-management control or grid-scale dispatch.",
  },
  {
    question: "Does it optimise solar, battery and EV charging automatically?",
    answer:
      "Not as a general feature. We don't promise automatic solar-following or battery-aware charging unless a control policy has been set up and tested for your site.",
  },
  {
    question: "Does it need an internet connection at my site?",
    answer:
      "Yes, one. The gateway shares a single internet connection for all the equipment it connects, so each inverter, battery or meter does not need a network of its own. Chargers connect to the platform directly, so they need their own connection.",
  },
];

/** Platform (/technology): the one place for the technical story. Every capability named here is one the product has today. */
export function PlatformPage() {
  return (
    <PageShell
      name="Platform"
      path={PLATFORM_PATH}
      faqs={PLATFORM_FAQS}
      hero={
        <PageHero
          eyebrow="Platform"
          title="Connect the equipment."
          accent="Manage the energy system."
          body="WayTara's platform brings solar inverters, batteries, meters and EV chargers into one place: energy management (EMS) for supported energy equipment, and charge-point management (CPMS) for compatible OCPP chargers. This page is the technical detail behind it."
          primary={{ label: "Check my equipment", href: "#compatibility" }}
          secondary={{ label: "Plan a new system", href: "/planner" }}
        />
      }
    >
      <SegmentSection
        id="overview"
        badge="Three parts"
        title="One platform,"
        accent="three connected parts."
        summary="Not a dashboard added to someone else's hardware: WayTara builds the gateway and the software together."
      >
        <FeatureColumns items={PARTS} />
      </SegmentSection>

      <SegmentSection
        id="how"
        badge="How it connects"
        title="One gateway,"
        accent="many devices."
        summary="The gateway connects the equipment at your site and shares one connection with WayTara, so every device shows up in one dashboard without a network for each."
      >
        {/* The gateway picture, with the equipment drawn on it (one picture for each theme). */}
        <Reveal direction="up" duration={800} distance={24}>
          <GatewayPicture />
        </Reveal>
        <NoteColumns
          items={[
            {
              title: "One connection for many devices",
              body: "Inverters, batteries and meters connect to the WayTara gateway, and the gateway sends everything to the platform over a single internet connection. You do not need a network for each device.",
            },
            { title: "Charging", body: "OCPP 1.6J chargers connect to the platform directly over the internet, without the gateway." },
            {
              title: "Smart energy management",
              body: "One dashboard shows both, with schedules for supported settings, alerts and reports that run on their own, and support from your engineer. What can be read or controlled depends on the make, model and enabled features of each device.",
            },
          ]}
        />
      </SegmentSection>

      <SegmentSection
        id="energy"
        badge="Energy management"
        title="See your energy."
        accent="Manage what is supported."
        summary="For inverters, batteries and meters that have been tested with the gateway."
      >
        <FeatureColumns items={EMS_PLATFORM_FEATURES} columns={3} />
        <NoteColumns
          items={[
            {
              title: "Supported equipment",
              body: "Deye hybrid inverters are supported today. Other makes and models are assessed and added after testing on real equipment, and we confirm yours before you commit.",
            },
            {
              title: "What control means",
              body: "Control means selected, tested settings on a supported inverter. It is not unrestricted battery-management control or grid-scale dispatch.",
            },
          ]}
        />
      </SegmentSection>

      <SegmentSection
        id="charging"
        badge="Charging management"
        title="Run your chargers"
        accent="from one place."
        summary="For OCPP 1.6J chargers. The functions available depend on each charger's supported OCPP features and firmware."
      >
        <FeatureColumns items={CPMS_PLATFORM_FEATURES} columns={3} />
      </SegmentSection>

      <SegmentSection
        id="demo"
        badge="Live demo"
        title="See the dashboard"
        accent="on sample data."
        summary="The customer Monitoring page. The tabs, intervals, charts and device menu respond."
      >
        <Reveal direction="up" duration={800} distance={24}>
          <div className="h-[30rem] overflow-hidden rounded-2xl border border-theme-border bg-theme-surface p-2 sm:h-[38rem] sm:p-3">
            <FittedDemo />
          </div>
        </Reveal>
      </SegmentSection>

      <SegmentSection
        id="compatibility"
        badge="Check compatibility"
        title="Does it work with"
        accent="your equipment?"
        summary="Tell us what you have. We will check compatibility and what connecting it would involve. You don't need to replace anything to ask."
      >
        <div className="grid grid-cols-1 gap-14 lg:grid-cols-5 lg:gap-20">
          <Reveal direction="up" duration={800} distance={24} className="lg:col-span-3">
            <CompatibilityForm />
          </Reveal>
          <Reveal direction="up" duration={800} distance={24} delay={120} className="lg:col-span-2">
            <div className="lg:border-l lg:border-theme-border lg:pl-14">
              <p className="text-lg font-semibold tracking-tight text-theme-primary">What happens next</p>
              <ol className="mt-6 space-y-6">
                {NEXT_STEPS.map((step, i) => (
                  <li key={step.title} className="flex items-start gap-4">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-emerald-500/70 text-xs font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                      {i + 1}
                    </span>
                    <div>
                      <p className="font-semibold text-theme-primary">{step.title}</p>
                      <p className="mt-1 text-[15px] leading-relaxed text-theme-secondary">{step.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </Reveal>
        </div>
      </SegmentSection>

      <SegmentSection id="faq" badge="FAQ" title="Questions about" accent="the platform.">
        <Reveal direction="up" duration={700} distance={16}>
          <FaqList faqs={PLATFORM_FAQS} />
        </Reveal>
      </SegmentSection>
    </PageShell>
  );
}
