import type { Guide } from "./guides";
import { PARTNER_CTA, UPDATED, UPDATED_LABEL } from "./blog-shared";

// The four articles for partners: licences, certificates, working under a licensed contractor, and the documents we ask for. Every statement about the Tamil Nadu
// Electrical Licensing Board comes from its own pages, application forms and fee notification, or from the Electrical Inspectorate's page; the legal rule is
// regulation 31 of the CEA safety regulations, 2023. The EB, ESB, Wireman and Wireman Helper forms are printed in Tamil, so a Tamil reader should check what is
// said of them (the verification sheet for reviewers lists each one).

const BOARD = { label: "Tamil Nadu Electrical Licensing Board", url: "https://tnelb.gov.in", note: "The Board that issues contractor licences and competency certificates. Check its current rules." };
const BOARD_SERVICES = {
  label: "TNELB: Services and Standards",
  url: "https://tnelb.gov.in/servAndStand.html",
  note: "The services the Board renders, the licences and certificates issued as on 31 March 2025, and its service periods.",
};
const BOARD_FEES = {
  label: "TNELB: notification of fees, effective 1 January 2024",
  url: "https://tnelb.gov.in/Forms/FeeSch.pdf",
  note: "The issue, renewal, surcharge, duplicate and damaged-certificate fees for each grade and certificate, and the renewal intervals. A PDF.",
};
const CEA_SAFETY = {
  label: "CEA (Measures relating to Safety and Electric Supply) Regulations, 2023, Gazette notification of 8 June 2023",
  url: "https://kseb.in/uploads/Downloadtemsuppy/Central%20Electricity%20Authority%20(Measures%20relating%20to%20Safety%20and%20Electric%20Supply)%20Regulations,%202023-1699594973944568556.pdf",
  note: "Regulation 31 (who may carry out installation work). A copy hosted by KSEB; the official text is on the CEA website. A PDF.",
};

