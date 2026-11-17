import Link from "next/link";
import { LegalPageLayout, type LegalSection } from "@/components/legal/legal-page-layout";
import { LegalCallout } from "@/components/legal/legal-callout";
import { LegalContact } from "@/components/legal/legal-contact";
import { LegalList, Strong } from "@/components/legal/legal-list";
import { LegalClauses } from "@/components/legal/legal-sub-list";
import { SITE } from "@/lib/site";
import { pageMetadata } from "@/lib/seo";

const LINK = "text-theme-highlight underline-offset-4 hover:underline";

const sections: LegalSection[] = [
  {
    id: "who",
    heading: "Who this is for",
    body: (n) => (
      <>
        <LegalClauses
          section={n}
          items={[
            "WayTara Energy LLP (“WayTara”, “we”, “us”), based in Chennai, India, decides why and how your personal data is used. In the language of the Digital Personal Data Protection Act, 2023, we are the data fiduciary.",
            "This policy covers the website, the energy planner, the forms, the WayTara dashboard and app, support, and the partner programme.",
            "It says what we collect, why, who else sees it, how long we keep it, and what you can do about it.",
          ]}
        />
        <LegalCallout>
          <p>
            <Strong>We do not sell your personal data.</Strong> We do not use it for advertising, and we do not share it with advertisers or data brokers.
          </p>
        </LegalCallout>
      </>
    ),
  },
  {
    id: "collect",
    heading: "What we collect, and when",
    body: (
      <>
        <p>What we collect depends on what you do. Nothing here is collected unless you take the step beside it.</p>
        <LegalList
          items={[
            <>
              <Strong>Visiting the website:</Strong> technical information your browser sends, such as the pages you open, the type of browser and device, and the approximate area your connection comes from. We use it to keep the site working and to see how it is used. See the Cookie Policy.
            </>,
            <>
              <Strong>Using the energy planner:</Strong> the choices you make, such as the kind of property and what you want to power. If you send an enquiry, the contact details you type are added. We also count how far people get in the planner, without tying those counts to your name.
            </>,
            <>
              <Strong>Sending a form (contact, support, partner, planner enquiry):</Strong> your name, e-mail address, phone number where asked, your city and state, and what you write. E-mail is required in every form so that we can reply.
            </>,
            <>
              <Strong>Becoming a customer:</Strong> your address and site details, the quotation and what you accept, billing and payment records, and the documents needed for installation and, where you ask us, for subsidy applications.
            </>,
            <>
              <Strong>Using the dashboard:</Strong> your account details, the sites and devices linked to you, the readings those devices send (power, energy, battery level, charging sessions, faults), the alerts and reports made from them, the settings and commands you send, and the people you add to a site.
            </>,
            <>
              <Strong>Asking for support:</Strong> the ticket, your messages, any files or photos you attach, and any rating you give.
            </>,
            <>
              <Strong>Applying as a partner:</Strong> the business and contact details you give and the areas and work you list. If we take your application forward, we also ask for the documents and checks described under “Partners and the documents we collect” below.
            </>,
            <>
              <Strong>Signing in:</Strong> we may e-mail you a notice of a new sign-in that includes the approximate place and the device it came from, so you can tell us if it was not you.
            </>,
          ]}
        />
        <p>We do not ask for, and do not knowingly collect, card numbers, bank passwords or government ID numbers through the website.</p>
      </>
    ),
  },
  {
    id: "use",
    heading: "What we use it for",
    body: (n) => (
      <>
        <p>We use your data only for these reasons:</p>
        <LegalClauses
          section={n}
          items={[
            "To reply to you and to give you the quotation, plan, design or support you asked for.",
            "To supply, install, run and support your system, and to show you your own data, alerts and reports.",
            "To bill you, keep the records the law requires, and, where you ask, to prepare subsidy papers.",
            "To send you messages about your account, your project and your tickets, such as quotation links, appointment details, alerts and sign-in notices. These are not marketing.",
            "To keep the service secure, to find and fix faults, and to see how the website and planner are used so we can improve them.",
            "To review and answer partner applications.",
            "To meet our legal duties and to deal with a legal claim.",
          ]}
        />
        <p>We will ask you before we use your data for anything else, and we will not send you marketing unless you have said we may.</p>
      </>
    ),
  },
  {
    id: "basis",
    heading: "Why we are allowed to",
    body: (
      <p>
        We use your data where you have given it to us for a purpose and we use it for that purpose, where it is needed to carry out what you have asked us for, or where the law
        lets us, such as for tax and accounts records. Where we rely on your consent, you can withdraw it at any time, and the section on your rights says how.
      </p>
    ),
  },
  {
    id: "devices",
    heading: "Data from your devices",
    body: (n) => (
      <LegalClauses
        section={n}
        items={[
          "Your devices send readings to your dashboard through the WayTara gateway at your site. The readings belong to your site, and you and the people you have given access to can see them.",
          "WayTara staff can see them where they need to in order to install, support and repair your system. We do not look at your usage for any other purpose.",
          "We use readings to make your reports and alerts. If we use readings from many sites together to improve the service, we remove what identifies you or your site first.",
          "Readings sent while a system is being tested before handover are kept apart from your live history and are not part of your reports.",
        ]}
      />
    ),
  },
  {
    id: "partners",
    heading: "Partners and the documents we collect",
    body: (n) => (
      <>
        <LegalClauses
          section={n}
          items={[
            "The first partner form asks for no documents: only your name, phone, e-mail, district and a few answers about your work.",
            "If we take your application forward, after a call with you, we invite you to a private onboarding page and ask for what verification needs: your business name, address, GST registration and Udyam number if you have them, and the PAN; the bank account we would pay (the name on it, the account number and the IFSC); the contractor licence, and the certificates of your supervisor and wiremen; the people who would do the work and the districts you cover; and photographs or references from past projects.",
            "To prove who you are, you can verify with DigiLocker, the Government of India's document wallet. You agree on DigiLocker's own page, and you never type your Aadhaar number, your Aadhaar OTP or your DigiLocker password into anything of ours. We receive the name, date of birth, gender and address that DigiLocker states about you, and the last four digits of your Aadhaar number. That is all we keep from it. We do not receive or keep your full Aadhaar number, and we do not keep the photograph DigiLocker holds.",
            "If you do not use DigiLocker, or what it states does not match what you gave us, we ask for a photo ID instead: any government photo ID. For an Aadhaar copy, one with all but the last four digits hidden.",
            "We also ask for a live selfie. To check that the person in the selfie is the person we are verifying, we compare the face in it with your DigiLocker photograph or your photo ID, and check that the selfie shows a live face and not a picture of a picture. This is face comparison, so we want you to know about it: the selfie and the photograph are sent to our verification provider for the comparison. We keep the selfie in private storage, and the result of the check. We do not keep the DigiLocker photograph.",
            "We check the numbers you give us against the official sources, through our verification provider: your PAN, your GST number, your Udyam number and your bank account (the bank may show a very small test credit, and you do not need to do anything about it). It receives the number, and for a bank account also the IFSC and the name, and the names we ask it to compare. A check is evidence for our team, who decide. Nothing is approved or refused by a machine alone.",
            "People you list on your team are asked for the same through a private link you send them. You must have their agreement to give us their name and contact details.",
            "When you sign the partner agreement, we keep a record of it: the version, your name and e-mail address, the time, the network address you signed from, and a fingerprint of the exact text you were shown.",
          ]}
        />
        <LegalCallout>
          <p>
            <Strong>Your documents are used only to verify you.</Strong> They are kept in private storage, only the authorised staff who verify partners can open them, and we do not show them to customers or other
            partners, sell them, or use them for advertising. We share them with no one outside WayTara, except where a law, a court or a government authority requires it.
          </p>
        </LegalCallout>
        <LegalClauses
          section={n}
          items={[
            "Checking a licence or certificate number with the board that issued it is part of verification.",
            "If you ask us to list you in the public partner directory, the page shows your business name, the kind of partner and your districts, and nothing else. You can ask us to remove the listing at any time.",
            "You can ask to see the documents we hold about you, to correct them, or to have them deleted, as the section on your rights explains.",
          ]}
        />
      </>
    ),
  },
  {
    id: "share",
    heading: "Who else sees your data",
    body: (n) => (
      <>
        <p>We share your data with a small number of companies that help us run the service. Each one gets only what it needs for its job:</p>
        <LegalList
          items={[
            <>
              <Strong>Database, sign-in and file storage provider:</Strong> holds your account, your site data and the files you attach.
            </>,
            <>
              <Strong>Verification provider (Cashfree Payments India Private Limited):</Strong> for partners, checks PAN, GST, Udyam and bank account numbers, compares names and faces, and connects you to DigiLocker when you choose it. It receives only what each check needs, as described under “Partners and the documents we collect”.
            </>,
            <>
              <Strong>DigiLocker (Government of India):</Strong> when you choose to verify with it, you share your details with us on its own page, under its own terms.
            </>,
            <>
              <Strong>E-mail delivery provider:</Strong> delivers the messages we send you, which means it sees your e-mail address and the message.
            </>,
            <>
              <Strong>Hosting provider:</Strong> serves the website and the dashboard.
            </>,
            <>
              <Strong>Error-reporting provider:</Strong> receives technical details of a fault, such as the page and the browser. We do not intend to send personal data to it.
            </>,
            <>
              <Strong>Page-view and speed measurement provider:</Strong> counts visits and page speed, without cookies and without a profile of you.
            </>,
            <>
              <Strong>Map providers:</Strong> show maps and look up an address you type. Your browser contacts them directly when a map is on the page.
            </>,
            <>
              <Strong>WhatsApp:</Strong> if you choose to message us there, WhatsApp handles the conversation under its own policy.
            </>,
          ]}
        />
        <LegalClauses
          section={n}
          items={[
            "We also share data with the WayTara team working on your project, with your installer where one is involved, and with the authority a subsidy application goes to, where you have asked us to make it.",
            "We share data where a law, a court or a government authority requires it, and where it is needed to protect people or to deal with a legal claim.",
            "These companies work for us under their terms. They are not allowed to use your data for their own purposes, other than as their own policies describe for the measurement and map services above.",
            "If WayTara is ever sold or merged, your data would pass to the new owner, who must keep to this policy.",
          ]}
        />
      </>
    ),
  },
  {
    id: "where",
    heading: "Where your data is kept",
    body: (
      <p>
        The companies above run their systems in data centres that can be in India or in other countries. When your data is stored or handled outside India, we rely on the law allowing
        it and on the protections that our providers give. If you want to know where your data is held, ask us and we will tell you.
      </p>
    ),
  },
  {
    id: "keep",
    heading: "How long we keep it",
    body: (n) => (
      <LegalClauses
        section={n}
        items={[
          "We keep your data for as long as we need it for what it was collected for, and for as long as the law requires us to keep it, such as tax and accounts records.",
          "Enquiries and partner applications that do not lead to anything are kept only for as long as we need them to reply and to deal with follow-up questions. The documents of a partner who is not approved are kept only for as long as the review and any follow-up need them, and you can ask us to delete them sooner.",
          "The details DigiLocker gave us, your selfie and the results of the checks are kept with your partner application. For an approved partner, that is for as long as the partnership lasts and for as long as the law or a claim needs them afterwards. When an application is deleted, all of it is deleted with it.",
          "Device readings and reports are kept for as long as your site is on the service, so that your history is there when you need it.",
          "When we no longer need data, we delete it or make it so that it can no longer identify you. If you want to know how long a particular kind of data is kept, ask us.",
        ]}
      />
    ),
  },
  {
    id: "security",
    heading: "How we protect it",
    body: (n) => (
      <LegalClauses
        section={n}
        items={[
          "Data travels between you and us in encrypted form. Access to it inside our systems is restricted by role, so a customer, a site engineer and a WayTara administrator each see only what they need to.",
          "Your password is never stored in readable form.",
          "No system is completely safe. If a breach affects your data, we will tell you and the authorities as the law requires.",
        ]}
      />
    ),
  },
  {
    id: "rights",
    heading: "Your rights",
    body: (n) => (
      <>
        <p>Under Indian law you may:</p>
        <LegalClauses
          section={n}
          items={[
            "Ask for a summary of the personal data we hold about you and what we do with it, and who we have shared it with.",
            "Ask us to correct data that is wrong or incomplete, and to update it.",
            "Ask us to erase your data, unless the law needs us to keep it.",
            "Withdraw a consent you have given.",
            "Name someone to act for you if you cannot, and complain to us, and, if we do not settle it, to the Data Protection Board of India.",
          ]}
        />
        <p>
          Write to us at{" "}
          <a href={`mailto:${SITE.email}`} className={LINK}>
            {SITE.email}
          </a>
          . We may ask you to confirm who you are first. We reply as soon as we can. We cannot erase something we are legally required to keep, and we will say so when that is the case.
        </p>
      </>
    ),
  },
  {
    id: "children",
    heading: "Children",
    body: <p>Our services are for adults. We do not knowingly collect data about anyone under 18. If you think we have, tell us and we will remove it.</p>,
  },
  {
    id: "cookies",
    heading: "Cookies",
    body: (
      <p>
        What we store in your browser, and why, is listed in the{" "}
        <Link href="/cookies" className={LINK}>
          Cookie Policy
        </Link>
        .
      </p>
    ),
  },
  {
    id: "changes",
    heading: "Changes to this policy",
    body: (
      <p>
        If we change this policy, the date at the top changes. For a change that matters to you, we will tell you by e-mail or in the dashboard before it applies. We will not use
        data we already hold for a new purpose without asking you first.
      </p>
    ),
  },
  {
    id: "contact",
    heading: "Contact and complaints",
    body: <LegalContact question="Questions, requests or a complaint about your data?" />,
  },
];

export const metadata = pageMetadata({
  title: "Privacy Policy",
  description: "What WayTara collects, why, who else sees it, how long it is kept and what you can do about it.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <LegalPageLayout
      name="Privacy Policy"
      path="/privacy"
      title="Privacy"
      accent="Policy."
      intro="What we collect, why, who else sees it, how long we keep it and what you can do about it."
      lastUpdated="17 November 2026"
      inShort={[
        "We collect only what you give us or what your devices send, and we use it for the reason you gave it.",
        "We do not sell your personal data, and we do not use it for advertising.",
        "Partner documents are used only to verify the partner, kept private, and never shown to customers or other partners. We never see or keep a full Aadhaar number, and a partner's selfie is compared with their DigiLocker photo or photo ID by our verification provider.",
        "A few companies help us run the service, such as for database, e-mail, hosting and maps. Each gets only what it needs.",
        "You can ask to see, correct or erase your data, and withdraw consent, by writing to us.",
      ]}
      sections={sections}
    />
  );
}
