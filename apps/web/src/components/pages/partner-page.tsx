import { ClipboardList, Cpu, GraduationCap, Handshake, MapPin, Package, PlugZap, Ruler, Sun, Wrench, Zap } from "lucide-react";
import { Reveal } from "@/components/shared/reveal";
import { FaqList, type Faq } from "@/components/segments/faq-list";
import { FeatureColumns, SegmentSection, type Feature } from "@/components/segments/segment-parts";
import { ProjectSteps } from "@/components/sections/project-steps";
import { PARTNER_REGIONS, PARTNER_TYPES } from "@/lib/partner-network";
import { PageHero, PageShell } from "./page-shell";
import { PartnerForm } from "./partner-form";

export const PARTNER_PATH = "/partner";
export const PARTNER_DESCRIPTION =
  "Join the WayTara Partner Network in Tamil Nadu: electrical contractors, solar installation teams, EV charging specialists and field technicians. Project-based partnerships, technical collaboration and a professional network.";

// Each card links to the form with its own kind chosen (the form listens for #apply-<kind>).
const WHO: Feature[] = [
  {
    icon: Zap,
    title: "Electrical contractors",
    body: "Licensed contractor businesses and electrical EPC companies that carry out electrical work through qualified people.",
    includes: ["TNELB-licensed contractor businesses", "Electrical EPC companies", "Established electrical contractors"],
    whoFor: "Businesses that hold a TNELB licence come first.",
    link: { label: "Apply as a contractor", href: "#apply-contractor" },
  },
  {
    icon: Sun,
    title: "Solar installation partners",
    body: "Solar EPC companies and installation teams that build residential and commercial rooftop systems.",
    includes: ["Rooftop solar installation teams", "Commercial solar EPC partners", "Inverter installation technicians", "Commissioning and O&M teams"],
    whoFor: "Teams with solar installations already behind them.",
    link: { label: "Apply as a solar partner", href: "#apply-solar" },
  },
  {
    icon: PlugZap,
    title: "EV charging partners",
    body: "Teams that install, commission and look after AC and DC chargers, and connect them to a charging management system.",
    includes: ["AC EV charger installers", "DC fast charger installation partners", "Charger commissioning technicians", "OCPP and CMS integration specialists"],
    whoFor: "Teams that have installed chargers before.",
    link: { label: "Apply as an EV charging partner", href: "#apply-ev" },
  },
  {
    icon: Wrench,
    title: "Field technicians",
    body: "Electricians and technicians who want project-based field assignments on modern energy systems.",
    includes: ["Electricians and ITI electrical or electronics technicians", "Solar installation technicians", "Inverter and battery technicians", "EV charger and energy gateway technicians"],
    whoFor: "People who work through an appropriately authorised execution partner.",
    link: { label: "Register as a technician", href: "#apply-technician" },
  },
];

const OFFER: Feature[] = [
  { icon: Handshake, title: "Project opportunities", body: "Solar rooftop, EV charging and battery storage projects, shared with verified partners." },
  { icon: Ruler, title: "Engineering and technical coordination", body: "Our engineers work with you on design, specifications and site questions." },
  { icon: Package, title: "Equipment and procurement support", body: "Help with sourcing the equipment a project needs." },
  { icon: ClipboardList, title: "Structured work orders", body: "A clear scope, a clear handover and a record of what was done." },
  { icon: Cpu, title: "Technology and integration support", body: "Charger, inverter and monitoring integration with the WayTara platform." },
  { icon: GraduationCap, title: "Technical exposure", body: "Hands-on work with modern solar, battery, EV charging and monitoring systems." },
];

const WHERE: Feature[] = PARTNER_REGIONS.map((r) => ({ icon: MapPin, title: r.name, body: `${r.places.join(", ")} and the districts around them.` }));

const STEPS = [
  { title: "Apply", body: "A short form that takes a few minutes. No licences or documents at this stage.", tag: "You" },
  { title: "We call you", body: "Our partnerships team looks at your business, your area and your experience, and calls you.", tag: "Our team" },
  { title: "Onboarding invitation", body: "If you are shortlisted you get a personal, secure link to add your business details, licences, team and documents.", tag: "Shortlisted" },
  { title: "Verification", body: "We check the credentials and technical capability you submit.", tag: "Our team" },
  { title: "Partner agreement", body: "Approved partners sign a partner agreement. Projects are shared as verification, capability and availability allow.", tag: "Approved" },
];

const FORM_PARTS = [
  { title: "What you are applying as", body: "A contractor, a solar or EV charging partner, or a technician." },
  { title: "Your details", body: "Your name, mobile number and e-mail." },
  { title: "Where you work", body: "Your district and the other places you can cover." },
  { title: "About your work", body: "A few short questions for your kind of work." },
  { title: "Anything else", body: "Whatever else you would like us to know." },
];