export const licenceGrades: Guide = {
  slug: "licence-grades",
  path: "/blog/licence-grades",
  metaTitle: "Electrical Contractor Licence Grades in Tamil Nadu: EB, ESB, EA, ESA",
  metaDescription:
    "What the four Tamil Nadu electrical contractor licence grades cover, what the Board requires of each, what they cost, how the law ties work to a licence, and how WayTara checks a partner's licence.",
  name: "Contractor licence grades",
  eyebrow: "Partners and licences",
  title: "Electrical contractor licence grades",
  accent: "in Tamil Nadu.",
  answer:
    "Electrical installation work in India must be done by a contractor licensed by the State Government, under the supervision of a certified person. In Tamil Nadu the licence comes from the Electrical Licensing Board in four grades, EB, ESB, EA and ESA, and the grade sets the size and voltage of the work.",
  inShort: [
    "The law (regulation 31 of the CEA safety regulations, 2023) says installation work must be done by a contractor licensed by the State Government, under the direct supervision of a competency-certificate holder.",
    "The Board's own forms set the scope: EB works not exceeding 50 kW in low- and medium-voltage consumers' installations; ESB all low- and medium-voltage work (up to 650 V); EA high-voltage work up to and including 33 kV; ESA no limit.",
    "Each grade stands on named full-time staff and tested instruments, and the Board can inquire into and act against a licence.",
    "The Board publishes lists of approved EA and ESA contractors, so those licences can be checked.",
    "We ask a partner for the licence itself and check it. A grade ticked on a form proves nothing.",
  ],
  sections: [
    {
      id: "law",
      badge: "The rule",
      title: "Why a licence",
      accent: "is needed at all.",
      summary: "Regulation 31 of the CEA safety regulations, 2023.",
      blocks: [
        {
          type: "p",
          text: "Regulation 31(1) says that no electrical installation work, including additions, alterations, repairs and adjustments to existing installations, may be carried out on a consumer's premises except by an electrical contractor licensed by the State Government, on its behalf under the direct supervision of a person holding a certificate of competency, and by a person holding a permit issued or recognised by the State Government.",
        },
        {
          type: "p",
          text: "There is one carve-out: replacing lamps, fans, fuses, switches, domestic appliances of not more than 250 V and fittings, where that in no way alters the capacity or character of the installation. Anything beyond that is installation work.",
        },
        { type: "p", text: "Regulation 31(2) adds the sanction: installation work done in contravention of the first sub-regulation shall not be energised or connected to the works of any supplier. The Board's own home page puts the same rule plainly: these licences are mandatory for anybody to carry out any electrical installation work." },
      ],
    },
    {
      id: "board",
      badge: "Who licenses",
      title: "The Board",
      accent: "behind the licence.",
      summary: "What the Board says about itself.",
      blocks: [
        {
          type: "p",
          text: "The Tamil Nadu Electrical Licensing Board is a body constituted by the Government of Tamil Nadu under Rule 45 of the Indian Electricity Rules, 1956. The Chief Electrical Inspector to Government is its President, its head office is at Guindy in Chennai, and it has no branches. It issues and renews contractor licences and the Wireman Helper, Wireman and Supervisor competency certificates.",
        },
        {
          type: "p",
          text: "Its services page also says the Board inquires into allegations of incompetence, negligence, breach of the Indian Electricity Rules or malpractice against licence holders and certificate holders, and takes action where it considers it necessary. A licence is not a one-time purchase: it can be questioned, and it can be cancelled.",
        },
        { type: "p", text: "The Board publishes how many licences it had issued as on 31 March 2025. The number falls steeply as the grade rises:" },
        {
          type: "cols",
          items: [
            { title: "EB: 22,561", body: "Licences issued as on 31 March 2025. About four in five of all contractor licences." },
            { title: "ESB: 2,872", body: "Licences issued as on 31 March 2025." },
            { title: "EA: 2,686", body: "Licences issued as on 31 March 2025." },
            { title: "ESA: 502", body: "Licences issued as on 31 March 2025. The highest grade is also the rarest." },
          ],
        },
        { type: "p", text: "For the timing, the Board lists the longest periods it works to: one month to issue a contractor licence and 20 days to renew one. It says it strives to beat them." },
      ],
    },
    {
      id: "grades",
      badge: "The grades",
      title: "Four grades,",
      accent: "by size and voltage.",
      summary: "What the Board's forms and the Electrical Inspectorate say each grade may do.",
      blocks: [
        {
          type: "cols",
          items: [
            { title: "EB", body: "Electrical works not exceeding 50 kW, only in the electrical installations of low- and medium-voltage consumers. This is the note in the Board's EB application form, which is printed in Tamil." },
            { title: "ESB", body: "All low- and medium-voltage electrical installation work, which the Electrical Inspectorate lists as installations up to 650 V." },
            { title: "EA", body: "High-voltage installation and all medium- and low-voltage work. The Inspectorate lists electrical installations up to and including 33 kV." },
            { title: "ESA", body: "Electrical installations at every voltage, with no limitation in voltage or capacity." },
          ],
        },
        { type: "note", title: "Tamil forms", body: "The Board's EB and ESB forms are printed in Tamil. The scopes above are our reading of them. If your decision rests on a scope, read the form or ask the Board." },
      ],
    },
    {
      id: "fit",
      badge: "Matching the work",
      title: "Which grade fits",
      accent: "which work?",
      summary: "A reading of the stated scopes. The Board and the electrical inspectorate have the final say.",
      blocks: [
        {
          type: "compare",
          columns: ["The voltage and size of the work", "Grades whose stated scope covers it"],
          rows: [
            { label: "A home rooftop system or a small shop installation, up to 50 kW", cells: ["Low or medium voltage, up to 50 kW", "EB, ESB, EA and ESA"] },
            { label: "A commercial or factory system connected at 415 V, above 50 kW", cells: ["Up to 650 V, above 50 kW", "ESB, EA and ESA"] },
            { label: "Work on an 11 kV transformer or HT panel", cells: ["Above 650 V, up to 33 kV", "EA and ESA"] },
            { label: "A 33 kV installation", cells: ["Up to and including 33 kV", "EA and ESA"] },
            { label: "Anything above 33 kV", cells: ["Above 33 kV", "ESA"] },
          ],
        },
        {
          type: "p",
          text: "A three-phase supply does not make a site high voltage: a factory taking 415 V is still below 650 V. The size of the work matters too, because the EB form caps its licence holder at 50 kW. What the work actually is and what the supply authority requires count as well, which is why the grade is checked against each project and not once for all time.",
        },
      ],
    },
    {
      id: "behind",
      badge: "Behind a grade",
      title: "What a licensed contractor",
      accent: "must have.",
      summary: "From the Board's application forms, as printed. The Board can change them.",
      blocks: [
        { type: "p", text: "A licence rests on people and instruments. The forms for the four grades ask for the following:" },
        {
          type: "compare",
          columns: ["EB", "ESB", "EA", "ESA"],
          rows: [
            {
              label: "Full-time staff",
              cells: [
                "A person holding a Wireman competency certificate. Not needed if the proprietor holds one",
                "One person with a Supervisor certificate and one with a Wireman certificate. A certificate the proprietor holds counts",
                "One supervisor and two wiremen",
                "Two supervisors (one a graduate or diploma engineer), a draughtsman and two wiremen",
              ],
            },
            {
              label: "What the supervisor must have done",
              cells: ["Not stated", "Not stated", "At least two years of installation experience and five high-voltage works involving transformer erection", "The engineer: five years (graduate) or ten (diploma), with at least five high-voltage and two extra-high-voltage works"],
            },
            {
              label: "Instruments",
              cells: [
                "Two: a 500 V insulation tester and a live line tester",
                "Four: a 500 V insulation tester, a tong-type ammeter, an earth resistance tester and a live line tester",
                "Seven: the ESB four's kinds plus a 1000 V insulation tester, a phase sequence indicator and a portable voltmeter",
                "Eight: the same kinds with a 2500 V insulation tester added",
              ],
            },
            { label: "Issue fee, from 1 January 2024", cells: ["₹5,000", "₹10,000", "₹30,000", "₹50,000"] },
            { label: "Renewal fee, every three years", cells: ["₹3,000", "₹6,000", "₹20,000", "₹30,000"] },
          ],
        },
        {
          type: "list",
          items: [
            "The proprietor, managing partner or director must be at least 25 years old and have passed at least the VIII standard",
            "The staff are full-time, employed solely for the contract works, and each gives the Board a signed consent letter with the original certificate",
            "The instruments are tested in the Government Electrical Standards Laboratory or the TNEB laboratory within three months before applying, and the test reports go with the application",
            "A bank solvency certificate valid for at least three years is part of the application for ESB and EA",
            "An applicant from outside Tamil Nadu must have a branch office in Tamil Nadu",
            "A late renewal carries a monthly surcharge, and the licence holder sends a copy of the licence with each renewal application",
          ],
        },
        { type: "note", title: "What this tells you", body: "A licence is not a logo on a vehicle. It rests on named people, calibrated instruments and a signed declaration. That is why we ask a partner for the licence itself and for the people behind it." },
      ],
    },
    {
      id: "ask",
      badge: "Before you hire",
      title: "What to ask",
      accent: "any contractor.",
      blocks: [
        {
          type: "steps",
          items: [
            { title: "The licence", body: "The grade, the number and the validity, in a copy of the licence itself. For EA and ESA, the Board publishes lists of approved contractors with licence number, holder, issue date and validity." },
            { title: "The people", body: "The named supervisor and wiremen for your project, with their certificate numbers and validity." },
            { title: "The instruments", body: "That the contractor owns the testing instruments the grade requires, with current test reports." },
            { title: "The scope", body: "The voltage and size of your project, in writing, and the grade that covers it." },
            { title: "The sign-off", body: "Who signs the completion and test records for the electrical work." },
            { title: "The change rule", body: "That no inverter, cable or protection device changes without your written approval." },
          ],
        },
      ],
    },
    {
      id: "waytara",
      badge: "At WayTara",
      title: "How we use",
      accent: "the grade.",
      blocks: [
        { type: "p", text: "We ask a partner for the licence itself, with its number and validity, and we check it with the Board. We do not accept a grade that is only ticked on a form. A project goes to a partner only where the verified grade fits it, and approval covers only the scope we have verified." },
        { type: "p", text: "We may ask for a fresh copy when a licence is renewed. We do not accept a licence that is used by someone it does not belong to. The Partner Terms and the guide on working under a licensed contractor explain what that means for teams that do not hold a licence of their own." },
      ],
    },
  ],
  faqs: [
    {
      question: "Is a contractor licence the same as a Wireman or Supervisor certificate?",
      answer: "No. The licence belongs to a business. A Wireman or Supervisor competency certificate belongs to a person. Both are issued by TNELB, and the Board's forms for each grade require the business to employ people who hold the certificates, unless the proprietor holds one.",
    },
    {
      question: "What can an EB licence cover?",
      answer: "According to the note in the Board's EB application form, which is printed in Tamil, an EB licence holder may undertake electrical works not exceeding 50 kW, only in the electrical installations of low- and medium-voltage consumers. Check the form if your decision rests on it.",
    },
    {
      question: "Does software or monitoring work need a contractor licence?",
      answer: "Dashboards, data and configuring a gateway are not electrical installation work. Wiring, panels, protection devices and earthing are, and under regulation 31 of the CEA safety regulations they must be done by a licensed contractor under supervision.",
    },
    {
      question: "How long does the Board take?",
      answer: "The Board lists the longest periods it works to: one month to issue a contractor licence and 20 days to renew one. Check its current service standards.",
    },
    {
      question: "Are these fees current?",
      answer: "They are the fees in the Board's notification effective 1 January 2024. The Board can revise them. Check the Board before you pay.",
    },
  ],
  sources: [
    CEA_SAFETY,
    {
      label: "Tamil Nadu Electrical Inspectorate: Approved Contractors List",
      url: "https://tnei.tn.gov.in/pages/display/61-approved-contractors-list",
      note: "States the scope of ESA (no limitation in voltage or capacity), EA (up to and inclusive of 33 kV) and ESB (up to 650 V).",
    },
    { label: "TNELB home page", url: "https://tnelb.gov.in/", note: "The Board's description of itself, that the licences are mandatory, and the links to the lists of approved EA and ESA contractors." },
    BOARD_SERVICES,
    BOARD_FEES,
    { label: "TNELB Form A: Electrical Contractor's Licence, Grade A (EA)", url: "https://tnelb.gov.in/Forms/FrmEAen.pdf", note: "Staff, instruments, age and education, scope (note 7). A PDF in English." },
    { label: "TNELB Form for the Super A grade (ESA)", url: "https://tnelb.gov.in/Forms/FrmSAen.pdf", note: "Staff and instruments for ESA. A PDF in English." },
    { label: "TNELB Form EB (printed in Tamil)", url: "https://tnelb.gov.in/Forms/FrmEBtm.pdf", note: "Notes on page 5: fee, age, staff, instruments, and the 50 kW limit for low- and medium-voltage consumers." },
    { label: "TNELB Form ESB (printed in Tamil)", url: "https://tnelb.gov.in/Forms/FrmESBtm.pdf", note: "Notes on pages 5 and 6: staff, instruments, bank solvency, and the scope of all low- and medium-voltage work." },
  ],
  related: ["competency-certificates", "working-under-a-contractor", "partner-documents-and-privacy"],
  updated: UPDATED,
  updatedLabel: UPDATED_LABEL,
  category: "Partners and licences",
  cta: PARTNER_CTA,
};

