import { Activity, CreditCard, KeyRound, LifeBuoy, Mail, Phone, ShieldCheck, SlidersHorizontal, UserPlus, Wifi } from "lucide-react";
import { Reveal } from "@/components/shared/reveal";
import { FaqList, type Faq } from "@/components/segments/faq-list";
import { FeatureColumns, InfoBand, SegmentSection } from "@/components/segments/segment-parts";
import { SITE } from "@/lib/site";
import { PageHero, PageShell } from "./page-shell";
import { SupportForm } from "./support-form";

export const SUPPORT_PATH = "/support";
export const SUPPORT_DESCRIPTION =
  "Help for WayTara customers: sign-in problems, devices that look offline, billing questions, and how to raise a support ticket or reach the team.";

const MENU = [
  { id: "sign-in", label: "Sign-in problems" },
  { id: "devices", label: "Devices" },
  { id: "billing", label: "Billing" },
  { id: "ticket", label: "Raise a ticket" },
  { id: "contact", label: "Tell us" },
  { id: "faq", label: "FAQ" },
];

const SIGN_IN = [
  {
    icon: KeyRound,
    title: "Forgot your password",
    body: "On the sign-in page, choose Forgot password. We e-mail you a code, then you choose a new password.",
  },
  {
    icon: ShieldCheck,
    title: "Two-factor code",
    body: "Enter the 6-digit code from your authenticator app. It changes every 30 seconds, so use the one showing now.",
  },
  {
    icon: UserPlus,
    title: "No account yet",
    body: "We set up your account when your system is installed. Look for our invitation e-mail, and check spam.",
  },
];

const DEVICES = [
  {
    icon: Wifi,
    title: "A device shows offline",
    body: "Check the device has power and the site's internet works. Wait a few minutes. Still offline? Raise a ticket.",
  },
  {
    icon: Activity,
    title: "Readings look wrong or are missing",
    body: "Raise a ticket with the device, the time and a screenshot. We can check what the device has been sending.",
  },
  {
    icon: SlidersHorizontal,
    title: "Changing a setting",
    body: "Settings you can change are on the Devices page. Each change is checked by reading it back from the equipment. For anything else, ask us.",
  },
];

const BILLING = [
  { icon: CreditCard, title: "Your plan and payments", body: "Your plan, payments and invoices are on the Billing page of your dashboard." },
  { icon: LifeBuoy, title: "A question about a charge", body: "Raise a ticket and choose Billing as the topic. Tell us the date and amount and we will look into it." },
  { icon: Mail, title: "Something else about your account", body: "Raise a ticket, or use the form below if you cannot sign in, and say what you need." },
];

export const SUPPORT_FAQS: Faq[] = [
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
    question: "How do I reach someone quickly?",
    answer: `Call ${SITE.phone} or +91 93848 00141, or e-mail ${SITE.email}. For anything about your account or devices, a ticket in your dashboard keeps the whole conversation in one place.`,
  },
  {
    question: "How long will a reply take?",
    answer: "We reply as soon as we can. On a ticket you get an e-mail each time someone from the team replies, and you can rate the help when it is closed.",
  },
];

/** Support: how customers get help, including when they cannot sign in. */
export function SupportPage() {
  return (
    <PageShell
      name="Support"
      path={SUPPORT_PATH}
      menu={MENU}
      faqs={SUPPORT_FAQS}
      hero={
        <PageHero
          eyebrow="Support"
          title="We are here"
          accent="when something goes wrong."
          body="Locked out, a device showing offline, a question about a bill: find the fastest way to get it sorted. Signed-in customers can raise a ticket. If you cannot sign in, tell us below."
          primary={{ label: "Open Support in my dashboard", href: "/dashboard/support" }}
          secondary={{ label: "I can't sign in", href: "#contact" }}
        />
      }
    >
      <SegmentSection id="sign-in" badge="Sign-in problems" title="Back into" accent="your account." summary="The usual reasons people get locked out, and what to do about each.">
        <FeatureColumns items={SIGN_IN} />
        <Reveal direction="up" duration={700} distance={16}>
          <p className="mt-6 text-sm text-theme-secondary">
            Ready to try again?{" "}
            <a href="/forgot-password" className="font-semibold text-theme-highlight underline-offset-4 hover:underline">
              Reset my password
            </a>{" "}
            or{" "}
            <a href="/login" className="font-semibold text-theme-highlight underline-offset-4 hover:underline">
              go to sign in
            </a>
            .
          </p>
        </Reveal>
      </SegmentSection>

      <SegmentSection id="devices" badge="Devices and monitoring" title="A device or a reading" accent="looks wrong." summary="Start here before raising a ticket: it is often something simple.">
        <FeatureColumns items={DEVICES} />
      </SegmentSection>

      <SegmentSection id="billing" badge="Billing and plans" title="Payments," accent="plans and invoices." summary="Where to find them, and who to ask.">
        <FeatureColumns items={BILLING} />
      </SegmentSection>

      <div id="ticket" className="scroll-mt-28 pt-4" />
      <InfoBand
        kicker="From your dashboard"
        title="Raise a ticket and keep the whole conversation in one place."
        body="Choose the site, say what is wrong, and attach photos or files. You get an e-mail each time someone from the team replies, and you can rate the help when it is closed."
        cta={{ label: "Open Support in my dashboard", href: "/dashboard/support" }}
      />

      <SegmentSection id="contact" badge="Cannot sign in?" title="Tell us" accent="what is wrong." summary="No account needed. Tell us how to reach you and what is happening, and the team will get back to you.">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-5 lg:gap-12">
          <Reveal direction="up" duration={800} distance={24} className="relative lg:col-span-3">
            <SupportForm />
          </Reveal>
          <Reveal direction="up" duration={800} distance={24} delay={100} className="lg:col-span-2">
            <div className="rounded-2xl border border-theme-border bg-theme-surface p-6 sm:p-7">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-theme-muted">Or reach us directly</p>
              <div className="mt-4 space-y-3">
                <a href="tel:9363021195" className="flex items-center gap-3 text-sm text-theme-primary underline-offset-4 hover:underline">
                  <Phone className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                  +91 93630 21195
                </a>
                <a href="tel:9384800141" className="flex items-center gap-3 text-sm text-theme-primary underline-offset-4 hover:underline">
                  <Phone className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                  +91 93848 00141
                </a>
                <a href={`mailto:${SITE.email}`} className="flex items-center gap-3 text-sm text-theme-primary underline-offset-4 hover:underline">
                  <Mail className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                  {SITE.email}
                </a>
              </div>
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
