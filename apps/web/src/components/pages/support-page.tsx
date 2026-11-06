import { Activity, CreditCard, EvCharger, KeyRound, LifeBuoy, Mail, MapPin, Phone, Sun, Ticket, Wifi, Wrench } from "lucide-react";
import { Reveal } from "@/components/shared/reveal";
import { FaqList, type Faq } from "@/components/segments/faq-list";
import { FeatureColumns, SegmentSection } from "@/components/segments/segment-parts";
import { ProjectSteps } from "@/components/sections/project-steps";
import { SITE } from "@/lib/site";
import { PageHero, PageShell } from "./page-shell";
import { SupportForm } from "./support-form";

export const SUPPORT_PATH = "/support";
export const SUPPORT_DESCRIPTION =
  "Every way to get help from WayTara: raise a ticket in your dashboard, call or e-mail the team, tell us if you cannot sign in, or ask before you become a customer.";

const HOURS = "Monday to Saturday, 8 AM to 8 PM IST";

// The ways to reach the team: each ends with a person.
const WAYS = [
  {
    icon: Ticket,
    title: "Raise a ticket",
    body: "The best way for anything about your account or devices. Pick your site, attach photos, and follow the whole conversation in one place.",
    link: { label: "Open Support in my dashboard", href: "/dashboard/support" },
  },
  {
    icon: Phone,
    title: "Call us",
    body: `${SITE.phone} or +91 93848 00141, ${HOURS}. Ask for support and have your site name ready.`,
    link: { label: `Call ${SITE.phone}`, href: "tel:9363021195" },
  },
  {
    icon: Mail,
    title: "E-mail us",
    body: "For a question that does not need a ticket, write to us and say which site it is about. We reply by e-mail.",
    link: { label: SITE.email, href: `mailto:${SITE.email}` },
  },
  {
    icon: KeyRound,
    title: "Cannot sign in?",
    body: "You do not need an account to reach us. Tell us what is wrong and how to reach you, and the team will get back to you.",
    link: { label: "Tell us what is wrong", href: "#contact" },
  },
  {
    icon: MapPin,
    title: "Visit our office",
    body: "WayTara Energy LLP, 3rd floor, Dr. Radhakrishnan Salai, Mylapore, Chennai. Call first so someone is there for you.",
    link: { label: "See the map", href: "/contact#visit" },
  },
  {
    icon: Sun,
    title: "Not a customer yet?",
    body: "Thinking about solar, storage or EV charging, or about connecting equipment you already have? Plan it, or ask us.",
    link: { label: "Plan my system", href: "/planner" },
  },
];

// The usual problems, each with the first thing to try.
const TOPICS = [
  {
    icon: KeyRound,
    title: "Sign-in and account",
    body: "Forgot your password? Choose Forgot password on the sign-in page and enter the code we e-mail you. No invitation yet? Check your spam folder.",
    link: { label: "Reset my password", href: "/forgot-password" },
  },
  {
    icon: Wifi,
    title: "A device shows offline",
    body: "Check the device has power and the site's internet works, then wait a few minutes. Still offline? Raise a ticket and name the device.",
    link: { label: "Raise a ticket", href: "/dashboard/support" },
  },
  {
    icon: Activity,
    title: "Readings or reports look wrong",
    body: "Raise a ticket with the device, the time and a screenshot. We can check what the device has been sending and what the report used.",
    link: { label: "Raise a ticket", href: "/dashboard/support" },
  },
  {
    icon: EvCharger,
    title: "A charger will not charge",
    body: "Check it shows online in your dashboard, then try Reset or Unlock on the charger's page where it is offered. Still stuck? Raise a ticket.",
    link: { label: "Raise a ticket", href: "/dashboard/support" },
  },
  {
    icon: CreditCard,
    title: "Billing and invoices",
    body: "Your plan, payments and GST invoices are on the Billing page of your dashboard. For a question about a charge, raise a ticket with the date and amount.",
    link: { label: "Raise a ticket", href: "/dashboard/support" },
  },
  {
    icon: Wrench,
    title: "Installation questions",
    body: "Something not finished, or a question about work at your site? Raise a ticket, choose Installation as the topic and tell us which site.",
    link: { label: "Raise a ticket", href: "/dashboard/support" },
  },
];

const TICKET_STEPS = [
  { title: "You raise it", body: "Choose your site, say what is wrong, and attach up to five files, such as photos, a PDF or a short video." },
  { title: "We confirm", body: "You get an e-mail that we have it, and the team of your site is told straight away." },
  { title: "Someone takes it", body: "You are told who is handling it. It can be handed to a colleague, and every reply reaches you by e-mail." },
  { title: "Resolved, then rated", body: "When it is sorted you can close it, or reopen it if it is not, and rate the help you got." },
];