export const competencyCertificates: Guide = {
  slug: "competency-certificates",
  path: "/blog/competency-certificates",
  metaTitle: "Wireman, Supervisor and Wireman Helper Certificates in Tamil Nadu",
  metaDescription:
    "The difference between a contractor licence and a competency certificate, what the Board asks of a Wireman, Wireman Helper or Supervisor applicant, what each costs, and how certificates tie a person to one contractor.",
  name: "Wireman and Supervisor certificates",
  eyebrow: "Partners and licences",
  title: "Wireman and Supervisor certificates:",
  accent: "who holds what.",
  answer:
    "A contractor licence belongs to a business. A competency certificate belongs to a person. TNELB issues both, and the law requires installation work to be supervised by a certificate holder.",
  inShort: [
    "The Board issues three levels of competency certificate for people working on electrical installations: Wireman Helper, Wireman and Supervisor.",
    "Regulation 31(1) of the CEA safety regulations requires installation work to be done under the direct supervision of a person holding a certificate of competency.",
    "A Wireman applicant sends a pass certificate in the wireman or electrician test; a Supervisor applicant needs a diploma or degree in electrical engineering, or A.M.I.E. Parts A and B, and two years' experience of high-voltage installations.",
    "The Board's consent form says the certificate holder works full time for one contractor and is not working under any other, so a named supervisor belongs to one licensed contractor at a time.",
    "Ask for the certificate number, who issued it, how long it is valid and what it covers. A job title proves none of those.",
  ],
  sections: [
    {
      id: "two",
      badge: "Two documents",
      title: "A licence and a certificate",
      accent: "are different.",
      blocks: [
        { type: "p", text: "People often say 'licensed electrician' for anyone who works with wiring. In Tamil Nadu there are two separate documents, and they belong to different things." },
        {
          type: "cols",
          items: [
            { title: "The contractor licence", body: "Held by a business or proprietor. It sets the grade of work the business may take (EB, ESB, EA or ESA). See the guide to licence grades." },
            { title: "The competency certificate", body: "Held by a person. It shows that the Board has recognised that person as a Wireman Helper, a Wireman or a Supervisor." },
          ],
        },
        {
          type: "p",
          text: "The Board's services page says it issues and renews these certificates under Rule 45(1) of the Indian Electricity Rules, 1956, and a separate competency certificate for operation and maintenance personnel working in power stations and associated substations under Rule 3(2A). As on 31 March 2025 it had issued 154,601 Wireman certificates, 64,465 Supervisor certificates, 29,203 Wireman Helper certificates and 377 for power generating operators.",
        },
        { type: "p", text: "Under regulation 31(1) of the CEA safety regulations, installation work must be carried out under the direct supervision of a person holding a certificate of competency, by a person holding a permit issued or recognised by the State Government, and for a contractor the State has licensed. That is the reason the certificates matter." },
        { type: "p", text: "The Board works to stated maximum periods: 30 days to issue a certificate and 20 days to renew one. It says it strives to beat them." },
      ],
    },
    {
      id: "apply",
      badge: "What each asks",
      title: "What each application",
      accent: "asks for.",
      summary: "From the Board's Forms W, WH and S, as printed. Forms W and WH are in Tamil; the notes below are our reading of them.",
      blocks: [
        {
          type: "cols",
          items: [
            { title: "Wireman Helper (Form WH)", body: "A pass certificate in the Wireman Helper competency test conducted by the Directorate of Employment and Training, in original with an attested copy." },
            { title: "Wireman (Form W)", body: "A pass certificate in the wireman or electrician test conducted by the Directorate of Employment and Training or a Tamil Nadu industrial training institute, in original with an attested copy." },
            { title: "Supervisor (Form S)", body: "A diploma in electrical engineering from the Department of Technical Education, a degree in electrical engineering, or A.M.I.E. Parts A and B, and two years' experience of erection or operation and maintenance of high-voltage installations. A route also exists for holders of a supervisor certificate from the Department of Technical Education." },
          ],
        },
        {
          type: "list",
          items: [
            "Proof of date of birth, in original with a photocopy",
            "The details of your past and present experience, and of any earlier application",
            "Three recent passport-size photographs, one attested by a Gazetted Officer, and a specimen signature three times on separate paper",
            "For a Supervisor application, the details of any Wireman or Wireman Helper certificate you hold, which you surrender",
            "The fee, paid as the form directs, by demand draft or, on some forms, postal order, in favour of the Secretary of the Board",
          ],
        },
        {
          type: "compare",
          columns: ["Wireman Helper", "Wireman", "Supervisor"],
          rows: [
            { label: "Issue fee, from 1 January 2024", cells: ["₹1,000", "₹1,250", "₹2,500"] },
            { label: "Renewal fee, every four years", cells: ["₹750", "₹1,000", "₹1,500"] },
          ],
        },
        { type: "p", text: "The Board can change the forms, the qualifications and the fees. Read the current forms on tnelb.gov.in before you apply." },
      ],
    },
    {
      id: "contractor",
      badge: "Tied to a contractor",
      title: "How a certificate",
      accent: "ties to a licence.",
      summary: "From the Board's forms for the contractor grades.",
      blocks: [
        { type: "p", text: "A contractor cannot hold a licence on paper alone. The Board's forms require the business to employ named people full-time, solely for contract works: for EA, one supervisor and two wiremen; for ESA, two supervisors, a draughtsman and two wiremen; and for the smaller grades, a certificate holder as set out in the guide to licence grades. Each gives the Board a signed consent letter, and the Board asks for the original certificates." },
        { type: "p", text: "The consent letter has the certificate holder state that they are working for the contractor as a full-time employee, and that they have not obtained a contractor's licence on the strength of their certificate and are not working under any other contractor or organisation. They also promise to tell the Board at once when they leave the employer." },
        {
          type: "note",
          title: "What follows from that",
          body: "A named supervisor belongs to one licensed contractor at a time. A team cannot 'borrow' a supervisor who is on someone else's licence, and a contractor who lists a supervisor who is not really theirs is putting their own licence at risk.",
        },
      ],
    },
    {
      id: "ask",
      badge: "At WayTara",
      title: "What we ask",
      accent: "to see.",
      blocks: [
        {
          type: "steps",
          items: [
            { title: "The certificate", body: "The number, the level (Helper, Wireman or Supervisor) and the validity, from the certificate itself." },
            { title: "The person", body: "That the person is who the certificate says, and works for the partner or the contractor named." },
            { title: "The work", body: "The projects the person has actually done or supervised, so we can match the person to the work." },
          ],
        },
        { type: "p", text: "We check certificates with the issuing authority before we approve a partner. A technician who does not hold a certificate is not turned away automatically: some assignments are supervised or do not need one, and we ask what you hold and where the work needs a certificate." },
      ],
    },
  ],
  faqs: [
    {
      question: "Can one supervisor cover several contractors?",
      answer: "Not as the staff of a licence. In the Board's consent form for the contractor grades, the certificate holder declares that they are working for that contractor as a full-time employee and are not working under any other contractor or organisation.",
    },
    {
      question: "I hold a Wireman certificate. Can I apply for a Supervisor certificate?",
      answer: "Form S asks whether you hold a Wireman or Wireman Helper certificate from the Board, and asks you to give its details and surrender it. The qualification and experience still have to be met. Check the current form.",
    },
    {
      question: "How long does the Board take?",
      answer: "The Board lists the longest periods it works to: 30 days to issue a certificate and 20 days to renew one.",
    },
    {
      question: "Does a technician need a certificate to work with WayTara?",
      answer: "Not always. Some assignments are supervised or do not need one. We ask what you hold, and where the work needs a certificate we check it.",
    },
    {
      question: "Why are some of these forms in Tamil?",
      answer: "The Board prints its Wireman, Wireman Helper, EB and ESB forms in Tamil, and its Supervisor, EA and ESA forms in English. We read the Tamil ones carefully, and a Tamil reader should confirm anything your decision rests on.",
    },
  ],
  sources: [
    CEA_SAFETY,
    { label: "TNELB Form S: application for a Supervisor Competency Certificate", url: "https://tnelb.gov.in/Forms/FrmSen.pdf", note: "The qualification, the experience, the documents, and the question about a Wireman or Wireman Helper certificate. A PDF in English." },
    { label: "TNELB Form W: application for a Wireman competency certificate (printed in Tamil)", url: "https://tnelb.gov.in/Forms/FrmWtm.pdf", note: "Notes 1 to 10: the fee and the pass certificate required." },
    { label: "TNELB Form WH: application for a Wireman Helper competency certificate (printed in Tamil)", url: "https://tnelb.gov.in/Forms/FrmWHtm.pdf", note: "Notes 1 to 10: the fee and the pass certificate required." },
    BOARD_FEES,
    BOARD_SERVICES,
    { label: "TNELB Form A for the EA contractor licence", url: "https://tnelb.gov.in/Forms/FrmEAen.pdf", note: "The full-time staff and the consent-cum-declaration letter from the supervisor or wireman. A PDF." },
    BOARD,
  ],
  related: ["licence-grades", "working-under-a-contractor", "partner-documents-and-privacy"],
  updated: UPDATED,
  updatedLabel: UPDATED_LABEL,
  category: "Partners and licences",
  cta: PARTNER_CTA,
};

