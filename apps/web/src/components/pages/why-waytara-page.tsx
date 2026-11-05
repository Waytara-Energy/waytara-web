import Link from "next/link";
import {
  ArrowRight,
  Bell,
  BellRing,
  Building2,
  Cpu,
  EyeOff,
  Factory,
  FileSpreadsheet,
  FileText,
  House,
  Layers,
  LayoutDashboard,
  Leaf,
  Lock,
  MailCheck,
  MonitorSmartphone,
  Palette,
  PlugZap,
  Receipt,
  ReceiptIndianRupee,
  Router,
  Ruler,
  Server,
  ShieldCheck,
  Smartphone,
  Store,
  Truck,
  UserCheck,
  UserRound,
  Users,
  Zap,
} from "lucide-react";
import { Reveal } from "@/components/shared/reveal";
import { EnquiryRoutes, FeatureColumns, InfoBand, NoteColumns, PolicyRows, SegmentSection } from "@/components/segments/segment-parts";
import { PageHero, PageShell } from "./page-shell";

export const WHY_PATH = "/why-waytara";
export const WHY_DESCRIPTION =
  "What WayTara does: one team that designs, installs and connects solar, storage and EV charging as one system, with its own gateway and software, ready reports, secure accounts and proof you can check for yourself.";

const MENU = [
  { id: "reasons", label: "What we do" },
  { id: "system", label: "One connected system" },
  { id: "reports", label: "Reports" },
  { id: "security", label: "Security" },
  { id: "account", label: "Your account" },
  { id: "everyone", label: "Every property" },
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

// The gateway and the system it feeds. Each point is something the product does today (see the Platform page).
const SYSTEM = [
  { icon: Router, title: "Our own gateway", body: "A small box at your site reads your inverters, batteries and meters and sends the readings to WayTara. It signs in with its own key." },
  { icon: PlugZap, title: "Chargers connect directly", body: "OCPP 1.6J chargers connect to our charging platform over the internet, with status, sessions and remote start and stop where supported." },
  { icon: LayoutDashboard, title: "One dashboard", body: "Solar, battery, load, grid and EV charging on one live energy-flow diagram, with history for every device you connect." },
  { icon: Layers, title: "Every site, one login", body: "Switch between your sites. Each one has its own devices (inverters, batteries, meters and chargers), each with its own tab." },
];

// Reports that exist today (Reports module). The carbon figure is an estimate and says so. Tax and subsidy forms are not generated: the page says who files them.
const REPORTS = [
  { icon: FileText, title: "Monthly statement", body: "The month's energy, the bill with and without solar, the carbon avoided and every day, as a PDF you can download." },
  { icon: Leaf, title: "Carbon avoided", body: "CO₂ avoided is worked out from your solar generation with India's grid emission factor, which is printed on the report with its source." },
  { icon: ReceiptIndianRupee, title: "Savings from your tariff", body: "Month-by-month bills with and without solar, worked out the way your electricity board does it, with bands, free units and duty." },
  { icon: Zap, title: "EV charging report", body: "Every charging session and the energy it delivered, for each charger, as a PDF or a CSV file, whenever you need it." },
  { icon: MailCheck, title: "Reports that arrive by themselves", body: "Save a report once and have it e-mailed every day, every week or every month at the time you choose, India time." },
  { icon: FileSpreadsheet, title: "CSV for your accountant", body: "Reports download as CSV files as well as PDFs, so your accountant or auditor can work with the figures you have." },
];

// Security, as the product and docs/SECURITY.md describe it today. Nothing here claims a penetration test or a certification: neither has been done.
const SECURITY = [
  { icon: UserCheck, title: "Accounts set up for you", body: "WayTara sets up each customer's account when the system is installed, and you get an invitation e-mail to start." },
  { icon: ShieldCheck, title: "Your data stays yours", body: "Every customer sees only their own sites, devices and readings. This is enforced in the database itself, not only in the app." },
  { icon: Smartphone, title: "Two-factor sign-in", body: "Turn on a code from an authenticator app for extra protection. Changing your password needs a code sent to your e-mail." },
  { icon: MonitorSmartphone, title: "You control your sign-ins", body: "See the devices signed in to your account and end any of them. Choose when an idle or long session signs you out." },
  { icon: BellRing, title: "You hear about it", body: "Get an e-mail when your account is signed in to, with the device and time, and see a record of recent account activity." },
  { icon: Lock, title: "Private files, checked code", body: "Documents and attachments are stored privately and opened only through secure links. Our code is scanned for security issues on every change." },
];

const ACCOUNT = [
  { icon: UserRound, title: "Your profile", body: "Your photo, name and phone number, and an e-mail address that you change only with a code sent to the new one." },
  { icon: Bell, title: "E-mails you control", body: "Choose which e-mails you get in five groups (account, devices, faults, billing and support), or pause them for a while." },
  { icon: BellRing, title: "Alerts of your own", body: "Get an alert when a value crosses a limit you set, such as the battery below 20%. Fifteen readings to watch, and smart alerts ready-made." },
  { icon: Palette, title: "Units and looks", body: "Show power, energy and temperature in the units you prefer, and pick a light or dark theme and your text size." },
  { icon: Receipt, title: "Billing and GST invoices", body: "Your plan and payments in one place, with a GST invoice for every paid payment that you can view, download or e-mail to yourself." },
  { icon: EyeOff, title: "Privacy and your data", body: "See what WayTara keeps about you, choose how long sign-in history is kept, and ask us to delete your account." },
];

// From the solution pages: one line each, linking to the page.
const EVERYONE = [
  { icon: House, title: "Homes and villas", body: "Rooftop solar, battery backup and EV charging designed around your home, with one dashboard for all of it.", link: { label: "See homes", href: "/solutions/home" } },
  { icon: Building2, title: "Apartments and developers", body: "Lower common-area bills, backup for key services and shared EV charging for communities and new developments.", link: { label: "See apartments", href: "/solutions/apartment" } },
  { icon: Store, title: "Commercial buildings", body: "Solar, storage and EV charging for offices, hospitals, hotels and retail, built around operating hours.", link: { label: "See commercial", href: "/solutions/commercial" } },
  { icon: Factory, title: "Factories", body: "Industrial solar, battery storage and generator-integrated systems designed around your plant's operation.", link: { label: "See factories", href: "/solutions/factory" } },
  { icon: Truck, title: "EV fleets and charging", body: "Charging for fleet depots and networks, with our own software to manage compatible chargers from one place.", link: { label: "See EV fleets", href: "/solutions/ev-fleet" } },
  { icon: Server, title: "IT parks and campuses", body: "Plan, monitor and manage solar, storage and EV charging across a campus, with one connected view of energy.", link: { label: "See campuses", href: "/solutions/it-park" } },
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
    tag: "Read the working",
    title: "Your numbers show their working.",
    body: "Every report prints the figures it used, such as the grid emission factor and where it comes from, so you can stand behind the numbers.",
    link: { label: "See what the dashboard does", href: "/technology#energy" },
  },
  {
    tag: "Know the limits",
    title: "We tell you what each charger supports.",
    body: "You can see which OCPP features a charger offers, including smart-charging limits, before you plan around them.",
    link: { label: "See charger management", href: "/technology#charging" },
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

/** Why WayTara: what WayTara does and how a visitor can check it. No comparison with anyone else. */
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
          body="WayTara designs, installs and connects solar, battery storage and EV charging as one system, then gives you one secure dashboard to run it, with the reports you need. Here is what that means, and where you can check it."
          primary={{ label: "Plan my system", href: "/planner" }}
          secondary={{ label: "See the platform", href: "/technology" }}
        />
      }
    >
      <SegmentSection id="reasons" badge="What we do" title="What you can" accent="count on." summary="Four things we do on every project.">
        <FeatureColumns items={REASONS} />
      </SegmentSection>

      <SegmentSection
        id="system"
        badge="One connected system"
        title="From the equipment"
        accent="to one dashboard."
        summary="The gateway and the software are built together, so everything you connect shows up in the same place."
      >
        <FeatureColumns items={SYSTEM} />
        <Reveal direction="up" duration={700} distance={16}>
          <div className="mt-16 flex justify-center">
            <Link href="/technology" className="group inline-flex items-center gap-1.5 text-sm font-semibold text-theme-highlight underline-offset-4 hover:underline">
              See how the platform works
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          </div>
        </Reveal>
      </SegmentSection>

      <SegmentSection
        id="reports"
        badge="Reports"
        title="Reports that are ready"
        accent="when you need them."
        summary="Download them, or have them e-mailed to you on a schedule. Every report prints the figures it used."
      >
        <FeatureColumns items={REPORTS} columns={3} />
        <NoteColumns
          items={[
            {
              title: "About the carbon figure",
              body: "It is an estimate from your solar generation and a published grid emission factor, not a certified carbon credit. The factor used is printed on every report.",
            },
            {
              title: "Tax and subsidy forms",
              body: "Subsidy, GST and income-tax forms are filed by you or your accountant on the official portals. WayTara supplies the figures: your generation, your savings and your GST invoices.",
            },
          ]}
        />
      </SegmentSection>

      <SegmentSection
        id="security"
        badge="Security"
        title="Your account and your data,"
        accent="kept safe."
        summary="What protects them today, in plain terms."
      >
        <FeatureColumns items={SECURITY} columns={3} />
      </SegmentSection>

      <SegmentSection
        id="account"
        badge="Your account"
        title="Yours to set up"
        accent="the way you like."
        summary="Everything about your account, in one place in the dashboard."
      >
        <FeatureColumns items={ACCOUNT} columns={3} />
      </SegmentSection>

      <SegmentSection
        id="everyone"
        badge="Every property"
        title="The same system,"
        accent="for every kind of property."
        summary="Each has its own page, with what we do for it."
      >
        <FeatureColumns items={EVERYONE} columns={3} />
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