export const SUPPORT_FAQS: Faq[] = [
  {
    question: "How do I reach someone quickly?",
    answer: `Call ${SITE.phone} or +91 93848 00141 (${HOURS}), or e-mail ${SITE.email}. For anything about your account or devices, a ticket in your dashboard keeps the whole conversation in one place.`,
  },
  {
    question: "Who sees my ticket?",
    answer: "The team of your site: the site's installer engineer, its employees and WayTara's administrators. You see only your own tickets, and you can add files to any message.",
  },
  {
    question: "Can I attach photos or files?",
    answer: "Yes, up to five in one message, each up to 10 MB: pictures, PDF, text, Word, Excel and short videos. A photo of the device or a screenshot of what you see helps most.",
  },
  {
    question: "I forgot my password. What do I do?",
    answer:
      "On the sign-in page choose Forgot password, enter your e-mail, and we send a code to that address. Enter the code, then choose a new password. If no code arrives, check your spam folder, wait a minute, and ask for another.",
  },
  {
    question: "My two-factor code is not accepted.",
    answer:
      "Codes from an authenticator app change every 30 seconds, so enter the one showing now, and make sure your phone's clock is set automatically. If you have lost the phone, tell us using the form on this page. We will help, and we will need to confirm who you are first.",
  },
  {
    question: "I do not have an account yet.",
    answer:
      "WayTara sets up your account when your system is installed or your equipment is connected, and sends an invitation to your e-mail. If you were expecting one and it has not come, tell us using the form on this page.",
  },
  {
    question: "A device shows offline. Is something broken?",
    answer:
      "Not necessarily. A device can look offline when its power or the site's internet connection is interrupted. Check both, wait a few minutes, and if it stays offline raise a ticket and name the device.",
  },
  {
    question: "I am not a customer yet. Who do I ask?",
    answer: "Use the Contact page, or plan a system with the Energy Planner and send us the blueprint. Either way a person from the team gets back to you.",
  },
  {
    question: "How long will a reply take?",
    answer: "We reply as soon as we can. On a ticket you get an e-mail each time someone from the team replies, and you can rate the help when it is closed.",
  },
];

/** Support: every way to get help, whether signed in, locked out, or not yet a customer. */
export function SupportPage() {
  return (
    <PageShell
      name="Support"
      path={SUPPORT_PATH}
      faqs={SUPPORT_FAQS}
      hero={
        <PageHero
          eyebrow="Support"
          title="How can we"
          accent="help today?"
          body="Raise a ticket, call, write, or tell us you are locked out. Pick the way that suits you: every one of them ends with a person from the team."
          primary={{ label: "Open Support in my dashboard", href: "/dashboard/support" }}
          secondary={{ label: "I can't sign in", href: "#contact" }}
        />
      }
    >
      <SegmentSection id="ways" badge="Ways to reach us" title="Choose the way" accent="that suits you." summary="Signed in, locked out, or not a customer yet: there is a route for each.">
        <FeatureColumns items={WAYS} />
      </SegmentSection>

      <SegmentSection id="topics" badge="Common problems" title="Find your" accent="problem." summary="A first thing to try for each, and then the way to ask us if it is not enough.">
        <FeatureColumns items={TOPICS} />
      </SegmentSection>

      <ProjectSteps id="ticket" badge="How a ticket works" title="From your message" accent="to a resolved ticket." summary="You are kept informed at every step." steps={TICKET_STEPS} />

      <SegmentSection id="contact" badge="Cannot sign in?" title="Tell us" accent="what is wrong." summary="No account needed. Say what is happening and how to reach you, and the team will get back to you.">
        <div className="grid grid-cols-1 gap-14 lg:grid-cols-5 lg:gap-16">
          <Reveal direction="up" duration={800} distance={24} className="relative lg:col-span-3">
            <SupportForm />
          </Reveal>
          <Reveal direction="up" duration={800} distance={24} delay={100} className="lg:col-span-2">
            <div className="lg:sticky lg:top-32">
              <p className="text-sm font-semibold text-theme-muted">Prefer to talk?</p>
              <ul className="mt-5 space-y-5">
                <li>
                  <a href="tel:9363021195" className="group flex items-start gap-4">
                    <Phone className="mt-1 size-6 shrink-0 stroke-[1.4] text-theme-primary" aria-hidden="true" />
                    <span>
                      <span className="block text-base font-semibold text-theme-primary group-hover:text-theme-highlight">{SITE.phone}</span>
                      <span className="mt-0.5 block text-sm text-theme-secondary">or +91 93848 00141</span>
                    </span>
                  </a>
                </li>
                <li>
                  <a href={`mailto:${SITE.email}`} className="group flex items-start gap-4">
                    <Mail className="mt-1 size-6 shrink-0 stroke-[1.4] text-theme-primary" aria-hidden="true" />
                    <span className="text-base font-semibold text-theme-primary group-hover:text-theme-highlight">{SITE.email}</span>
                  </a>
                </li>
                <li className="flex items-start gap-4">
                  <LifeBuoy className="mt-1 size-6 shrink-0 stroke-[1.4] text-theme-primary" aria-hidden="true" />
                  <span>
                    <span className="block text-base font-semibold text-theme-primary">Monday to Saturday</span>
                    <span className="mt-0.5 block text-sm text-theme-secondary">8:00 AM to 8:00 PM IST</span>
                  </span>
                </li>
              </ul>
              <p className="mt-10 border-t border-theme-border pt-6 text-sm leading-relaxed text-theme-muted">
                Never send your password or a sign-in code, in this form or to anyone. We will never ask for them.
              </p>
            </div>
          </Reveal>
        </div>
      </SegmentSection>

      <SegmentSection id="faq" badge="FAQ" title="Common questions," accent="answered.">
        <Reveal direction="up" duration={700} distance={16}>
          <FaqList faqs={SUPPORT_FAQS} />
        </Reveal>
      </SegmentSection>
    </PageShell>
  );
}
