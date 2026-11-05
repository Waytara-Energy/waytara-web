import { Mail, MapPin, Phone } from "lucide-react";
import { OurTeam } from "@/components/sections/our-team";
import { Reveal } from "@/components/shared/reveal";
import { OFFERS } from "@/data/offers";
import { SITE } from "@/lib/site";
import { EnquiryRoutes, FeatureColumns, SegmentSection } from "@/components/segments/segment-parts";
import { PageHero, PageShell } from "./page-shell";

export const ABOUT_PATH = "/about";
export const ABOUT_DESCRIPTION =
  "WayTara designs and installs solar, battery storage and EV charging, builds the software and gateway that connect them, and supports the system afterwards. Based in Mylapore, Chennai.";

const MENU = [
  { id: "who", label: "Who we are" },
  { id: "our-team", label: "Vision & team" },
  { id: "where", label: "Where we are" },
  { id: "enquire", label: "Get in touch" },
];

/** About Us: who we are, the vision and the team (the existing Our Team section, moved here), and where to find us. */
export function AboutPage() {
  return (
    <PageShell
      name="About Us"
      path={ABOUT_PATH}
      menu={MENU}
      hero={
        <PageHero
          eyebrow="About WayTara"
          title="Engineers building"
          accent="one connected energy system."
          body="WayTara designs and installs solar, battery storage and EV charging, builds the software and gateway that connect them, and supports the system afterwards. We are based in Mylapore, Chennai."
          primary={{ label: "Plan my system", href: "/planner" }}
          secondary={{ label: "Why WayTara", href: "/why-waytara" }}
        />
      }
    >
      <SegmentSection
        id="who"
        badge="Who we are"
        title="Three things,"
        accent="done as one."
        summary="Solar, storage and EV charging are usually sold as separate products. We build and connect them together, and you can start with any one of the three."
      >
        <FeatureColumns items={OFFERS.map(({ icon, title, blockBody }) => ({ icon, title, body: blockBody }))} />
      </SegmentSection>

      {/* The vision, mission and goal, and the people behind WayTara (moved here from the landing page) */}
      <OurTeam />

      <SegmentSection
        id="where"
        badge="Where we are"
        title="Visit us in"
        accent="Mylapore, Chennai."
        summary="Talk to us about a project, or about connecting equipment you already have."
      >
        <Reveal direction="up" duration={800} distance={24}>
          <div className="grid grid-cols-1 gap-8 rounded-2xl border border-theme-border bg-theme-surface px-7 py-8 sm:px-10 lg:grid-cols-5 lg:gap-12">
            <div className="lg:col-span-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-theme-muted">Office</p>
              <a
                href="https://maps.app.goo.gl/uDAuNfJjh5uXBpZa9"
                target="_blank"
                rel="noreferrer"
                className="mt-3 flex items-start gap-3 text-base leading-relaxed text-theme-primary underline-offset-4 hover:underline"
              >
                <MapPin className="mt-1 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                <span>
                  {SITE.address.streetAddress}, {SITE.address.addressLocality}, {SITE.address.addressRegion} {SITE.address.postalCode}
                </span>
              </a>
            </div>
            <div className="space-y-3 lg:col-span-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-theme-muted">Contact</p>
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
      </SegmentSection>

      <EnquiryRoutes
        heading="Let's talk about"
        accent="your energy system."
        newRoute={{ label: "Plan a new system", href: "/planner", hint: "Solar, battery storage and EV charging, designed around your property." }}
        existingRoute={{ label: "Contact us", href: "/contact", hint: "Ask us anything, or tell us about equipment you already have." }}
      />
    </PageShell>
  );
}
