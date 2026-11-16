import { Ban, BadgeCheck, ClipboardList, Cpu, FileCheck, GraduationCap, Handshake, MapPin, Package, PlugZap, Ruler, Scale, ShieldCheck, Sun, Wrench, Zap } from "lucide-react";
import { Reveal } from "@/components/shared/reveal";
import { FaqList, type Faq } from "@/components/segments/faq-list";
import { FeatureColumns, SegmentSection, type Feature } from "@/components/segments/segment-parts";
import { ProjectSteps } from "@/components/sections/project-steps";
import { PARTNER_REGIONS, PARTNER_TYPES } from "@/lib/partner-network";
import { SITE } from "@/lib/site";
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

// What each kind of partner needs to have. It is asked for at onboarding (not in the first form), copies are asked for, and we check them.
const REQUIREMENTS: Feature[] = [
  {
    icon: Zap,
    title: "Electrical contractors",
    body: "The business that signs for the electrical work.",
    includes: [
      "A valid TNELB electrical contractor licence in the business's own name",
      "A supervisor and wiremen who hold their own TNELB competency certificates",
      "Past installation work we can ask about",
      "Safe working practice, and insurance where it applies",
    ],
  },
  {
    icon: Sun,
    title: "Solar installation teams",
    body: "The team that builds and commissions the system.",
    includes: [
      "Rooftop or commercial solar systems you have already installed",
      "Electrical work done by a licensed contractor, yours or a partner's",
      "Trained installers and a named site lead",
      "Safe work at height, and a way to deal with faults after handover",
    ],
  },
  {
    icon: PlugZap,
    title: "EV charging teams",
    body: "The team that installs and commissions chargers.",
    includes: [
      "AC or DC chargers you have already installed",
      "Electrical work done by a licensed contractor, yours or a partner's",
      "Installation to the electrical safety rules, with test records kept",
      "Willingness to commission to our checklist, including the link to a charging management system",
    ],
  },
  {
    icon: Wrench,
    title: "Field technicians",
    body: "People who do the hands-on work.",
    includes: [
      "Training or experience in electrical or electronics work (an ITI, diploma, degree or on the job)",
      "A Wireman or Supervisor competency certificate where the work needs one, or work under a supervisor from a licensed contractor",
      "Experience with solar, inverters, batteries or EV chargers",
      "Reliable travel within your district",
    ],
  },
];

// The contractor grades as the Tamil Nadu Electrical Inspectorate lists them (the scopes of ESB, EA and ESA). TNELB sets the limits, so the page points to it.
const GRADES = [
  { grade: "EB", scope: "Smaller low-voltage installations. TNELB sets the limits of this grade." },
  { grade: "ESB", scope: "Electrical installations up to 650 V." },
  { grade: "EA", scope: "Electrical installations up to and including 33 kV." },
  { grade: "ESA", scope: "Electrical installations at every voltage, with no limit." },
];

const LICENCE_POINTS: Feature[] = [
  {
    icon: FileCheck,
    title: "A licence and a certificate are different things",
    body: "A contractor licence belongs to a business. A Wireman or Supervisor competency certificate belongs to a person. We ask for both, with their numbers and validity.",
  },
  {
    icon: Scale,
    title: "Your grade sets the work you can take",
    body: "A project is given only where your verified licence fits its voltage, load and work. A 415 V three-phase supply is still low voltage, however large the site.",
  },
  {
    icon: ShieldCheck,
    title: "We check, we do not assume",
    body: "Picking a grade on a form proves nothing. We ask for the actual licence and check it with the Board before anything is approved.",
  },
];

const WE_DO = [
  "Have a person read every application, not only a form",
  "Check licences and certificates with the issuing authority before approving",
  "Share a project only where your verified scope, capability and availability match it",
  "Put the terms in a written partner agreement and a work order for each project",
  "Use your details only to review your application and get in touch",
];

const WE_DO_NOT = [
  "Promise a minimum number of projects, or any income",
  "Promise that applying leads to a partnership",
  "Offer employment, a salary or benefits",
  "Make you a government-approved vendor, or give you any scheme empanelment or approval",
  "Set territory, rates or terms on this page: they belong in the written agreement, so ask for what you rely on in writing",
];

const CANNOT_ONBOARD = [
  "Anyone who would use another business's licence or certificate as their own",
  "Anyone who would do regulated electrical work without the licence, or the authorised contractor, it requires",
  "Referral agents: the network is for people who do the work",
];

