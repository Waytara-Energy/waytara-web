import { BadgeIndianRupee, Home, PlugZap, ReceiptText, type LucideIcon } from "lucide-react";
import { Reveal } from "@/components/shared/reveal";
import { EnquiryRoutes, FeatureColumns, SegmentSection } from "@/components/segments/segment-parts";
import { GUIDES } from "@/data/guides";
import { PageHero, PageShell } from "./page-shell";

/** The four guides, in reading order: what it is, which type, what help there is, and what it does to the bill. */
const ORDER: { slug: string; icon: LucideIcon; body: string }[] = [
  { slug: "solar-for-home", icon: Home, body: "What a home system is made of, how big yours needs to be, and the steps from enquiry to switch-on." },
  { slug: "on-grid-hybrid-off-grid-solar", icon: PlugZap, body: "With a battery, without one, or with no grid at all: what each does in a power cut, and how to choose." },
  { slug: "solar-subsidy", icon: BadgeIndianRupee, body: "The central PM Surya Ghar subsidy, who can apply, the steps, and what net metering means for you." },
  { slug: "reduce-electricity-bill-solar", icon: ReceiptText, body: "How solar, net metering and a battery lower a bill, and who saves the most." },
];

/** The page that lists the guides: one block for each, in the same look as the other pages' blocks. */
export function GuidesHub() {
  return (
    <PageShell
      name="Guides"
      path="/guides"
      hero={
        <PageHero
          eyebrow="Guides"
          title="Solar, batteries and bills,"
          accent="explained simply."
          body="Straight answers to the questions people ask before they start: what size, which type, what help is available, and what it does to the bill."
          primary={{ label: "Plan my system", href: "/planner" }}
          secondary={{ label: "Talk to us", href: "/contact" }}
        />
      }
    >
      <SegmentSection id="guides" badge="The guides" title="Pick the question" accent="you have." summary="Each guide answers in the first two sentences, then gives the detail, a short FAQ and where to go next.">
        <Reveal direction="up" duration={700} distance={16}>
          <FeatureColumns
            items={ORDER.map(({ slug, icon, body }) => ({
              icon,
              title: GUIDES[slug].name,
              body,
              link: { label: "Read the guide", href: GUIDES[slug].path },
            }))}
          />
        </Reveal>
      </SegmentSection>

      <EnquiryRoutes
        heading="Ready to look at"
        accent="your own roof?"
        newRoute={{ label: "Plan my system", href: "/planner", hint: "Tell us about your property and get a first blueprint in a few minutes." }}
        existingRoute={{ label: "Talk to an engineer", href: "/contact", hint: "Ask about your own roof, bills or equipment. There is no commitment either way." }}
      />
    </PageShell>
  );
}