export const workingUnderContractor: Guide = {
  slug: "working-under-a-contractor",
  path: "/blog/working-under-a-contractor",
  metaTitle: "Working Under a Licensed Contractor: Solar and EV Charging Teams",
  metaDescription:
    "How a solar or EV charging team without its own contractor licence can work with WayTara through a licensed contractor, what the law and the Board's forms imply, how to set it up in writing, and the warning signs.",
  name: "Working under a licensed contractor",
  eyebrow: "Partners and licences",
  title: "Working under a licensed contractor:",
  accent: "how it works.",
  answer:
    "Many solar and EV charging teams do the installation but do not hold a contractor licence themselves. The law lets installation work be done by a licensed contractor under a certified supervisor, so a team without a licence can work through one it really works with, and can show how.",
  inShort: [
    "Regulation 31 of the CEA safety regulations requires installation work to be done by a contractor licensed by the State Government, under the direct supervision of a certificate holder. Work done otherwise may not be energised or connected.",
    "A team can be a WayTara partner without its own licence if a licensed contractor does and signs for the electrical work.",
    "The contractor must really work with you. The Board's forms tie a contractor's licence to named full-time staff, so a licence number alone is not enough.",
    "Put the arrangement in writing: who the contractor is, who supervises, who signs, and what may not change without approval.",
    "We ask who the contractor is, then check their licence and the supervisor they name. Approval covers only the scope we verify.",
  ],
  sections: [
    {
      id: "problem",
      badge: "The problem",
      title: "Doing the work,",
      accent: "without the licence.",
      blocks: [
        { type: "p", text: "Rooftop solar and EV charger installation often grows out of small teams: people who mount panels, run cables, fit chargers and know the equipment well. Many of them do not hold an electrical contractor licence, and many of the licensed contractors do not do solar or EV work every day." },
        { type: "p", text: "The two meet in projects. The question is how to work together so that the electrical work is done by people who are licensed and qualified for it, the customer can see who is responsible, and nobody is using a licence that is not theirs." },
      ],
    },
    {
      id: "law",
      badge: "The rule",
      title: "What the law",
      accent: "says.",
      summary: "Regulation 31 of the CEA safety regulations, 2023.",
      blocks: [
        { type: "p", text: "Installation work, including additions and alterations, may be carried out only by an electrical contractor licensed by the State Government, on its behalf under the direct supervision of a person holding a certificate of competency, and by a person holding a permit issued or recognised by the State Government. Installation work done in contravention of that shall not be energised or connected to the works of any supplier." },
        { type: "p", text: "So the question to settle is not whether you can do the physical work. It is whose licence the work is done under, and who is the supervisor who answers for it." },
      ],
    },
    {
      id: "forms",
      badge: "What the forms show",
      title: "Why a licence number",
      accent: "is not enough.",
      summary: "From the Board's forms for the contractor grades.",
      blocks: [
        { type: "p", text: "The Board's forms require a contractor to employ named supervisors and wiremen full-time, solely for contract works, and each of them signs a consent letter. The consent letter has the certificate holder declare that they work for the contractor as a full-time employee and are not working under any other contractor or organisation." },
        { type: "p", text: "That is why borrowing a licence, or borrowing a supervisor's name, does not work. A contractor's licence rests on people who really work for it, and the Board can inquire into breaches and act against licence and certificate holders. A team that leans on a licence it has no real connection with puts the contractor's licence at risk as well as its own work." },
        { type: "note", title: "A route for a small team", body: "The Board's EB form lets a proprietor who holds a Wireman certificate count as the required staff. A person who holds both a certificate and the licence can therefore be a licensed contractor in their own right, within the EB limits." },
      ],
    },
    {
      id: "ways",
      badge: "Three ways",
      title: "Three ways",
      accent: "to qualify.",
      blocks: [
        {
          type: "cols",
          items: [
            { title: "You hold the licence", body: "Your business holds a TNELB contractor licence and employs a supervisor and wiremen with their own certificates. This is the simplest case, and the licence grade must fit the work." },
            { title: "You work with a contractor", body: "A licensed contractor carries out and signs for the electrical work on your projects. They are named in your application and in each work order." },
            { title: "You are a technician", body: "You work through an authorised partner, under a supervisor, or on assignments that do not need a certificate. We ask what you hold." },
          ],
        },
      ],
    },
    {
      id: "writing",
      badge: "In writing",
      title: "Put the arrangement",
      accent: "in writing.",
      summary: "Six points to settle before the first project.",
      blocks: [
        {
          type: "steps",
          items: [
            { title: "Name the contractor", body: "The business name, licence grade and number, and validity." },
            { title: "Name the supervisor", body: "The supervisor for each project, with their certificate number and that they work for the contractor." },
            { title: "Define the scope", body: "Which electrical work the contractor carries out and signs for, and which work your team does." },
            { title: "Name who signs", body: "Who signs the test and completion records for the electrical work." },
            { title: "Lock the equipment", body: "That no inverter, cable, protection device or charger model changes without written approval." },
            { title: "Keep the records", body: "Who keeps the drawings, test records and certificates, for how long, and who can ask for them." },
          ],
        },
        { type: "note", title: "General information", body: "This is not legal advice. The Board and the electrical inspectorate decide what is allowed. If you are unsure, ask the Board before you start a project." },
      ],
    },
    {
      id: "flags",
      badge: "Warning signs",
      title: "Warning signs",
      accent: "to act on.",
      blocks: [
        {
          type: "list",
          items: [
            "The contractor will not give you the licence number or a copy of the licence",
            "The licence has expired, or its grade does not cover the size and voltage of the work",
            "The named supervisor is listed with several contractors at once",
            "Nobody can say who will sign the electrical test records",
            "The contractor has no testing instruments, or no current test reports for them",
            "Someone asks you to describe yourself as the contractor on paper, when you are not",
          ],
        },
      ],
    },
    {
      id: "waytara",
      badge: "At WayTara",
      title: "What we ask",
      accent: "of a team without a licence.",
      blocks: [
        { type: "p", text: "In the first form we ask only whether your electrical work goes through a licensed contractor. If you are shortlisted, we ask who the contractor is, then check their licence and the supervisor they name. We do not find a contractor for you: you bring the one you work with." },
        { type: "p", text: "Approval covers only the scope we have verified. If your contractor changes, tell us, and we verify the new one before they sign for a project." },
      ],
    },
  ],
  faqs: [
    {
      question: "Can I borrow a licence?",
      answer: "No. We do not accept a licence or certificate that is used by someone it does not belong to, and the Board's forms tie a licence to the contractor's own full-time staff.",
    },
    {
      question: "Does WayTara find me a contractor?",
      answer: "No. You bring the contractor you work with. If you are not sure you have one, tell us when we call you.",
    },
    {
      question: "What if my contractor and I part ways?",
      answer: "Tell us. Approval covers the scope we verified, with the contractor you named. We verify a new contractor before they sign for a project.",
    },
    {
      question: "What happens to work done without a licensed contractor?",
      answer: "Under regulation 31(2) of the CEA safety regulations, installation work carried out in contravention of the licensing rule shall not be energised or connected to the works of any supplier.",
    },
    {
      question: "Is this legal advice?",
      answer: "No. It is general information. The Tamil Nadu Electrical Licensing Board and the electrical inspectorate decide what is allowed.",
    },
  ],
  sources: [
    CEA_SAFETY,
    { label: "TNELB Form A for the EA contractor licence", url: "https://tnelb.gov.in/Forms/FrmEAen.pdf", note: "The full-time staff, and the consent-cum-declaration letter from the supervisor or wireman. A PDF." },
    { label: "TNELB Form EB (printed in Tamil)", url: "https://tnelb.gov.in/Forms/FrmEBtm.pdf", note: "The staff note: a proprietor who holds a Wireman certificate counts as the required staff." },
    BOARD_SERVICES,
    BOARD,
  ],
  related: ["licence-grades", "competency-certificates", "partner-documents-and-privacy"],
  updated: UPDATED,
  updatedLabel: UPDATED_LABEL,
  category: "Partners and licences",
  cta: PARTNER_CTA,
};

