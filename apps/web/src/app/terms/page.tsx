import Link from "next/link";
import { LegalPageLayout, type LegalSection } from "@/components/legal/legal-page-layout";
import { LegalCallout } from "@/components/legal/legal-callout";
import { LegalContact } from "@/components/legal/legal-contact";
import { LegalList, Strong } from "@/components/legal/legal-list";
import { LegalClauses } from "@/components/legal/legal-sub-list";
import { pageMetadata } from "@/lib/seo";

const LINK = "text-theme-highlight underline-offset-4 hover:underline";

const sections: LegalSection[] = [
  {
    id: "who",
    heading: "Who we are and what this covers",
    body: (n) => (
      <>
        <LegalClauses
          section={n}
          items={[
            "These Terms are between you and WayTara Energy LLP (“WayTara”, “we”, “us”), a limited liability partnership based in Chennai, India.",
            "They apply when you use our website, the energy planner, the WayTara dashboard and app, or any service we provide, and when you ask us for a quotation, accept one, or apply to become a partner.",
            "If you are acting for a business, you confirm you are allowed to accept these Terms for it.",
            "You must be at least 18 and able to enter a contract under Indian law. If you are not the owner of the property, you need the owner's permission for anything we do there.",
          ]}
        />
        <LegalCallout>
          <p>
            <Strong>A quotation you accept is the contract for your project.</Strong> These Terms sit around it. If a quotation says something different from these Terms about
            that project, the quotation applies.
          </p>
        </LegalCallout>
      </>
    ),
  },
  {
    id: "services",
    heading: "What WayTara provides",
    body: (n) => (
      <>
        <p>Depending on what you ask for and what your quotation lists, we provide some or all of the following:</p>
        <LegalClauses
          section={n}
          items={[
            "Design of a solar, battery, EV charging or combined system for a home, building or site, and a quotation for it.",
            "Supply and installation of the equipment listed on your quotation.",
            "The WayTara gateway and the WayTara dashboard and app, which show your devices, energy, alerts and reports, and let you control the devices that support it.",
            "Reports, including savings and carbon reports, and information about government subsidies and incentives.",
            "Support, through the dashboard, e-mail, phone and WhatsApp.",
            "A partner programme for installers, channel partners, consultants and others who want to work with us.",
            "The website and the energy planner, which give you an early idea of a system for your property.",
          ]}
        />
        <p>We only provide what is on your quotation, or what is described for a service when you sign up for it. Anything not listed there is not included.</p>
      </>
    ),
  },
  {
    id: "quotations",
    heading: "Quotations and what you pay",
    body: (n) => (
      <LegalClauses
        section={n}
        items={[
          "A quotation lists the equipment, the services, any optional items, the taxes and the total, and how long the quotation stays open. After that date it can change.",
          "You can accept it, ask for a change, or decline it, from the link we send to your e-mail. Asking for a change does not commit either of us. Only a quotation you have accepted is binding.",
          "You pay the amounts, in the stages and by the dates, set out in the accepted quotation or invoice. Taxes, including GST, are shown separately. The payment methods we accept are stated on the quotation or invoice.",
          "Anything that is not on the quotation is not in the price. If you ask for more, or the site turns out to need more than we could see before, we will tell you what it is and what it costs, and we will not do it or charge for it until you agree.",
          "If you pay late, we may pause work or services that depend on that payment, after telling you. We do not pause anything for a payment that is not yet due.",
          "Optional extras, such as extended warranty cover or additional devices on the dashboard, are priced on their own and are added only when you accept them in writing.",
        ]}
      />
    ),
  },
  {
    id: "installation",
    heading: "Installation and your site",
    body: (n) => (
      <LegalClauses
        section={n}
        items={[
          "We agree a date with you. We keep to it where we can, but weather, supply of equipment, permissions and site conditions can move it. We will tell you as soon as we know, and we are not responsible for a delay caused by something outside our control.",
          "You give our team safe access to the site and the roof, and the electricity, water and space we reasonably need. You tell us about anything we may not be able to see, such as hidden wiring, structural weakness or a leaking roof.",
          "Some work needs approval from the electricity board, a housing society, a landlord or another authority. We tell you which approvals are needed. Where your quotation says we handle an approval, we apply for it. The decision is the authority's, and we cannot promise it or its timing.",
        ]}
      />
    ),
  },
  {
    id: "estimates",
    heading: "Estimates, not guarantees",
    body: (n) => (
      <>
        <p>
          The planner, the blueprints, the quotations, the dashboard and the reports show figures such as how much your system may generate, how much you may save, how long it may
          take to pay back, how long a battery may keep things running and how much carbon may be avoided.
        </p>
        <LegalClauses
          section={n}
          items={[
            "These are estimates. They are based on what we know about your site, the equipment, typical weather, the tariff you tell us about, and the readings from your system. Real results depend on things neither of us controls, including sunshine, shade, how you use power, grid outages, tariff changes and how the equipment ages.",
            "We do not guarantee any of these figures, and we do not promise any saving, payback period, generation level or backup duration.",
            "Figures on the dashboard come from your devices and the information they send. If a device is offline or sends wrong readings, the figures can be missing or wrong.",
          ]}
        />
      </>
    ),
  },
  {
    id: "subsidies",
    heading: "Government subsidies and incentives",
    body: (n) => (
      <>
        <LegalClauses
          section={n}
          items={[
            "When we mention a subsidy, a scheme or a tax benefit, we are giving general information. Rules, amounts, who can apply and when money is paid are decided by the authority running the scheme, and they change.",
            "A subsidy is not a discount from WayTara. It is paid, if at all, by the authority. Unless your quotation says in writing that the price already takes a subsidy off, the price you pay us does not depend on whether a subsidy is approved or paid.",
            "We do not promise that you qualify, that your application will be approved, or when any money will reach you.",
            "Where your quotation includes help with a subsidy application, we prepare and submit the papers we are asked for, using the information and documents you give us. You are responsible for their being true and complete.",
            "Please check current rules with the authority before you decide. What we say is not legal, tax or financial advice.",
          ]}
        />
      </>
    ),
  },
  {
    id: "carbon",
    heading: "Carbon reports",
    body: (n) => (
      <LegalClauses
        section={n}
        items={[
          "A carbon report is an estimate of the emissions your system may have avoided, worked out from the energy it recorded and a published grid emission factor. The factor we use is stated in the report, and it can change when a new one is published.",
          "It is not a certified figure and it is not a carbon credit. WayTara does not sell, register or trade carbon credits through the report.",
          "If you need a verified figure for a regulator, an audit, a lender or a sustainability filing, tell us first. A certified figure needs an independent, accredited verifier, and we can say what we can and cannot supply for it.",
        ]}
      />
    ),
  },
  {
    id: "account",
    heading: "Your account and the dashboard",
    body: (n) => (
      <LegalClauses
        section={n}
        items={[
          "We create your dashboard account for you, or send you an invitation. You keep your sign-in details to yourself, and you are responsible for what is done with your account.",
          "Tell us straight away if you think someone else has used your account. We can lock an account to protect it.",
          "People you add to a site, such as family members or staff, can see and do what you give them access to. You are responsible for who you add.",
          "We may ask you to confirm who you are before we change an account, release data or act on a request.",
        ]}
      />
    ),
  },
  {
    id: "control",
    heading: "Controlling devices from the dashboard",
    body: (n) => (
      <LegalClauses
        section={n}
        items={[
          "Where your devices support it, you can change settings and start or stop things, such as an EV charge, from the dashboard. A command can take time to reach a device and can fail if the device is offline.",
          "You are responsible for the commands you give and the settings you change. Some settings can affect how the equipment behaves, how long it lasts and its warranty, so change them only if you understand them, or ask us first.",
          "We may limit or refuse a setting we think is unsafe, or one the manufacturer does not allow.",
          "The dashboard is not a safety system. Do not rely on it alone to protect people or property.",
        ]}
      />
    ),
  },
  {
    id: "support",
    heading: "Support",
    body: (n) => (
      <LegalClauses
        section={n}
        items={[
          <>
            You can reach us through a ticket in your dashboard, through the{" "}
            <Link href="/support" className={LINK}>
              Support page
            </Link>
            , by e-mail, by phone or on WhatsApp.
          </>,
          "We aim to reply promptly and to fix problems quickly, but we do not promise a reply time or a fix time unless your quotation or a support plan you have taken says so.",
          "Support covers the equipment and services we supplied. We may charge for work outside that, such as a repair that no warranty covers, but only after telling you the cost and getting your agreement.",
          <>
            What a warranty covers is set out in the{" "}
            <Link href="/warranty" className={LINK}>
              Warranty Policy
            </Link>
            .
          </>,
        ]}
      />
    ),
  },
  {
    id: "partners",
    heading: "The partner programme",
    body: (n) => (
      <LegalClauses
        section={n}
        items={[
          "Filling in the partner form is an application. It does not make you a partner, agent, employee or representative of WayTara, and it does not promise any work, leads, payment or exclusivity.",
          "We may accept, decline or hold an application, and we do not have to give a reason.",
          "A partnership exists only when we both sign a written agreement. That agreement sets the terms, and it applies in place of anything on this page that conflicts with it.",
          "Until then, do not describe yourself as a WayTara partner or use our name or logo as one.",
        ]}
      />
    ),
  },
  {
    id: "website",
    heading: "The website, the planner and blueprints",
    body: (n) => (
      <LegalClauses
        section={n}
        items={[
          "The planner and the blueprints it produces give you an early idea of a system. They are not a quotation, not a final design, and not an offer. A final design needs a site visit or the details we ask for.",
          "What you enter in a form is used to reply to you, as described in the Privacy Policy. Please give details that are true and complete, and an e-mail address you can read.",
          "Information on the website is general and can be out of date. A quotation or a written reply from us is what you rely on.",
        ]}
      />
    ),
  },
  {
    id: "third-parties",
    heading: "Other companies' equipment and services",
    body: (n) => (
      <LegalClauses
        section={n}
        items={[
          "Panels, inverters, batteries, chargers, meters and other equipment are made by other companies. Each carries its manufacturer's warranty, on its terms. See the Warranty Policy.",
          "We use other companies to run parts of the service, such as hosting, e-mail and maps. The Privacy Policy lists them by what they do.",
          "Other companies can change or stop their products. We are not responsible for what they do, but we will tell you if a change affects you and work with you on the next step.",
        ]}
      />
    ),
  },
  {
    id: "changes-to-service",
    heading: "Availability and changes to the service",
    body: (n) => (
      <LegalClauses
        section={n}
        items={[
          "We work to keep the dashboard and website running, but they may be interrupted for maintenance, by problems outside our control, or by a fault on your internet connection or on your site. We do not promise they will always be available or free of errors.",
          "We may improve, change or remove features. If we remove something you rely on and paid for, we will tell you and work out a fair outcome with you.",
        ]}
      />
    ),
  },
  {
    id: "use",
    heading: "How you may use the service",
    body: (
      <>
        <p>You agree not to:</p>
        <LegalList
          items={[
            "Use the service for anything unlawful, or to harm others.",
            "Try to get into another person's account, site or data, or into our systems.",
            "Interfere with the service, overload it, or use automated tools to copy it at scale.",
            "Copy, resell or reverse-engineer the dashboard, the gateway software or the website, except where the law allows it.",
            "Give us false information, or use our name, logo or the look of our service to mislead people.",
          ]}
        />
        <p>We may suspend an account that is used this way, after warning you where we can.</p>
      </>
    ),
  },
  {
    id: "ip",
    heading: "Ownership",
    body: (n) => (
      <LegalClauses
        section={n}
        items={[
          "The website, the dashboard, the gateway software, the designs, the reports and the WayTara name and logo belong to WayTara or to the companies that license them to us. You get the right to use them for the purpose they are provided for, and no more.",
          "Your data stays yours. You allow us to use it to provide and improve the service, as the Privacy Policy describes.",
          "The software that runs in the equipment, including the gateway, is licensed to you for use with that equipment. It is not sold to you.",
        ]}
      />
    ),
  },
  {
    id: "liability",
    heading: "Our responsibility to you",
    body: (n) => (
      <LegalClauses
        section={n}
        items={[
          "We do our work with reasonable skill and care, and we do what we say we will on your quotation.",
          "We are not responsible for a loss that we could not reasonably have foreseen, for lost profit, lost savings or lost business, or for a loss that comes from a result being different from an estimate.",
          "For anything else, our total responsibility for a claim is limited to the amount you paid us for the service the claim is about.",
          "None of this limits or excludes anything that the law does not allow to be limited or excluded, such as responsibility for death or personal injury caused by our negligence, or for fraud. It does not take away your rights under consumer protection law.",
          "We are not responsible if we cannot meet a promise because of something outside our reasonable control, such as a natural event, a power cut, a strike, an order of an authority or a failure of a public network.",
        ]}
      />
    ),
  },
  {
    id: "ending",
    heading: "Ending the relationship",
    body: (n) => (
      <LegalClauses
        section={n}
        items={[
          "You can stop using the website or the dashboard at any time. If you want your account closed, tell us.",
          "We may end or suspend your access if you break these Terms in a serious way, or do not pay what is due, after telling you why where we can.",
          "Ending does not cancel an amount already due, or any right that has already arisen. Parts that by their nature continue, such as ownership, responsibility and the governing law, continue.",
        ]}
      />
    ),
  },
  {
    id: "law",
    heading: "Governing law and disputes",
    body: (n) => (
      <LegalClauses
        section={n}
        items={[
          "These Terms are governed by the laws of India.",
          "If there is a problem, please write to us first, and we will try to settle it with you in good faith.",
          "If we cannot, the courts at Chennai have jurisdiction, without taking away any right you have to go to a court or forum where you live under consumer protection law.",
        ]}
      />
    ),
  },
  {
    id: "changes",
    heading: "Changes to these Terms",
    body: (n) => (
      <LegalClauses
        section={n}
        items={[
          "We may update these Terms. The date at the top shows the latest version. For a change that matters to you, we will give you at least 30 days' notice by e-mail or in the dashboard before it applies.",
          "A change does not alter a quotation you have already accepted. If you do not agree to a change, you can stop using the service before it applies.",
          "If a part of these Terms cannot be enforced, the rest still applies.",
        ]}
      />
    ),
  },
  {
    id: "contact",
    heading: "Contact",
    body: <LegalContact question="Questions about these Terms?" />,
  },
];

export const metadata = pageMetadata({
  title: "Terms of Service",
  description: "The terms for using WayTara's website, planner, dashboard and services, and for quotations, installation, subsidies, carbon reports, support and partners.",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <LegalPageLayout
      name="Terms of Service"
      path="/terms"
      title="Terms of"
      accent="Service."
      intro="The rules for using WayTara's website, planner, dashboard and services, written to be read before you decide."
      lastUpdated="6 November 2026"
      inShort={[
        "A quotation you accept is your contract. These Terms sit around it.",
        "Savings, generation, backup time and carbon figures are estimates, never guarantees.",
        "Subsidies come from the authorities, not from WayTara, and we cannot promise one will be approved.",
        "Equipment carries the manufacturer's warranty. WayTara adds none of its own unless you buy it as extended cover.",
        "Anything not on your quotation is not included, and nothing is added to what you pay without your agreement.",
      ]}
      sections={sections}
    />
  );
}
