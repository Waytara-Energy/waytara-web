import { ArrowRight, Router, Server, Zap } from "lucide-react";
import { FittedDemo } from "@/components/sections/dashboard-showcase";
import { Reveal } from "@/components/shared/reveal";
import { FaqList, type Faq } from "@/components/segments/faq-list";
import { FeatureColumns, NoteColumns, SegmentSection } from "@/components/segments/segment-parts";
import { CPMS_PLATFORM_FEATURES, EMS_PLATFORM_FEATURES } from "@/components/segments/feature-sets";
import { CompatibilityForm } from "./compatibility-form";
import { PageHero, PageShell } from "./page-shell";

export const PLATFORM_PATH = "/technology";
export const PLATFORM_DESCRIPTION =
  "How WayTara connects solar inverters, batteries, meters and EV chargers to one platform: energy management for supported equipment and charge-point management for compatible OCPP chargers.";

const MENU = [
  { id: "overview", label: "Overview" },
  { id: "how", label: "How it connects" },
  { id: "energy", label: "Energy management" },
  { id: "charging", label: "Charging management" },
  { id: "demo", label: "Live demo" },
  { id: "compatibility", label: "Check compatibility" },
  { id: "faq", label: "FAQ" },
];

const PARTS = [
  {
    icon: Router,
    title: "WayTara gateway",
    body: "A small box at your site that reads your inverters, batteries and meters and sends the readings to WayTara. Chargers connect directly.",
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
    answer: "Yes. The gateway and the chargers send their data to the platform over the internet, and you see it in the dashboard.",
  },
];

function Lane({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-theme-border bg-theme-surface p-6 sm:p-7">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-theme-muted">{title}</p>
      <div className="mt-5 flex flex-col items-stretch gap-3 md:flex-row md:items-center">{children}</div>
    </div>
  );
}

function Node({ title, detail, highlight }: { title: string; detail?: string; highlight?: boolean }) {
  return (
    <div className={`flex-1 rounded-xl border bg-theme-bg px-4 py-3.5 ${highlight ? "border-emerald-500/40" : "border-theme-border"}`}>
      <p className="text-sm font-semibold text-theme-primary">{title}</p>
      {detail && <p className="mt-1 text-xs leading-relaxed text-theme-secondary">{detail}</p>}
    </div>
  );
}

function Link2({ label }: { label: string }) {
  return (
    <div className="flex shrink-0 flex-row items-center justify-center gap-2 text-center md:w-28 md:flex-col md:gap-1" aria-hidden="true">
      <ArrowRight className="size-4 rotate-90 text-theme-muted md:rotate-0" />
      <span className="text-[11px] leading-tight text-theme-muted">{label}</span>
    </div>
  );
}

/** Platform (/technology): the one place for the technical story. Every capability named here is one the product has today. */
export function PlatformPage() {
  return (
    <PageShell
      name="Platform"
      path={PLATFORM_PATH}
      menu={MENU}
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
        title="From the equipment"
        accent="to your dashboard."
        summary="Energy equipment and chargers reach the platform in different ways, then meet in one dashboard."
      >
        <Reveal direction="up" duration={800} distance={24}>
          <div className="space-y-4">
            <Lane title="Energy equipment">
              <Node title="Inverters, batteries, meters" detail="Supported equipment at your site" />
              <Link2 label="RS485 · Modbus" />
              <Node title="WayTara gateway" detail="Reads the equipment and sends it on" />
              <Link2 label="MQTT over the internet" />
              <Node title="Platform · EMS" detail="Monitoring, history, alerts, reports" highlight />
            </Lane>
            <Lane title="Charging">
              <Node title="OCPP chargers" detail="OCPP 1.6J, compatible models" />
              <Link2 label="OCPP over the internet" />
              <Node title="Platform · CPMS" detail="Status, sessions, remote controls" highlight />
            </Lane>
            <div className="rounded-2xl border border-emerald-500/30 bg-theme-surface px-6 py-5 sm:px-7">
              <p className="text-sm font-semibold text-theme-primary">One dashboard</p>
              <p className="mt-1 text-sm leading-relaxed text-theme-secondary">
                You see both in the same place, with e-mail alerts and support from your engineer. Each gateway signs in to the platform with its own key. What can be read or controlled
                depends on the make, model and enabled features of each device.
              </p>
            </div>
          </div>
        </Reveal>
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
