import Link from "next/link";
import { ArrowRight, Check, ClipboardCheck, ClipboardList, EvCharger, FileText, GraduationCap, Handshake, HardHat, Package, Ruler, Sun, Wrench, X } from "lucide-react";
import { Reveal } from "@/components/shared/reveal";
import { FaqList, type Faq } from "@/components/segments/faq-list";
import { FeatureColumns, SegmentSection, type Feature } from "@/components/segments/segment-parts";
import { ProjectSteps } from "@/components/sections/project-steps";
import { PARTNER_TYPES } from "@/lib/partner-network";
import { SITE } from "@/lib/site";
import type { ListedPartner } from "@/lib/partner-directory";
import { PageHero, PageShell } from "./page-shell";
import { PartnerForm } from "./partner-form";
import { PartnerMap } from "./partner-map";

export const PARTNER_PATH = "/partner";
export const PARTNER_DESCRIPTION =
  "Join the WayTara Partner Network in Tamil Nadu: electrical contractors, solar and EV charging teams and field technicians. Project-based work, clear terms.";

// The longer answers, on the blog.
const BLOG_LINKS = [
  { label: "The licence grades, explained", href: "/blog/licence-grades" },
  { label: "Wireman and Supervisor certificates", href: "/blog/competency-certificates" },
  { label: "Working under a licensed contractor", href: "/blog/working-under-a-contractor" },
  { label: "Documents we ask for, and how we protect them", href: "/blog/partner-documents-and-privacy" },
];

// Who can join, and what each kind needs to have. Each card's link opens the form on that kind (the form listens for #apply-<kind>).
const WHO: Feature[] = [
  {
    icon: HardHat,
    title: "Electrical contractors",
    body: "Licensed businesses that carry out electrical work.",
    includes: ["A TNELB contractor licence in the business's own name", "A supervisor and wiremen with their own certificates", "Installation work you can show us"],
    link: { label: "Apply as a contractor", href: "#apply-contractor" },
  },
  {
    icon: Sun,
    title: "Solar installation teams",
    body: "Teams that build and commission rooftop solar.",
    includes: ["Solar systems you have already installed", "Electrical work done through a licensed contractor", "Trained installers and a named site lead"],
    link: { label: "Apply as a solar partner", href: "#apply-solar" },
  },
  {
    icon: EvCharger,
    title: "EV charging teams",
    body: "Teams that install and commission EV chargers.",
    includes: ["AC or DC chargers you have already installed", "Electrical work done through a licensed contractor", "Test records kept for every installation"],
    link: { label: "Apply as an EV charging partner", href: "#apply-ev" },
  },
  {
    icon: Wrench,
    title: "Field technicians",
    body: "Electricians and technicians who want field work on modern energy systems.",
    includes: ["Electrical or electronics training or experience", "A Wireman or Supervisor certificate where the work needs one", "Reliable travel within your district"],
    link: { label: "Register as a technician", href: "#apply-technician" },
  },
  {
    icon: ClipboardCheck,
    title: "Survey associates",
    body: "People who survey sites and report what they find.",
    includes: ["Site survey experience, or the will to learn it", "A smartphone and basic measuring tools", "Safe work on a rooftop, or willingness to be trained"],
    link: { label: "Register as a survey associate", href: "#apply-survey" },
  },
];

const OFFER: Feature[] = [
  { icon: Handshake, title: "Suitable projects", body: "Solar, EV charging and battery projects, homes to industry, matched to what you have been verified to do." },
  { icon: Ruler, title: "Engineering support", body: "Our engineers help with design, specifications and site questions, before and during the job." },
  { icon: Package, title: "Equipment and procurement", body: "Help sourcing the equipment a project needs, to the specification we design." },
  { icon: ClipboardList, title: "Clear work orders", body: "A written scope, execution guidelines and a handover record for every project." },
  { icon: GraduationCap, title: "Training and technology", body: "Hands-on work with modern solar, battery, charging and monitoring systems, including the WayTara platform." },
  { icon: FileText, title: "Terms in writing", body: "Commercial terms are agreed for each project in writing, before the work starts." },
];

// The contractor grades: ESB, EA and ESA as the Tamil Nadu Electrical Inspectorate lists them, EB as the note in the Board's own EB form (printed in Tamil) states it.
const GRADES = [
  { grade: "EB", figure: "50 kW", text: "Works up to 50 kW, in low- and medium-voltage consumers' installations (the Board's EB form)." },
  { grade: "ESB", figure: "650 V", text: "Low-voltage installations up to 650 V." },
  { grade: "EA", figure: "33 kV", text: "Installations up to and including 33 kV." },
  { grade: "ESA", figure: "All", text: "Installations at every voltage, with no limit." },
];