export const PARTNER_FAQS: Faq[] = [
  {
    question: "What happens after I apply?",
    answer:
      "We e-mail you a confirmation with your application reference. Our partnerships team reviews your details and calls you about the next steps. If you are shortlisted, you get a personal, secure link to submit your business information, technical capabilities and supporting credentials. Applying does not guarantee a partnership.",
  },
  {
    question: "Is this a job?",
    answer:
      "No. The Partner Network is a project-based commercial partnership, not employment and not a salaried vacancy. WayTara does not promise a minimum number of projects or a guaranteed income. Assignments depend on verified skills, capability and project availability.",
  },
  {
    question: "Do I need a licence to apply?",
    answer:
      "Contractor businesses that hold a TNELB electrical contractor licence come first, and we ask which grade you hold. Electrical work on solar and EV charging projects must be done by appropriately qualified and authorised people, so we ask whether yours goes through a licensed contractor. A technician who does not hold a Wireman or Supervisor certificate is not turned away automatically: some assignments are supervised or do not need one.",
  },
  {
    question: "What documents do I need now?",
    answer: "None. The first form asks only a few questions. Licences, company details, team details and documents are asked later, and only if you are shortlisted.",
  },
  {
    question: "Which areas do you cover?",
    answer: "All of Tamil Nadu. Choose the district you mainly work in and, if you like, the other places you can cover. We are building the network across the state, so every district is welcome.",
  },
  {
    question: "Can we talk in Tamil?",
    answer: "Yes. Our team speaks with applicants in Tamil or English, whichever you are more comfortable with.",
  },
];

/** The WayTara Partner Network (Tamil Nadu): who we look for, what we offer, how it works, and a short application with a form for each kind of partner. */
export function PartnerPage() {
  return (
    <PageShell
      name="Partner with WayTara"
      path={PARTNER_PATH}
      faqs={PARTNER_FAQS}
      hero={
        <PageHero
          eyebrow="WayTara Partner Network · Tamil Nadu"
          title="Powering the energy transition,"
          accent="together."
          body="Join our network of electrical contractors, solar installation teams, EV charging specialists and energy technology professionals across Tamil Nadu. Project-based partnerships, technical collaboration and a professional network."
          primary={{ label: "Apply to partner", href: "#apply" }}
          secondary={{ label: "How it works", href: "#how" }}
        />
      }
    >
      <SegmentSection
        id="who"
        badge="Who we look for"
        title="Four kinds of"
        accent="partner."
        summary="Choose the one that fits you when you apply. Each has its own short set of questions."
      >
        <FeatureColumns items={WHO} />
      </SegmentSection>

      <SegmentSection
        id="offer"
        badge="What WayTara offers"
        title="Build your energy business,"
        accent="execute with WayTara."
        summary="Partnerships are project-based, and every project depends on verification, capability and availability."
      >
        <FeatureColumns items={OFFER} columns={3} />
        <Reveal direction="up" duration={700} distance={16}>
          <p className="mt-16 max-w-3xl border-t border-theme-border pt-6 text-sm leading-relaxed text-theme-muted">
            This is a commercial partnership, not employment. WayTara does not promise a minimum number of projects or a guaranteed income, and joining the network does not make you a
            government-approved vendor or give you any approval or empanelment. Electrical work must be carried out by appropriately qualified and authorised people.
          </p>
        </Reveal>
      </SegmentSection>

      <SegmentSection id="where" badge="Where we are recruiting" title="Across" accent="Tamil Nadu." summary="Applications are open statewide. Tell us your district and the places you can work in.">
        <FeatureColumns items={WHERE} />
      </SegmentSection>

      <ProjectSteps id="how" badge="How it works" title="From application to" accent="partner." summary="Five steps, and only the first one needs anything from you today." steps={STEPS} />

      <SegmentSection id="apply" badge="Apply" title="Tell us about" accent="your work." summary="It takes a few minutes. தமிழிலும் ஆங்கிலத்திலும் பேசலாம்: we can talk in Tamil or English.">
        {/* Where a link such as /partner#apply-solar lands: the form (below) chooses that kind when it sees the link. */}
        {PARTNER_TYPES.map((t) => (
          <span key={t.id} id={`apply-${t.id}`} className="block scroll-mt-28" aria-hidden="true" />
        ))}
        <Reveal direction="up" duration={800} distance={24}>
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-5 lg:gap-16">
            <aside className="lg:col-span-2">
              <div className="lg:sticky lg:top-32">
                <p className="text-sm font-semibold text-theme-muted">Five short parts</p>
                <ol className="mt-5 space-y-4">
                  {FORM_PARTS.map((part, i) => (
                    <li key={part.title} className="flex gap-4">
                      <span className="pt-0.5 text-sm font-semibold tabular-nums text-theme-highlight">{String(i + 1).padStart(2, "0")}</span>
                      <span>
                        <span className="block text-base font-semibold text-theme-primary">{part.title}</span>
                        <span className="mt-0.5 block text-sm leading-relaxed text-theme-secondary">{part.body}</span>
                      </span>
                    </li>
                  ))}
                </ol>
                <p className="mt-8 max-w-sm border-t border-theme-border pt-6 text-sm leading-relaxed text-theme-muted">
                  No licences or documents are needed now. This is a partner registration, not a job application, and it does not guarantee a partnership or projects. We use these details only
                  to review your application and get in touch.
                </p>
              </div>
            </aside>
            <div className="relative lg:col-span-3">
              <PartnerForm />
            </div>
          </div>
        </Reveal>
      </SegmentSection>

      <SegmentSection id="faq" badge="FAQ" title="Questions from" accent="partners.">
        <Reveal direction="up" duration={700} distance={16}>
          <FaqList faqs={PARTNER_FAQS} />
        </Reveal>
      </SegmentSection>
    </PageShell>
  );
}
