import Link from "next/link";
import { LegalPageLayout, type LegalSection } from "@/components/legal/legal-page-layout";
import { LegalCallout } from "@/components/legal/legal-callout";
import { LegalContact } from "@/components/legal/legal-contact";
import { LegalList, Strong } from "@/components/legal/legal-list";
import { LegalClauses } from "@/components/legal/legal-sub-list";
import { pageMetadata } from "@/lib/seo";

const sections: LegalSection[] = [
  {
    id: "overview",
    heading: "What this policy is",
    body: (
      <>
        <p>
          This policy explains who stands behind the equipment at your site, and what WayTara does and does not promise about it. It is written to be read before you pay, so
          that nothing in it comes as a surprise afterwards.
        </p>
        <LegalCallout>
          <p>
            <Strong>WayTara does not give any warranty of its own on top of the manufacturer&apos;s.</Strong> The equipment we supply carries the manufacturer&apos;s warranty, on the
            manufacturer&apos;s terms. If you want more cover than that, we can offer it as a paid extension, in writing, with its own price. That is the only way WayTara gives a
            warranty of its own.
          </p>
        </LegalCallout>
      </>
    ),
  },
  {
    id: "manufacturer",
    heading: "The manufacturer's warranty",
    body: (n) => (
      <LegalClauses
        section={n}
        items={[
          "Solar panels, inverters, batteries, EV chargers, meters and the other equipment we supply each come with the warranty that its manufacturer gives. The manufacturer decides how long it lasts, what it covers and how a claim is made.",
          "We show the manufacturer, the model and the warranty period on your quotation or in the handover papers wherever the manufacturer has given them to us. If a manufacturer's own document says something different from our summary, the manufacturer's document is the one that applies.",
          "The manufacturer's warranty is a promise between you and the manufacturer. It does not become a WayTara warranty because we supplied or installed the equipment.",
          "Keep the warranty cards, serial numbers and the invoice we give you. Many manufacturers ask for them before they accept a claim.",
        ]}
      />
    ),
  },
  {
    id: "no-extra",
    heading: "What WayTara does not promise",
    body: (
      <>
        <p>Unless you have accepted paid extended cover (see the next section), WayTara does not give:</p>
        <LegalList
          items={[
            <>
              <Strong>Any warranty of its own on equipment.</Strong> That means panels, inverters, batteries, chargers, meters and cabling made by others.
            </>,
            <>
              <Strong>Any separate warranty on installation work.</Strong> We install with reasonable skill and care, and nothing in this policy removes the rights the law gives you about the quality of a service. But we do not add a warranty period of our own.
            </>,
            <>
              <Strong>Any promise about results:</Strong> how much your system will generate, how much you will save, how quickly it pays back, how long a battery will keep things running, or how much carbon it avoids. These are estimates (see the Terms of Service), not guarantees.
            </>,
            <>
              <Strong>Any promise about the manufacturer.</Strong> We cannot decide a manufacturer&apos;s claim for them, and we are not responsible if a manufacturer changes its terms, closes, or refuses a claim.
            </>,
          ]}
        />
        <p>
          The WayTara gateway is the one product WayTara makes itself. If your quotation states a warranty for it, that warranty applies, on the terms stated there. If your quotation
          states none, no warranty is given for it beyond what the law requires.
        </p>
      </>
    ),
  },
  {
    id: "extended",
    heading: "Extended cover you can buy",
    body: (n) => (
      <>
        <p>We can offer extra cover for chosen equipment, for a longer period, or for installation work. It is optional, and it works like this:</p>
        <LegalClauses
          section={n}
          items={[
            "It has a price of its own, shown separately from the price of the equipment. It is not included in your quotation unless it appears there as its own line with its own price.",
            "It exists only when it is written down in an extended-cover document, you have accepted that document, and you have paid for it. Until then, section 3 applies.",
            "The document states exactly what is covered (which equipment, which parts), for how long and from what date, how to claim, any limit on the amount or the number of claims, and what is excluded. Only what it says applies.",
            "Extended cover is WayTara's own commitment, on its own terms. It does not lengthen or change the manufacturer's warranty, and the manufacturer is not bound by it.",
            "Asking for a price for extended cover does not commit you or us. Nothing is added to what you pay without your acceptance.",
          ]}
        />
      </>
    ),
  },
  {
    id: "claims",
    heading: "If something goes wrong",
    body: (
      <>
        <p>
          Raise a ticket from your dashboard (or tell us through the{" "}
          <Link href="/support" className="text-theme-highlight underline-offset-4 hover:underline">
            Support page
          </Link>{" "}
          if you cannot sign in). Say which device it is, what you saw and when, and attach photos if you can. What happens next depends on whose warranty applies:
        </p>
        <LegalList
          items={[
            <>
              <Strong>Manufacturer&apos;s warranty:</Strong> we help you identify the right manufacturer process and get your claim to them. We cannot decide the claim, and we cannot promise how or when it will be settled. The manufacturer&apos;s decision stands.
            </>,
            <>
              <Strong>Extended cover:</Strong> follow the claim steps in your extended-cover document. Quote its reference in your ticket.
            </>,
            <>
              <Strong>Neither:</Strong> we will tell you plainly that no warranty applies, and, if you want the problem fixed, we can quote for the repair. Nothing is repaired at a charge without your agreement first.
            </>,
          ]}
        />
      </>
    ),
  },
  {
    id: "exclusions",
    heading: "What manufacturers usually do not cover",
    body: (
      <>
        <p>Each manufacturer has its own list, and its list is the one that counts. As a guide, these are commonly left out, and our extended cover leaves them out unless its document says otherwise:</p>
        <LegalList
          items={[
            "Damage from accidents, fire, flood, lightning, storms or other natural events, and from pests",
            "Repairs, changes or additions made by anyone the manufacturer has not approved",
            "Normal wear, and the gradual drop in output that the manufacturer says to expect",
            "Faults caused by the electricity grid, surges, or conditions outside the equipment itself",
            "Misuse, neglect, or leaving out the maintenance the manufacturer asks for",
            "Equipment moved from where it was installed, or with a removed or changed serial number",
          ]}
        />
      </>
    ),
  },
  {
    id: "software",
    heading: "The dashboard and reports",
    body: (
      <p>
        The WayTara dashboard, the gateway&apos;s software, alerts and reports are services, not equipment, and they are governed by the{" "}
        <Link href="/terms" className="text-theme-highlight underline-offset-4 hover:underline">
          Terms of Service
        </Link>
        , not by a warranty. We work to keep them running but do not promise they will always be available or error free, and figures in reports are estimates.
      </p>
    ),
  },
  {
    id: "your-rights",
    heading: "Your rights under the law",
    body: (
      <p>
        Nothing in this policy takes away any right you have under consumer protection law or any other law that cannot be set aside by agreement. If the law gives you more than this
        policy does, the law applies.
      </p>
    ),
  },
  {
    id: "which-applies",
    heading: "Which document applies",
    body: (n) => (
      <LegalClauses
        section={n}
        items={[
          "For the manufacturer's warranty: the manufacturer's own warranty document.",
          "For extended cover: the extended-cover document you accepted.",
          "For everything else about what we supply and what you pay: your accepted quotation and our Terms of Service.",
          "This policy explains how those fit together. If it appears to conflict with a document you accepted in writing, the document you accepted applies.",
        ]}
      />
    ),
  },
  {
    id: "contact",
    heading: "Contact",
    body: <LegalContact question="Questions about warranty, or want a price for extended cover?" />,
  },
];

export const metadata = pageMetadata({
  title: "Warranty Policy",
  description: "WayTara's warranty policy: equipment carries the manufacturer's warranty, WayTara adds none of its own, and extended cover is available at a price, in writing.",
  path: "/warranty",
});

export default function WarrantyPage() {
  return (
    <LegalPageLayout
      name="Warranty Policy"
      path="/warranty"
      title="Warranty"
      accent="Policy."
      intro="Who stands behind the equipment at your site, and what WayTara does and does not promise about it."
      lastUpdated="6 November 2026"
      inShort={[
        "Your equipment carries the manufacturer's own warranty, on the manufacturer's terms.",
        "WayTara does not give any warranty of its own on top of it.",
        "If you want extra cover, we can offer it as a paid extension. It exists only when it is written down, priced and accepted by you.",
        "We say plainly what is and is not covered before you pay.",
      ]}
      sections={sections}
    />
  );
}