const LICENCE_RULES = [
  { title: "One is for a business, one is for a person", body: "A contractor licence belongs to a business. A Wireman or Supervisor certificate belongs to a person. We ask for both." },
  { title: "Your grade sets your work", body: "A project goes to you only where your verified licence fits its voltage, load and work. A 415 V three-phase site is still low voltage." },
  { title: "We check, we do not assume", body: "Choosing a grade on a form proves nothing. We ask for the licence itself and check it with the Board before anything is approved." },
];

const WE_WILL = ["Charge nothing to apply or to join", "Read every application ourselves", "Check licences and certificates before we approve", "Share a project only where your verified scope fits it", "Agree the terms with you in writing"];
const WE_WILL_NOT = ["Promise projects or income", "Promise that applying means a partnership", "Offer a job, a salary or benefits", "Make you an approved vendor of any government scheme"];

const STEPS = [
  { title: "Apply", body: "A short form that takes a few minutes. No licences or documents yet.", tag: "You" },
  { title: "We call you", body: "Our partnerships team looks at your business, your area and your experience, and calls you.", tag: "Our team" },
  { title: "Onboarding invitation", body: "If you are shortlisted you get a personal, secure link to add your business details, licences, team and documents.", tag: "Shortlisted" },
  { title: "Verification", body: "We check your licences and certificates with the issuing authority, and your team, past work and capability.", tag: "Our team" },
  { title: "Partner agreement", body: "Approved partners sign a partner agreement. Projects are shared as verification, capability and availability allow.", tag: "Approved" },
];

const FORM_PARTS = [
  { title: "What you are applying as", body: "A contractor, a solar or EV charging team, a technician or a survey associate." },
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
    question: "Does it cost anything to apply or join?",
    answer: "No. We do not charge to apply or to join the network.",
  },
  {
    question: "What do I need to become a partner?",
    answer:
      "It depends on what you do. A contractor business needs a valid TNELB electrical contractor licence in its own name, with a supervisor and wiremen who hold their own competency certificates. Solar and EV charging teams need installations behind them and electrical work done by a licensed contractor. Technicians need relevant training or experience, and a competency certificate where the work needs one. Survey associates need survey experience or the will to learn it, a smartphone and basic measuring tools, and safe work on a rooftop. We ask for copies at onboarding and check them.",
  },
  {
    question: "Do I need a licence to apply?",
    answer:
      "Contractor businesses that hold a TNELB electrical contractor licence come first, and we ask which grade you hold. Electrical work on solar and EV charging projects must be done by appropriately qualified and authorised people, so we ask whether yours goes through a licensed contractor. A technician who does not hold a Wireman or Supervisor certificate is not turned away automatically: some assignments are supervised or do not need one.",
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
];

