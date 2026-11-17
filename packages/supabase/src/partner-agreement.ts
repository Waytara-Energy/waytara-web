// The WayTara Partner Agreement a partner reads and accepts at the end of onboarding, with its indemnity and confidentiality clauses. Pure text, no framework and no
// database, shared by the website (which shows it and records the acceptance) and the admin app (which shows what was accepted).
//
// THIS IS A DRAFT written to be reviewed by WayTara's own lawyer before anyone is asked to rely on it. While AGREEMENT_IS_DRAFT is true the page says so in words next to
// the text. When the lawyer has approved a final text: put it here, change AGREEMENT_VERSION (a new version makes every partner who has not yet submitted accept it again),
// and set AGREEMENT_IS_DRAFT to false. The version and a hash of the exact text are stored with every acceptance.

export const AGREEMENT_VERSION = "2026-11-17-draft-1";
export const AGREEMENT_IS_DRAFT = true;
export const AGREEMENT_TITLE = "WayTara Energy Partner Agreement, Indemnity and Confidentiality";

export interface AgreementSection {
  heading: string;
  clauses: string[];
}

const SCOPE: Record<string, string> = {
  contractor: "electrical installation and related contracting work that WayTara offers to its customers, carried out under your electrical contractor licence",
  solar: "the supply, installation, testing and commissioning of solar and hybrid power systems that WayTara offers to its customers",
  ev: "the supply, installation, testing, commissioning and maintenance of electric vehicle charging equipment that WayTara offers to its customers",
  technician: "field work as an individual technician on projects that WayTara offers to its customers",
  survey: "site surveys, measurements and assessments for projects that WayTara offers to its customers",
};

