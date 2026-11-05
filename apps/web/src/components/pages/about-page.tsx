import { OurTeam } from "@/components/sections/our-team";
import { Reveal } from "@/components/shared/reveal";
import { OFFERS } from "@/data/offers";
import { EnquiryRoutes, FeatureColumns, SegmentSection } from "@/components/segments/segment-parts";
import { OfficeMap } from "./office-map";
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
        summary="Our office is in the ASE Structure Design building on Dr. Radhakrishnan Salai. Talk to us about a project, or about connecting equipment you already have."
      >
        <Reveal direction="up" duration={800} distance={24}>
          <OfficeMap />
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
