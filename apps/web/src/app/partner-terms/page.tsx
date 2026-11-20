import { LegalPageLayout, type LegalSection } from "@/components/legal/legal-page-layout";
import { LegalContact } from "@/components/legal/legal-contact";
import { LegalClauses } from "@/components/legal/legal-sub-list";
import { pageMetadata } from "@/lib/seo";

const sections: LegalSection[] = [
  {
    id: "who",
    heading: "Who this is for",
    body: (n) => (
      <LegalClauses
        section={n}
        items={[
          "These Partner Terms are between you and WayTara Energy LLP (“WayTara”, “we”, “us”), based in Chennai, India. They apply when you apply to the WayTara Partner Network as an electrical contractor, a solar installation team, an EV charging team, a field technician or a survey associate.",
          "They sit beside our Terms of Service and our Privacy Policy. Where this page and the Terms of Service differ on partners, this page applies.",
        ]}
      />
    ),
  },
  {
    id: "applying",
    heading: "Applying",
    body: (n) => (
      <LegalClauses
        section={n}
        items={[
          "Filling in the partner form is an application. It does not make you a partner, agent, employee or representative of WayTara, and it does not promise any work, leads, payment, territory or exclusivity.",
          "We do not charge to apply or to join the network.",
          "What you tell us must be true and complete. We may check it, including with the authority that issued a licence or certificate.",
          "We may accept, decline or hold an application, and we do not have to give a reason.",
        ]}
      />
    ),
  },
  {
    id: "verification",
    heading: "Verification and documents",
    body: (n) => (
      <LegalClauses
        section={n}
        items={[
          "The first form asks for no documents. If we take your application forward, after a call with you, we invite you by a personal link to give your business details, licences, certificates, bank account, team and past work.",
          "We check what you give us. We ask for the licence or certificate itself, with its number and validity, because choosing a grade on a form is not proof.",
          "You can prove who you are by verifying with DigiLocker, the Government of India's document wallet. You agree on DigiLocker's own page, and you never give us your Aadhaar number, your Aadhaar OTP or your DigiLocker password. We keep only the name, date of birth, gender and address it states and the last four digits of your Aadhaar number, never the full number or the photograph. If DigiLocker verifies you and the name matches the one you gave, we do not need a photo ID from you.",
          "If you do not use DigiLocker, or it does not match, you send a photo ID instead: any government photo ID, and for an Aadhaar copy one with all but the last four digits hidden. We never ask you to type or send a full Aadhaar number.",
          "We also ask for a live selfie, and we compare its face with your DigiLocker photograph or your photo ID and check that it shows a live face. We check your PAN, GST number, Udyam number and bank account against the official sources. For this we use a verification provider, and the numbers, names and photographs needed for each check are sent to it. A check is evidence for our team, and our team decides.",
          "The same applies to each person you list on your team, through a private link you send them. You must have their agreement before you give us their details.",
          "Approval covers only the scope of work we have verified. It does not authorise every electrical or installation activity.",
          "You must send us a new document when one expires or changes, and tell us at once if a licence or certificate lapses or is suspended.",
        ]}
      />
    ),
  },
  {
    id: "licences",
    heading: "Licences, safety and the law",
    body: (n) => (
      <LegalClauses
        section={n}
        items={[
          "You must hold, and keep valid, every licence, certificate and registration the work you do requires. Electrical installation work must be done by appropriately licensed and qualified people, under the supervision the rules require.",
          "You may not use another person's or business's licence or certificate as your own. A team without its own contractor licence may work with a licensed contractor who really carries out and signs for the electrical work.",
          "You must follow the electrical safety rules and good practice that apply to the work, and keep the test and inspection records the work needs.",
          "You must not do work outside the scope we have approved.",
        ]}
      />
    ),
  },
  {
    id: "work",
    heading: "Projects and work orders",
    body: (n) => (
      <LegalClauses
        section={n}
        items={[
          "We share a project with a partner only where the verified scope, capability and availability fit it. We do not promise a minimum number of projects, any income, or exclusive work in any area.",
          "Each project is carried out under a written work order that sets the scope, specification, schedule and payment. Terms, rates and territory are not set on our website. They are in your written partner agreement and work orders, so ask for what you rely on in writing.",
          "You must not change the inverter, cables, protection devices, charger model or any other critical equipment on a project without our written approval, and you must not hand work on to another team without it.",
        ]}
      />
    ),
  },
  {
    id: "independent",
    heading: "Not employment",
    body: (n) => (
      <LegalClauses
        section={n}
        items={[
          "The Partner Network is a commercial partnership, not a job. You work as an independent business or individual, not as an employee, agent or representative of WayTara.",
          "You are responsible for your own team, tax and GST, insurance, and every legal duty that comes with employing people and doing the work.",
        ]}
      />
    ),
  },
  {
    id: "customers",
    heading: "Customers and their information",
    body: (n) => (
      <LegalClauses
        section={n}
        items={[
          "You will see customer and site details only for the projects you are given. Keep them confidential, use them only for that project, and do not share them.",
          "You must not approach a customer you meet through a WayTara project to sell them something outside the agreed terms.",
        ]}
      />
    ),
  },
  {
    id: "name",
    heading: "Our name and the directory",
    body: (n) => (
      <LegalClauses
        section={n}
        items={[
          "Until a written partner agreement is signed, do not describe yourself as a WayTara partner or use our name or logo as one. After that, use them only as the agreement allows.",
          "We list a partner in the public directory on our partner page only with that partner's agreement. The directory shows the business name, the kind of partner and the districts, and nothing else. You can ask us to remove the listing at any time.",
        ]}
      />
    ),
  },
  {
    id: "agreement",
    heading: "The partner agreement",
    body: (n) => (
      <LegalClauses
        section={n}
        items={[
          "A partnership exists only when we both sign a written partner agreement, before any work starts. That agreement sets the full terms, and it applies in place of anything on this page that conflicts with it.",
        ]}
      />
    ),
  },
  {
    id: "data",
    heading: "Your information and documents",
    body: (n) => (
      <LegalClauses
        section={n}
        items={[
          "How we handle what you give us, including documents, DigiLocker details, selfies and the results of checks, is set out in our Privacy Policy. In short: documents are kept private, only the authorised staff who verify partners can open them, and we do not show them to customers or other partners, or share them with anyone outside WayTara, except where the law requires it.",
          "You can ask to see, correct or delete your information, as the Privacy Policy explains.",
        ]}
      />
    ),
  },
  {
    id: "ending",
    heading: "Ending",
    body: (n) => (
      <LegalClauses
        section={n}
        items={[
          "You can withdraw an application, or leave the network, at any time by telling us.",
          "We may decline, suspend or end a partnership, with or without notice where safety or the law is at stake, if what you told us proves false, a licence or certificate lapses or is withdrawn, or you break these terms or the agreement.",
          "Ending does not cancel an amount already due, or a duty on a project already under way. Parts that by their nature continue, such as confidentiality, continue.",
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
          "These Partner Terms are governed by the laws of India.",
          "If there is a problem, please write to us first, and we will try to settle it with you in good faith. If we cannot, the courts at Chennai have jurisdiction.",
        ]}
      />
    ),
  },
  {
    id: "changes",
    heading: "Changes to these Partner Terms",
    body: (n) => (
      <LegalClauses
        section={n}
        items={[
          "We may update these Partner Terms. The date at the top shows the latest version. For a change that matters to you, we will give you reasonable notice by e-mail before it applies to your partnership.",
          "If a part of these Partner Terms cannot be enforced, the rest still applies.",
        ]}
      />
    ),
  },
  {
    id: "contact",
    heading: "Contact",
    body: <LegalContact question="Questions about these Partner Terms?" />,
  },
];

export const metadata = pageMetadata({
  title: "Partner Terms",
  description: "The terms for applying to the WayTara Partner Network: verification, documents, licences and safety, work orders, customer information and the agreement.",
  path: "/partner-terms",
});

export default function PartnerTermsPage() {
  return (
    <LegalPageLayout
      name="Partner Terms"
      path="/partner-terms"
      title="Partner"
      accent="Terms."
      intro="What you and WayTara agree to when you apply to the Partner Network, written to be read before you apply."
      lastUpdated="17 November 2026"
      inShort={[
        "Applying is free, and it is not a job and not a promise of work, income or territory.",
        "We ask for documents only if we take your application forward, and we check licences, certificates and numbers with the official sources.",
        "You can verify with DigiLocker instead of sending a photo ID. We never see or keep a full Aadhaar number, and we compare your selfie with your DigiLocker photo or photo ID. Documents stay private and are not shared, except where the law requires it.",
        "You must hold the licences the work needs, and you cannot use someone else's.",
        "A partnership exists only when we sign a written partner agreement, before any work.",
      ]}
      sections={sections}
    />
  );
}