/** The agreement as a list of numbered sections, with the scope sentence of the partner's kind. */
export function agreementSections(partnerType: string | null): AgreementSection[] {
  const scope = SCOPE[partnerType ?? ""] ?? "the work that WayTara offers to its customers";
  return [
    {
      heading: "Parties and purpose",
      clauses: [
        "This agreement is between WayTara Energy LLP, Chennai, India (“WayTara”) and the person or business that accepted it (“the Partner”), named in the record of acceptance.",
        `Under it WayTara may offer the Partner ${scope}. It sets out the rules that apply to every such piece of work. The details of each job (the site, the scope, the price and the dates) are in a work order WayTara sends for that job.`,
        "WayTara does not promise any amount of work, any area or any exclusivity. The Partner is free to decline a work order.",
      ],
    },
    {
      heading: "Independent relationship",
      clauses: [
        "The Partner works as an independent business or professional. Nothing in this agreement makes the Partner or the Partner’s people employees, agents or partners of WayTara, and the Partner cannot bind WayTara.",
        "The Partner decides how the work is done, subject to the safety, quality and legal requirements in this agreement and in the work order, and is responsible for its own tools, transport and people.",
      ],
    },
    {
      heading: "Licences, qualifications and the law",
      clauses: [
        "The Partner holds, and will keep valid, every licence, certificate, permit and registration that its work requires, including the electrical contractor licence and the competency certificates of the supervisor and workers where electrical work is done.",
        "The Partner will not use another person’s or business’s licence or certificate as its own. Where the Partner works through a licensed contractor, that contractor really carries out and signs for the electrical work.",
        "The Partner will tell WayTara at once if a licence or certificate lapses, is suspended or is cancelled, and will not do work that needs it until it is valid again.",
        "The Partner will obey all laws that apply to its work and its people, including the laws on contract labour, provident fund, state insurance, minimum wages, taxes and the safety of workers.",
      ],
    },
    {
      heading: "Safety",
      clauses: [
        "The Partner will follow the electrical safety regulations that apply in India, the standards of the electricity distribution company for the site, the manufacturers’ instructions, and good practice for work at height and with electricity.",
        "Everyone at a site wears the personal protective equipment the work needs. The Partner stops work that cannot be done safely, and tells WayTara and the customer.",
        "The Partner reports any accident, injury, near miss or damage at a site to WayTara within 24 hours, and keeps the test and inspection records the work needs.",
      ],
    },
    {
      heading: "Quality and conduct at the customer’s site",
      clauses: [
        "The Partner does the work with reasonable skill and care, with new and genuine materials that meet the work order, and finishes it as the work order says.",
        "The Partner’s people behave respectfully at customers’ homes and premises, carry their identity when asked, and leave the site clean and safe.",
        "The Partner will correct, at its own cost and within a reasonable time, work that does not meet the work order or the law.",
      ],
    },
    {
      heading: "The Partner’s people and sub-contractors",
      clauses: [
        "The Partner is responsible for everyone it sends to a site, whether employed or hired. It has checked their identity and qualifications, and has their agreement to give WayTara the documents WayTara asks for.",
        "The Partner will not use a sub-contractor on a WayTara job without WayTara’s written agreement, and stays responsible for the sub-contractor’s work.",
      ],
    },
    {
      heading: "Fees and payment",
      clauses: [
        "WayTara pays the Partner the price in the work order, after the work is completed and accepted, within the period in the work order.",
        "The Partner sends a valid tax invoice (with its GST number where it is registered). WayTara deducts the tax the law requires from payments, and the Partner gives the PAN and bank details needed for that.",
        "WayTara may hold back payment for work that has not been put right, and may set off amounts the Partner owes WayTara under this agreement.",
      ],
    },
    {
      heading: "Insurance",
      clauses: [
        "The Partner keeps the insurance the law requires for its workers (employees’ compensation, and provident fund and state insurance where they apply) and, where the work order asks, liability cover for the work.",
      ],
    },
    {
      heading: "Indemnity",
      clauses: [
        "The Partner will compensate WayTara for loss, damage, claims, penalties and reasonable costs (including legal costs) that arise from the Partner’s or its people’s negligence, breach of this agreement or of the law, unlicensed work, false documents or statements, or injury to any person or damage to any property caused by the Partner’s work.",
        "WayTara will tell the Partner promptly of any claim, will let the Partner help to deal with it, and will take reasonable steps to limit the loss.",
      ],
    },
    {
      heading: "Confidentiality",
      clauses: [
        "The Partner keeps confidential everything it learns through WayTara that is not public: customers’ names, addresses, contact details and energy data, prices, designs, systems and WayTara’s business. It uses them only for the work and does not share them.",
        "This does not cover what the Partner already knew, what becomes public through no fault of the Partner, or what the law makes the Partner disclose (in which case it tells WayTara first where it can). The duty lasts for three years after this agreement ends, and for as long as customer personal data is held.",
      ],
    },
    {
      heading: "Personal data",
      clauses: [
        "The Partner uses customers’ personal data only for the work, keeps it safe, does not copy it to personal accounts or social media, and deletes it when it is no longer needed. WayTara’s Privacy Policy explains how WayTara uses the documents and details the Partner gives it.",
      ],
    },
    {
      heading: "Name and materials",
      clauses: [
        "The Partner may say it is a WayTara partner only while this agreement is in force and only as WayTara allows. WayTara’s names, marks, designs and documents stay WayTara’s. Photographs a Partner takes of its WayTara jobs may be used by WayTara, with customers’ faces, names and addresses left out.",
      ],
    },
    {
      heading: "Term and ending",
      clauses: [
        "This agreement starts when WayTara approves the Partner and continues until either side ends it by 30 days’ written notice (e-mail is enough). WayTara may end it at once if the Partner breaks the law or this agreement, loses a licence, gives false information, or puts anyone’s safety at risk.",
        "Work orders already accepted are finished or ended as the work order says. Confidentiality, indemnity, payment and the clauses on liability and disputes continue after the end.",
      ],
    },
    {
      heading: "Limits of liability",
      clauses: [
        "Neither side is liable to the other for indirect or consequential loss, or for loss of profit, except where the law does not allow it to be excluded. Nothing here limits liability for death or personal injury caused by negligence, for fraud, or for the Partner’s duty to indemnify under this agreement for claims by third parties.",
      ],
    },
    {
      heading: "Law and disputes",
      clauses: [
        "The laws of India apply. The two sides will try first to settle a dispute by talking. If that does not work within 30 days, the courts at Chennai, Tamil Nadu have the sole jurisdiction.",
      ],
    },
    {
      heading: "General",
      clauses: [
        "This agreement, WayTara’s Partner Terms and each work order are the whole agreement between the two sides on this subject. If they differ, the work order applies for that job, then this agreement, then the Partner Terms.",
        "WayTara may change this agreement for future work by giving the Partner notice; a change does not affect work orders already accepted. A clause found invalid does not affect the others.",
        "The Partner accepts this agreement electronically, with a code sent to the e-mail address WayTara confirmed with it. WayTara keeps the record of that acceptance: the version, the time, the address it came from, and a fingerprint of this exact text.",
      ],
    },
  ];
}

/** The agreement as plain text, numbered; what the fingerprint stored with an acceptance is made from. */
export function agreementText(partnerType: string | null): string {
  const lines = [AGREEMENT_TITLE, `Version ${AGREEMENT_VERSION}`, ""];
  for (const [i, s] of agreementSections(partnerType).entries()) {
    lines.push(`${i + 1}. ${s.heading}`);
    for (const [j, c] of s.clauses.entries()) lines.push(`${i + 1}.${j + 1} ${c}`);
    lines.push("");
  }
  return lines.join("\n");
}