/** Quick links to the blog articles that go deeper. */
function BlogLinks({ heading }: { heading: string }) {
  return (
    <div>
      <p className="text-sm font-semibold text-theme-muted">{heading}</p>
      <ul className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
        {BLOG_LINKS.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="group inline-flex items-center gap-1.5 text-sm font-semibold text-theme-highlight underline-offset-4 hover:underline">
              {l.label}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The WayTara Partner Network (Tamil Nadu): who can join, what WayTara offers, where, how it works, the licences, the promise, and a short application. */
export function PartnerPage({ partners = [] }: { partners?: ListedPartner[] }) {
  return (
    <PageShell
      name="Partner with WayTara"
      path={PARTNER_PATH}
      faqs={PARTNER_FAQS}
      hero={
        <PageHero
          eyebrow="WayTara Partner Network · Tamil Nadu"
          title="Grow your energy business"
          accent="with WayTara."
          body="Work on solar, EV charging and battery projects with an engineering-led team. Join our network of contractors, installers and technicians across Tamil Nadu: project-based work, clear terms, modern energy systems."
          primary={{ label: "Apply to partner", href: "#apply" }}
          secondary={{ label: "How it works", href: "#how" }}
        />
      }
    >
      <SegmentSection id="who" badge="Who we work with" title="Built for people" accent="who do the work." summary="Pick the one that fits you. What each one takes is listed under it.">
        <FeatureColumns items={WHO} columns={3} />
      </SegmentSection>

      <SegmentSection id="offer" badge="What you get" title="What WayTara" accent="offers." summary="Work is project-based, and every project depends on verification, capability and availability.">
        <FeatureColumns items={OFFER} columns={3} />
      </SegmentSection>

      <SegmentSection id="where" badge="Where we welcome partners" title="Every district," accent="welcome." summary="We work with partners from all of Tamil Nadu, from the coast to the hills. Pick a region, or tap the map, to see its districts.">
        <Reveal direction="up" duration={800} distance={24}>
          <PartnerMap partners={partners} />
        </Reveal>
      </SegmentSection>

      <ProjectSteps id="how" badge="How it works" title="From application to" accent="partner." summary="Five steps, and only the first one needs anything from you today." steps={STEPS} />

      <SegmentSection id="licences" badge="Licences" title="Know your" accent="licence grade." summary="Electrical installation work in Tamil Nadu is regulated. This is how we read it, so you know what to expect from us.">
        <Reveal direction="up" duration={800} distance={24}>
          <ul className="grid grid-cols-2 gap-x-8 gap-y-12 lg:grid-cols-4">
            {GRADES.map((g) => (
              <li key={g.grade} className="border-t border-theme-border pt-5">
                <p className="text-sm font-semibold text-theme-muted">{g.grade}</p>
                <p className="mt-3 text-[clamp(1.75rem,3vw,2.75rem)] font-bold leading-none tracking-tight text-primary-gradient">{g.figure}</p>
                <p className="mt-4 text-sm leading-relaxed text-theme-secondary">{g.text}</p>
              </li>
            ))}
          </ul>
          <ol className="mt-16 grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-12">
            {LICENCE_RULES.map((r, i) => (
              <li key={r.title} className="flex gap-4">
                <span className="pt-0.5 text-sm font-semibold tabular-nums text-theme-highlight">{String(i + 1).padStart(2, "0")}</span>
                <span>
                  <span className="block text-base font-semibold text-theme-primary sm:text-lg">{r.title}</span>
                  <span className="mt-1.5 block text-[15px] leading-relaxed text-theme-secondary">{r.body}</span>
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-14 border-t border-theme-border pt-6 text-sm leading-relaxed text-theme-muted">
            The grades, their limits and the rules for Wireman and Supervisor certificates are set by the Tamil Nadu Electrical Licensing Board and can change. Check them with the Board at{" "}
            <a href="https://tnelb.gov.in" target="_blank" rel="noopener noreferrer" className="text-theme-highlight underline-offset-4 hover:underline">
              tnelb.gov.in
            </a>
            . Software, dashboards and gateway set-up are not electrical installation; wiring, panels, protection and earthing are.
          </p>
          <div className="mt-8">
            <BlogLinks heading="Read more on the blog" />
          </div>
        </Reveal>
      </SegmentSection>

      <SegmentSection id="promise" badge="Our promise" title="What we will do," accent="and what we will not." summary="So nobody joins on a wrong impression.">
        <Reveal direction="up" duration={800} distance={24}>
          <div className="grid grid-cols-1 gap-14 md:grid-cols-2 md:gap-20">
            {[
              { title: "We will", items: WE_WILL, icon: Check, mark: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
              { title: "We will not", items: WE_WILL_NOT, icon: X, mark: "bg-theme-surface text-theme-muted" },
            ].map(({ title, items, icon: Icon, mark }) => (
              <div key={title}>
                <h3 className="text-[clamp(1.5rem,2.4vw,2.1rem)] font-bold tracking-tight text-theme-primary">{title}</h3>
                <ul className="mt-6 divide-y divide-theme-border border-y border-theme-border">
                  {items.map((item) => (
                    <li key={item} className="flex items-center gap-4 py-4 text-[15px] text-theme-secondary sm:text-base">
                      <span className={`flex size-7 shrink-0 items-center justify-center rounded-full ${mark}`} aria-hidden="true">
                        <Icon className="size-4" />
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="mt-10 border-t border-theme-border pt-6 text-sm leading-relaxed text-theme-muted">
            The network is for people who do the work, not for referral agents, and never for anyone using another business&apos;s licence or certificate. Terms, rates and territory are not set on this page; they go in your written partner agreement, so ask for what you rely on in writing.
          </p>
        </Reveal>
      </SegmentSection>

      <SegmentSection id="apply" badge="Apply" title="Tell us about" accent="your work." summary="It takes a few minutes, and no documents are needed yet.">
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
          <div className="mt-12">
            <BlogLinks heading="Longer answers on the blog" />
          </div>
        </Reveal>
      </SegmentSection>
    </PageShell>
  );
}
