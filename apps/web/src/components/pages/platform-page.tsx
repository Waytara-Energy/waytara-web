import { ArrowRight, Eye, Hand, Plug, Server, Zap } from "lucide-react";
import { FittedDemo } from "@/components/sections/dashboard-showcase";
import { Reveal } from "@/components/shared/reveal";
import { CPMS_FEATURES } from "@/components/segments/capabilities";
import { FaqList, type Faq } from "@/components/segments/faq-list";
import { FeatureColumns, SegmentSection } from "@/components/segments/segment-parts";
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
    icon: Plug,
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

const ENERGY_SEE = [
  "Live generation, load, grid import and export, and battery flow",
  "Daily, monthly and yearly history for each connected device",
  "Online and offline status, with e-mail alerts when a device goes quiet",
  "Reports you can download",
];

const ENERGY_DO = [
  "Change selected inverter settings from the dashboard. Each change is confirmed by reading the value back from the inverter.",
  "Ask your engineer for help through support tickets in the same app.",
];

const CHARGING_SEE = [
  "Whether each charger is connected, available or charging",
  "Live power and energy for a running session",
  "Session history, with the energy delivered in each",
];

const CHARGING_DO = [
  "Start or stop a session remotely on a compatible charger",
  "Reset a charger or unlock a connector",
  "Read a charger's settings, and see which OCPP features, including smart-charging limits, it supports",
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

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2.5 text-sm leading-relaxed text-theme-secondary">
          <span className="mt-2 size-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function SeeDo({ see, doo, extraDo = [] }: { see: string[]; doo: string[]; extraDo?: string[] }) {
  return (
    <Reveal direction="up" duration={800} distance={24}>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12">
        <div className="rounded-2xl border border-theme-border bg-theme-surface p-6 sm:p-7">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-theme-muted">
            <Eye className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            What you can see
          </p>
          <div className="mt-5">
            <Bullets items={see} />
          </div>
        </div>
        <div className="rounded-2xl border border-theme-border bg-theme-surface p-6 sm:p-7">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-theme-muted">
            <Hand className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            What you can do
          </p>
          <div className="mt-5">
            <Bullets items={[...doo, ...extraDo]} />
          </div>
        </div>
      </div>
    </Reveal>
  );
}

/** Platform (/technology): the one place for the technical story. Every capability named here is one the product has today. */
export function PlatformPage() {
  const chargingDo = [
    ...CHARGING_DO,
    ...(CPMS_FEATURES.monetisation ? ["Run charging as a commercial service, with users, access and paid charging"] : []),
    ...(CPMS_FEATURES.loadAllocation ? ["Apply charging limits to compatible chargers to share the site's capacity"] : []),
  ];

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
        <SeeDo see={ENERGY_SEE} doo={ENERGY_DO} />
        <Reveal direction="up" duration={700} distance={16}>
          <div className="mt-8 grid grid-cols-1 gap-x-10 gap-y-6 text-sm leading-relaxed text-theme-secondary md:grid-cols-2">
            <p>
              <span className="block font-semibold text-theme-primary">Supported equipment</span>
              Deye hybrid inverters are supported today. Other makes and models are assessed and added after testing on real equipment, and we confirm yours before you commit.
            </p>
            <p>
              <span className="block font-semibold text-theme-primary">What control means</span>
              Control means selected, tested settings on a supported inverter. It is not unrestricted battery-management control or grid-scale dispatch.
            </p>
          </div>
        </Reveal>
      </SegmentSection>

      <SegmentSection
        id="charging"
        badge="Charging management"
        title="Run your chargers"
        accent="from one place."
        summary="For OCPP 1.6J chargers. The functions available depend on each charger's supported OCPP features and firmware."
      >
        <SeeDo see={CHARGING_SEE} doo={chargingDo} />
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
        <Reveal direction="up" duration={800} distance={24}>
          <div className="max-w-3xl">
            <CompatibilityForm />
          </div>
        </Reveal>
      </SegmentSection>

      <SegmentSection id="faq" badge="FAQ" title="Questions about" accent="the platform.">
        <Reveal direction="up" duration={700} distance={16}>
          <FaqList faqs={PLATFORM_FAQS} />
        </Reveal>
      </SegmentSection>
    </PageShell>
  );
}