const STEPS = [
  { title: "Apply", body: "A short form that takes a few minutes. No licences or documents at this stage.", tag: "You" },
  { title: "We call you", body: "Our partnerships team looks at your business, your area and your experience, and calls you.", tag: "Our team" },
  { title: "Onboarding invitation", body: "If you are shortlisted you get a personal, secure link to add your business details, licences, team and documents.", tag: "Shortlisted" },
  { title: "Verification", body: "We check your licences and certificates with the issuing authority, and your team, past work and capability.", tag: "Our team" },
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
    question: "What do I need to become a partner?",
    answer:
      "It depends on what you do. A contractor business needs a valid TNELB electrical contractor licence in its own name, with a supervisor and wiremen who hold their own competency certificates. Solar and EV charging teams need installations behind them and electrical work done by a licensed contractor. Technicians need relevant training or experience, and a competency certificate where the work needs one. We ask for copies at onboarding and check them.",
  },
  {
    question: "Can I work under someone else's licence?",
    answer:
      "Only if you really work for or with that licensed contractor, and they are the partner who signs for the electrical work. We do not accept a licence or certificate that is used by someone it does not belong to. Approval covers only the scope we have verified.",
  },
  {
    question: "Does software or monitoring work need a contractor licence?",
    answer:
      "Dashboards, data and configuring a gateway are not electrical installation work. Wiring, panels, protection devices and earthing are, and they must be done by appropriately licensed and qualified people.",
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
        id="requirements"
        badge="What we look for"
        title="What a partner needs"
        accent="to have."
        summary="We ask for these at onboarding, with copies, and we check them. Nothing is needed in the first form."
      >
        <FeatureColumns items={REQUIREMENTS} />
      </SegmentSection>

      <SegmentSection
        id="licences"
        badge="Licences"
        title="Licences,"
        accent="explained."
        summary="Electrical installation work in Tamil Nadu is regulated. This is how we read it, so you know what to expect from us."
      >
        <Reveal direction="up" duration={700} distance={16}>
          <p className="text-sm font-semibold text-theme-muted">The four TNELB electrical contractor grades</p>
          <dl className="mt-4 max-w-3xl divide-y divide-theme-border border-y border-theme-border">
            {GRADES.map((g) => (
              <div key={g.grade} className="grid grid-cols-[4.5rem_1fr] gap-4 py-4 sm:grid-cols-[7rem_1fr]">
                <dt className="text-lg font-bold text-theme-primary">{g.grade}</dt>
                <dd className="text-[15px] leading-relaxed text-theme-secondary">{g.scope}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-theme-muted">
            The grades, their limits and the rules for Wireman and Supervisor certificates are set by the Tamil Nadu Electrical Licensing Board and can change. Check them with the Board at{" "}
            <a href="https://tnelb.gov.in" target="_blank" rel="noopener noreferrer" className="text-theme-highlight underline-offset-4 hover:underline">
              tnelb.gov.in
            </a>
            . Software, dashboards and gateway configuration are not electrical installation; wiring, panels, protection and earthing are.
          </p>
        </Reveal>
        <div className="mt-20">
          <FeatureColumns items={LICENCE_POINTS} />
        </div>
      </SegmentSection>

      <SegmentSection
        id="offer"
        badge="What WayTara offers"
        title="Build your energy business,"
        accent="execute with WayTara."
        summary="Partnerships are project-based, and every project depends on verification, capability and availability."
      >
        <FeatureColumns items={OFFER} columns={3} />
      </SegmentSection>

      <SegmentSection id="where" badge="Where we are recruiting" title="Across" accent="Tamil Nadu." summary="Applications are open statewide. Tell us your district and the places you can work in.">
        <FeatureColumns items={WHERE} />
      </SegmentSection>

      <ProjectSteps id="how" badge="How it works" title="From application to" accent="partner." summary="Five steps, and only the first one needs anything from you today." steps={STEPS} />

      <SegmentSection id="straight" badge="Plain words" title="What we do, and what we" accent="do not promise." summary="So nobody joins on a wrong impression.">
        <Reveal direction="up" duration={800} distance={24}>
          <div className="grid grid-cols-1 gap-12 md:grid-cols-3 md:gap-10">
            {[
              { icon: BadgeCheck, title: "What we do", items: WE_DO },
              { icon: Ban, title: "What we do not promise", items: WE_DO_NOT },
              { icon: ShieldCheck, title: "Who we cannot onboard", items: CANNOT_ONBOARD },
            ].map(({ icon: Icon, title, items }) => (
              <div key={title}>
                <Icon className="size-12 stroke-[1.1] text-theme-primary sm:size-14" aria-hidden="true" />
                <h3 className="mt-6 text-lg font-bold tracking-tight text-theme-primary sm:text-xl">{title}</h3>
                <ul className="mt-5 space-y-3 border-t border-theme-border pt-5">
                  {items.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm leading-relaxed text-theme-secondary">
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-theme-muted" aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Reveal>
      </SegmentSection>

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
                <p className="mt-4 max-w-sm text-sm leading-relaxed text-theme-muted">
                  A question before you apply?{" "}
                  <a href={SITE.whatsapp} target="_blank" rel="noopener noreferrer" className="font-semibold text-theme-highlight underline-offset-4 hover:underline">
                    Message us on WhatsApp
                  </a>
                  .
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