export const partnerDocuments: Guide = {
  slug: "partner-documents-and-privacy",
  path: "/blog/partner-documents-and-privacy",
  metaTitle: "Partner Documents: What WayTara Asks For and How It Is Protected",
  metaDescription:
    "The journey from application to approval, the documents a WayTara partner is asked for and why, why an Aadhaar number is never collected in full, who can open the documents, and your rights.",
  name: "Partner documents and privacy",
  eyebrow: "Partners and licences",
  title: "Partner documents:",
  accent: "what we ask, how we protect them.",
  answer:
    "You give us only a few details to apply. If you are shortlisted, we ask for documents so we can verify your business and your people. They are kept private, opened only by the people doing the verification, and not shared with customers, other partners or anyone else, except where the law requires it.",
  inShort: [
    "Nothing is asked for in the first form: no licence, no ID, no documents.",
    "At onboarding we ask for business details, licences, certificates, your team and some past work.",
    "You can prove who you are with DigiLocker instead of sending a photo ID. We never see or keep a full Aadhaar number, and we compare your selfie with your DigiLocker photo or photo ID.",
    "Documents are used only to verify you. They are not shown to customers or other partners, and they are not sold or used for advertising.",
    "You can ask to see, correct or delete what we hold, and you can withdraw at any time.",
  ],
  sections: [
    {
      id: "journey",
      badge: "The journey",
      title: "From a short form",
      accent: "to a verified partner.",
      summary: "Documents come late, and only for people we are seriously considering.",
      blocks: [
        {
          type: "steps",
          items: [
            { title: "Apply", body: "A short form: your name, phone, e-mail, district and a few answers about your work. No documents." },
            { title: "We call you", body: "We look at your business, your area and your experience. Not everyone is shortlisted." },
            { title: "Onboarding invitation", body: "If you are shortlisted, you get a personal, secure link to a private onboarding page." },
            { title: "Verification", body: "You add your details and documents, and we check them, including with the issuing authority." },
            { title: "Agreement", body: "Approved partners sign a written partner agreement before any work." },
          ],
        },
        { type: "p", text: "The point of this order is to keep documents out of the hands of applicants we will not take forward. A document you never send is a document we cannot lose." },
      ],
    },
    {
      id: "asked",
      badge: "What we ask",
      title: "What we ask for,",
      accent: "and why.",
      summary: "Only for shortlisted applicants, and only what verification needs.",
      blocks: [
        {
          type: "compare",
          columns: ["Why we ask"],
          rows: [
            { label: "Business name, address, GST registration if you have one, and the business PAN", cells: ["To identify the business we would sign an agreement with"] },
            { label: "The contractor licence, and the certificates of your supervisor and wiremen", cells: ["To check them with the issuing authority and to match you to work your licence covers"] },
            { label: "The people who would do the work, and the districts you cover", cells: ["To know who is responsible on a project, and where we can send work"] },
            { label: "Photographs or references from past projects", cells: ["To see the kind of work you have done"] },
            { label: "Your identity: verify with DigiLocker, or send a photo ID", cells: ["To confirm that you are who you say you are"] },
            { label: "A live selfie", cells: ["To check that the person in it is the person we verify, by comparing the face with your DigiLocker photo or photo ID"] },
          ],
        },
        {
          type: "note",
          title: "Identity proof and Aadhaar",
          body: "You can verify with DigiLocker, the Government of India's document wallet: you agree on its own page, and we keep only the name, date of birth, gender and address it states and the last four digits of your Aadhaar number. We never see or keep the full number, your OTP or your password. If you do not use DigiLocker, or it does not match, you send a photo ID instead (for an Aadhaar copy, with all but the last four digits hidden). We also compare your live selfie with your DigiLocker photo or photo ID, using our verification provider.",
        },
      ],
    },
    {
      id: "protect",
      badge: "How we protect them",
      title: "Private,",
      accent: "and not passed on.",
      blocks: [
        {
          type: "list",
          items: [
            "Documents are kept in private storage that cannot be reached from the web",
            "Only authorised WayTara staff doing the verification can open them, from the admin app",
            "We do not show them to customers or other partners, and we do not sell them or use them for advertising",
            "We share them with no one outside WayTara, except where the law requires it, such as an order from a court or a government authority with the right to ask",
            "Checking a licence or certificate number with the Board that issued it is part of verification",
          ],
        },
        { type: "p", text: "We say 'only the staff who verify' and not 'nobody', because verification needs a person to look at the document. What we promise is who that person can be, and what they may do." },
      ],
    },
    {
      id: "rights",
      badge: "Your rights",
      title: "What you can",
      accent: "ask of us.",
      blocks: [
        { type: "p", text: "Under the Digital Personal Data Protection Act, 2023, WayTara is the data fiduciary for what you give us. Our Privacy Policy sets out your rights in full." },
        {
          type: "cols",
          items: [
            { title: "See it", body: "Ask what documents and details we hold about you." },
            { title: "Correct it", body: "Tell us when something is wrong or out of date, such as a renewed licence." },
            { title: "Delete it", body: "Ask us to delete your documents. The documents of a partner who is not approved are kept only as long as the review and any follow-up need them." },
          ],
        },
        { type: "p", text: "If a breach ever affects your data, the Privacy Policy says we will tell you and the authorities as the law requires. The Partner Terms set out what you and WayTara agree to when you apply." },
      ],
    },
  ],
  faqs: [
    {
      question: "Why do you not collect the full Aadhaar number?",
      answer: "Because we do not need it. DigiLocker confirms who you are without the number ever reaching us (we keep only its last four digits), and a masked copy does the same if you send a photo ID instead. It keeps a sensitive number out of our records.",
    },
    {
      question: "Who at WayTara can open my documents?",
      answer: "Only the authorised staff who verify partners. Other teams cannot open them, and customers and other partners never can.",
    },
    {
      question: "Do you share my documents with customers?",
      answer: "No. A customer sees who is doing their project, not your documents.",
    },
    {
      question: "Can I withdraw?",
      answer: "Yes. Tell us, and we will stop the review. You can also ask for your documents to be deleted, as the Privacy Policy explains.",
    },
  ],
  sources: [
    { label: "WayTara Privacy Policy: Partners and the documents we collect", url: "/privacy", note: "The full text of what we collect, how long we keep it, and your rights." },
    { label: "WayTara Partner Terms", url: "/partner-terms", note: "Verification, documents and the partner agreement." },
  ],
  related: ["licence-grades", "competency-certificates", "working-under-a-contractor"],
  updated: UPDATED,
  updatedLabel: UPDATED_LABEL,
  category: "Partners and licences",
  cta: PARTNER_CTA,
};
