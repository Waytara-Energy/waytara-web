import { BatteryCharging, PlugZap, Sun, Wrench } from "lucide-react";
import { Reveal } from "@/components/shared/reveal";
import { FaqList, type Faq } from "@/components/segments/faq-list";
import { FeatureColumns, SegmentSection } from "@/components/segments/segment-parts";
import { ProjectSteps } from "@/components/sections/project-steps";
import { PageHero, PageShell } from "./page-shell";
import { PartnerForm } from "./partner-form";

export const PARTNER_PATH = "/partner";
export const PARTNER_DESCRIPTION =
  "Installers across India: tell WayTara about your company, the states you work in and what you install, and our team will get in touch.";

const MENU = [
  { id: "who", label: "Who we look for" },
  { id: "how", label: "How it works" },
  { id: "apply", label: "Apply" },
  { id: "faq", label: "FAQ" },
];

const WHO = [
  { icon: Sun, title: "Solar and storage installers", body: "You install rooftop or ground-mounted solar and battery storage for homes, buildings or industry." },
  { icon: PlugZap, title: "EV charger installers", body: "You install EV chargers for homes, workplaces, fleets or public charging sites, anywhere in India." },
  { icon: BatteryCharging, title: "Monitoring and integration", body: "You connect inverters, meters and chargers so customers can see and manage them in one place." },
  { icon: Wrench, title: "Operations and maintenance", body: "You keep installed systems running, from regular inspections to repairs when something goes wrong." },
];

const STEPS = [
  { title: "Tell us about your company", body: "Fill in the short form below: who you are, where you work and what you install." },
  { title: "We review it", body: "Our team reads every application and may ask you for more detail." },
  { title: "We talk", body: "If it looks like a fit, we call to understand your work and explain how we could work together." },
  { title: "Next steps", body: "Anything we agree is discussed with you directly. Terms differ from one installer to the next." },
];

const FORM_PARTS = [
  { title: "Your company", body: "Who you are and how to reach you." },
  { title: "What you do", body: "Installation, storage, chargers, monitoring or maintenance." },
  { title: "Where you work", body: "Search for your states and the places you cover." },
  { title: "Your experience", body: "Years in business, installations and team size." },
  { title: "Anything else", body: "Whatever else you would like us to know." },
];

export const PARTNER_FAQS: Faq[] = [
  {
    question: "What happens after I apply?",
    answer:
      "We e-mail you a confirmation, and our team reviews your application. If it looks like a fit we call you. We may ask for more information first, and applying does not guarantee a partnership.",
  },
  {
    question: "Which installers can apply?",
    answer: "Companies that install solar, battery storage or EV chargers, connect and monitor energy equipment, or maintain installed systems, anywhere in India.",
  },
  {
    question: "Can I apply for more than one state?",
    answer: "Yes. Choose every state you work in on the form, and add the cities or districts you cover if you like.",
  },
  {
    question: "Do I need to have WayTara equipment?",
    answer: "No. Tell us what you install and how, and we take it from there.",
  },
];

/** Partner with WayTara: a short page and an application form for installers across India. */
export function PartnerPage() {
  return (
    <PageShell
      name="Partner with WayTara"
      path={PARTNER_PATH}
      menu={MENU}
      faqs={PARTNER_FAQS}
      hero={
        <PageHero
          eyebrow="Partner with WayTara"
          title="Installers across India,"
          accent="work with WayTara."
          body="Tell us about your company, the states you work in and what you install. Our team reads every application and gets in touch."
          primary={{ label: "Apply to partner", href: "#apply" }}
        />
      }
    >
      <SegmentSection
        id="who"
        badge="Who we look for"
        title="Teams that do"
        accent="good installation work."
        summary="Whatever part of the energy system you work on, we would like to hear from you."
      >
        <FeatureColumns items={WHO} />
      </SegmentSection>

      <ProjectSteps id="how" badge="How it works" title="From application to" accent="a conversation." summary="No paperwork to start with." steps={STEPS} />

      <SegmentSection
        id="apply"
        badge="Apply"
        title="Tell us about"
        accent="your company."
        summary="It takes a few minutes."
      >
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
                  Applying does not guarantee a partnership. We use these details only to review your application and get in touch.
                </p>
              </div>
            </aside>
            <div className="relative lg:col-span-3">
              <PartnerForm />
            </div>
          </div>
        </Reveal>
      </SegmentSection>

      <SegmentSection id="faq" badge="FAQ" title="Questions from" accent="installers.">
        <Reveal direction="up" duration={700} distance={16}>
          <FaqList faqs={PARTNER_FAQS} />
        </Reveal>
      </SegmentSection>
    </PageShell>
  );
}
