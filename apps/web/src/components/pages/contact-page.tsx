import { Clock, Mail, MessageCircle, Phone } from "lucide-react";
import { Reveal } from "@/components/shared/reveal";
import { SegmentSection } from "@/components/segments/segment-parts";
import { SITE } from "@/lib/site";
import { ContactForm } from "./contact-form";
import { OfficeMap } from "./office-map";
import { PageHero, PageShell } from "./page-shell";

export const CONTACT_PATH = "/contact";

const NEXT = [
  { title: "We read your message", body: "An engineer reads what you wrote, not a form-letter desk." },
  { title: "We get in touch", body: "We call or e-mail you to understand your property and what you want from it." },
  { title: "You decide", body: "We suggest what makes sense for you, and you choose the next step." },
];

/** Contact: a short guided form with the direct lines beside it, and the office on a map. */
export function ContactPage() {
  return (
    <PageShell
      name="Contact"
      path={CONTACT_PATH}
      hero={
        <PageHero
          eyebrow="Contact WayTara"
          title="Tell us about"
          accent="your property."
          body="Solar, battery backup, EV charging, or equipment you already have. Our engineers read every message and get back to you by phone or e-mail."
          primary={{ label: "Send a message", href: "#write" }}
          secondary={{ label: `Call ${SITE.phone}`, href: SITE.phoneHref }}
        />
      }
    >
      <SegmentSection id="write" badge="Write to us" title="A few details," accent="then we will call." summary="It takes about two minutes.">
        <div className="grid grid-cols-1 gap-14 lg:grid-cols-5 lg:gap-16">
          <Reveal direction="up" duration={800} distance={24} className="lg:col-span-3">
            <ContactForm />
          </Reveal>

          <Reveal direction="up" duration={800} distance={24} delay={100} className="lg:col-span-2">
            <div className="lg:sticky lg:top-32">
              <p className="text-sm font-semibold text-theme-muted">Prefer to talk?</p>
              <ul className="mt-5 space-y-5">
                <li>
                  <a href={SITE.phoneHref} className="group flex items-start gap-4">
                    <Phone className="mt-1 size-6 shrink-0 stroke-[1.4] text-theme-primary" aria-hidden="true" />
                    <span>
                      <span className="block text-base font-semibold text-theme-primary group-hover:text-theme-highlight">{SITE.phone}</span>
                      <span className="mt-0.5 block text-sm text-theme-secondary">Call us directly</span>
                    </span>
                  </a>
                </li>
                <li>
                  <a href={SITE.whatsapp} target="_blank" rel="noreferrer" className="group flex items-start gap-4">
                    <MessageCircle className="mt-1 size-6 shrink-0 stroke-[1.4] text-theme-primary" aria-hidden="true" />
                    <span>
                      <span className="block text-base font-semibold text-theme-primary group-hover:text-theme-highlight">{SITE.whatsappPhone}</span>
                      <span className="mt-0.5 block text-sm text-theme-secondary">Chat on WhatsApp</span>
                    </span>
                  </a>
                </li>
                <li>
                  <a href={SITE.instagram} target="_blank" rel="noreferrer" className="group flex items-start gap-4">
                    <svg className="mt-1 size-6 shrink-0 fill-none stroke-current stroke-[1.4] text-theme-primary" viewBox="0 0 24 24" aria-hidden="true">
                      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
                      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
                    </svg>
                    <span>
                      <span className="block text-base font-semibold text-theme-primary group-hover:text-theme-highlight">{SITE.instagramHandle}</span>
                      <span className="mt-0.5 block text-sm text-theme-secondary">Follow us on Instagram</span>
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
                  <Clock className="mt-1 size-6 shrink-0 stroke-[1.4] text-theme-primary" aria-hidden="true" />
                  <span>
                    <span className="block text-base font-semibold text-theme-primary">Monday to Saturday</span>
                    <span className="mt-0.5 block text-sm text-theme-secondary">8:00 AM to 8:00 PM IST</span>
                  </span>
                </li>
              </ul>

              <p className="mt-12 text-sm font-semibold text-theme-muted">What happens next</p>
              <ol className="mt-5 space-y-5">
                {NEXT.map((step, i) => (
                  <li key={step.title} className="flex gap-4">
                    <span className="pt-0.5 text-sm font-semibold tabular-nums text-theme-highlight">{String(i + 1).padStart(2, "0")}</span>
                    <span>
                      <span className="block text-base font-semibold text-theme-primary">{step.title}</span>
                      <span className="mt-0.5 block text-sm leading-relaxed text-theme-secondary">{step.body}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </Reveal>
        </div>
      </SegmentSection>

      <SegmentSection id="visit" badge="Visit us" title="Our office in" accent="Mylapore, Chennai.">
        <Reveal direction="up" duration={800} distance={24}>
          <OfficeMap />
        </Reveal>
      </SegmentSection>
    </PageShell>
  );
}
