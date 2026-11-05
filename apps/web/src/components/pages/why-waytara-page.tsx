import { Check, Cpu, LayoutDashboard, Ruler, Users, X } from "lucide-react";
import { Reveal } from "@/components/shared/reveal";
import { EnquiryRoutes, FeatureColumns, SegmentSection } from "@/components/segments/segment-parts";
import { PageHero, PageShell } from "./page-shell";

export const WHY_PATH = "/why-waytara";
export const WHY_DESCRIPTION =
  "Why choose WayTara: one team that designs, installs and connects solar, storage and EV charging as one system, engineered for your site, and works with the equipment you already own.";

const MENU = [
  { id: "reasons", label: "Four reasons" },
  { id: "one-system", label: "One system" },
  { id: "promise", label: "Our promise" },
  { id: "enquire", label: "Enquire" },
];

const REASONS = [
  {
    icon: Users,
    title: "One accountable team",
    body: "The same team designs, installs and connects your system, and supports it afterwards. When something needs attention, there is one place to ask.",
  },
  {
    icon: Ruler,
    title: "Engineered for your site",
    body: "We size and design from your property's real consumption, roof, loads and operating hours, not from a package. Battery size follows what you need to keep running, not your bill.",
  },
  {
    icon: LayoutDashboard,
    title: "Works with what you have",
    body: "Compatible solar inverters and EV chargers you already own can join the same dashboard. You may not need to replace anything to see and manage it in one place.",
  },
  {
    icon: Cpu,
    title: "Our own software and hardware",
    body: "WayTara builds the gateway and the platform itself, so the people who install your system also understand, and can improve, how it is monitored and managed.",
  },
];

const COMPARE = [
  { what: "Who you deal with", separate: "A different supplier for solar, storage and chargers", one: "One team across all of it" },
  { what: "What you look at", separate: "A separate app for each product", one: "One dashboard for supported equipment" },
  { what: "When something goes wrong", separate: "Working out whose equipment it is", one: "One team to ask, with the whole system in view" },
  { what: "Equipment you already own", separate: "Often replaced or left unconnected", one: "Connected where it is compatible" },
];

const WE_WILL = [
  "Design each system from your property's data, not a standard package",
  "Tell you when a battery or an EV charger isn't worth adding",
  "Show research and case studies as research, with their source",
  "Check that your equipment is compatible before we promise to connect it",
  "Explain what subsidies and tax rules do and don't do for you",
  "Say plainly what is monitored, what can be controlled and what is not yet automatic",
];

const WE_WONT = [
  "Promise savings, payback or hours of backup before we have assessed your site",
  "Present a subsidy as a discount on your quotation",
  "Claim a feature, such as automatic optimisation, that hasn't been set up and tested on your system",
  "Hide the limits: solar alone doesn't keep your home running in a power cut",
];

function PromiseList({ title, items, positive }: { title: string; items: string[]; positive: boolean }) {
  const Icon = positive ? Check : X;
  return (
    <div className="rounded-2xl border border-theme-border bg-theme-surface p-6 sm:p-7">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-theme-muted">{title}</p>
      <ul className="mt-5 space-y-3">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2.5 text-sm leading-relaxed text-theme-secondary">
            <Icon className={positive ? "mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" : "mt-0.5 size-4 shrink-0 text-theme-muted"} aria-hidden="true" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Why WayTara: the reasons, the one-system idea, and what we will and will not promise. */
export function WhyWaytaraPage() {
  return (
    <PageShell
      name="Why WayTara"
      path={WHY_PATH}
      menu={MENU}
      hero={
        <PageHero
          eyebrow="Why WayTara"
          title="One team."
          accent="One system, built for your site."
          body="Solar, storage and EV charging usually come from different suppliers, each with its own app. WayTara designs, installs and connects them as one system, then helps you manage it."
          primary={{ label: "Plan my system", href: "/planner" }}
          secondary={{ label: "See the platform", href: "/technology" }}
        />
      }
    >
      <SegmentSection
        id="reasons"
        badge="Four reasons"
        title="Why people"
        accent="choose WayTara."
        summary="What is different about how we work, in plain terms."
      >
        <FeatureColumns items={REASONS} />
      </SegmentSection>

      <SegmentSection
        id="one-system"
        badge="One system"
        title="Separate products,"
        accent="or one system."
        summary="The equipment can be the same. What changes is who is responsible for how it works together."
      >
        <Reveal direction="up" duration={800} distance={24}>
          <div className="overflow-hidden rounded-2xl border border-theme-border">
            <div className="hidden grid-cols-3 border-b border-theme-border bg-theme-surface px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-theme-muted md:grid">
              <span />
              <span>Separate suppliers</span>
              <span className="text-emerald-700 dark:text-emerald-400">With WayTara</span>
            </div>
            <ul>
              {COMPARE.map((row) => (
                <li key={row.what} className="grid grid-cols-1 gap-1 border-b border-theme-border px-6 py-5 last:border-b-0 md:grid-cols-3 md:gap-4">
                  <span className="text-sm font-semibold text-theme-primary">{row.what}</span>
                  <span className="text-sm leading-relaxed text-theme-secondary">
                    <span className="mr-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-theme-muted md:hidden">Separate:</span>
                    {row.separate}
                  </span>
                  <span className="text-sm leading-relaxed text-theme-primary">
                    <span className="mr-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-400 md:hidden">WayTara:</span>
                    {row.one}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </SegmentSection>

      <SegmentSection
        id="promise"
        badge="Our promise"
        title="What we will do,"
        accent="and what we won't."
        summary="Energy is easy to oversell. These are the lines we hold to on every page of this site."
      >
        <Reveal direction="up" duration={800} distance={24}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <PromiseList title="We will" items={WE_WILL} positive />
            <PromiseList title="We won't" items={WE_WONT} positive={false} />
          </div>
        </Reveal>
      </SegmentSection>

      <EnquiryRoutes
        heading="See how it would work"
        accent="for your property."
        newRoute={{ label: "Plan a new system", href: "/planner", hint: "Solar, battery storage and EV charging, designed around your property." }}
        existingRoute={{ label: "Connect what I already have", href: "/technology#compatibility", hint: "Check whether your existing inverter or charger can join the WayTara dashboard." }}
      />
    </PageShell>
  );
}
