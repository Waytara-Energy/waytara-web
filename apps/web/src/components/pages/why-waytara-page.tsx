import { Cpu, LayoutDashboard, Ruler, Users } from "lucide-react";
import { EnquiryRoutes, FeatureColumns, InfoBand, PolicyRows, SegmentSection } from "@/components/segments/segment-parts";
import { PageHero, PageShell } from "./page-shell";

export const WHY_PATH = "/why-waytara";
export const WHY_DESCRIPTION =
  "What WayTara does: one team that designs, installs and connects solar, storage and EV charging as one system, engineered for your site, with proof you can check for yourself.";

const MENU = [
  { id: "reasons", label: "What we do" },
  { id: "proof", label: "How to check" },
  { id: "promise", label: "Our promise" },
  { id: "enquire", label: "Enquire" },
];

const REASONS = [
  { icon: Users, title: "One team", body: "The same people design, install, connect and support your system, so there is one place to ask when something needs attention." },
  { icon: Ruler, title: "Built for your site", body: "We size your system from your real power use, roof and operating hours, not from a standard package. Battery size follows what you need to keep running." },
  { icon: LayoutDashboard, title: "Works with what you have", body: "Compatible inverters and chargers you already own can join the same dashboard, so you may not need to replace anything." },
  { icon: Cpu, title: "Our own software", body: "We build the gateway and the platform ourselves, so the people who install your system understand how it is monitored." },
];

// Each point is something the visitor can look at or test, with a link to where.
const PROOF = [
  {
    tag: "Try it",
    title: "See the dashboard before you buy.",
    body: "The Platform page runs the customer dashboard on sample data. The tabs, intervals, charts and device menu all respond.",
    link: { label: "Open the live demo", href: "/technology#demo" },
  },
  {
    tag: "Check it",
    title: "Every inverter change is confirmed.",
    body: "A change to a supported inverter shows as pending until the inverter confirms it, by reading the value back.",
    link: { label: "See how control works", href: "/technology#energy" },
  },
  {
    tag: "Ask us",
    title: "Your equipment is checked before we promise anything.",
    body: "Tell us the make and model. We check it against the equipment WayTara supports before we say it can be connected.",
    link: { label: "Check my equipment", href: "/technology#compatibility" },
  },
  {
    tag: "Built in-house",
    title: "The gateway and the software are our own.",
    body: "WayTara builds the gateway and the platform together, so the people who install your system understand how it is monitored and managed.",
    link: { label: "See how the platform fits together", href: "/technology#overview" },
  },
  {
    tag: "Worked out for you",
    title: "Savings come from your own tariff.",
    body: "Your bill is worked out month by month the way your electricity board does it, with bands, free units and duty. Reports print the figures they used and where those come from.",
    link: { label: "See what the dashboard does", href: "/technology#energy" },
  },
];

const PROMISES = [
  "We design each system from your property's data, not a standard package",
  "We tell you when a battery or an EV charger isn't worth adding",
  "We show research and case studies as research, with their source",
  "We check that your equipment is compatible before we promise to connect it",
  "We explain what subsidies and tax rules do and don't do for you",
  "We say plainly what is monitored, what can be controlled and what is not yet automatic",
  "We assess your site before we give savings, payback or hours of backup",
  "We show a subsidy as what it is: paid after the process, not a discount on your quotation",
  "We name a feature only once it is set up and tested on your system",
  "We say plainly that solar alone doesn't keep your home running in a power cut",
];

/** Why WayTara: what WayTara does, how a visitor can check it, and the lines we hold to. No comparison with anyone else. */
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
          body="WayTara designs, installs and connects solar, battery storage and EV charging as one system, then helps you manage it from one dashboard. Here is what that means, and where you can check it."
          primary={{ label: "Plan my system", href: "/planner" }}
          secondary={{ label: "See the platform", href: "/technology" }}
        />
      }
    >
      <SegmentSection
        id="reasons"
        badge="What we do"
        title="What you can"
        accent="count on."
        summary="Four things we do on every project."
      >
        <FeatureColumns items={REASONS} />
      </SegmentSection>

      <SegmentSection
        id="proof"
        badge="Proof"
        title="Things you can"
        accent="check for yourself."
        summary="Each one points to where you can see it."
      >
        <PolicyRows items={PROOF} />
      </SegmentSection>

      <SegmentSection id="promise" badge="Our promise" title="What we hold to" accent="on every page.">
        <InfoBand bare title="Energy is easy to oversell." body="These are the lines we keep, here and in every conversation." items={PROMISES} />
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
