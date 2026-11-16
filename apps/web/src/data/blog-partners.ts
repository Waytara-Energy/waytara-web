import type { Guide } from "./guides";
import { PARTNER_CTA, UPDATED, UPDATED_LABEL } from "./blog-shared";

// The four articles for partners: licences, certificates, working under a licensed contractor, and the documents we ask for. Every statement about the Tamil Nadu
// Electrical Licensing Board comes from its own pages and application forms, or from the Electrical Inspectorate's page, as the sources at the foot of each article say.

const BOARD = { label: "Tamil Nadu Electrical Licensing Board", url: "https://tnelb.gov.in", note: "The Board that issues contractor licences and competency certificates. Check its current rules." };

export const licenceGrades: Guide = {
  slug: "licence-grades",
  path: "/blog/licence-grades",
  metaTitle: "Electrical Contractor Licence Grades in Tamil Nadu: EB, ESB, EA, ESA",
  metaDescription:
    "What the four Tamil Nadu electrical contractor licence grades cover, what the Board requires of an EA or ESA contractor, how to match a grade to the work, and how WayTara checks a partner's licence.",
  name: "Contractor licence grades",
  eyebrow: "Partners and licences",
  title: "Electrical contractor licence grades",
  accent: "in Tamil Nadu.",
  answer:
    "Electrical installation work in Tamil Nadu is licensed by the Tamil Nadu Electrical Licensing Board (TNELB). A contractor licence comes in four grades, EB, ESB, EA and ESA, and the grade sets the voltage of the work the business may take.",
  inShort: [
    "ESB covers installations up to 650 V, EA up to and including 33 kV, and ESA every voltage with no limit. These scopes are from the Electrical Inspectorate.",
    "The Inspectorate's list gives no scope for EB, the smallest and most common grade, so we do not state one. Ask the Board for its limits.",
    "A licence stands on named people and tested instruments: the Board's forms for EA and ESA require full-time supervisors and wiremen with its certificates, and a set of instruments tested in a government laboratory.",
    "A 415 V three-phase supply is still below 650 V, however large the site.",
    "We ask a partner for the licence itself and check it with the Board. A grade ticked on a form proves nothing.",
  ],
  sections: [
    {
      id: "board",
      badge: "Who licenses",
      title: "The Board",
      accent: "behind the licence.",
      summary: "What the Board says about itself.",
      blocks: [
        {
          type: "p",
          text: "In Tamil Nadu, electrical contractors are licensed by the Electrical Licensing Board, based at Guindy in Chennai. Its own services page says it issues licences to electrical contractors, including renewals, and that it issues and renews the Wireman Helper, Wireman and Supervisor competency certificates under Rule 45(1) of the Indian Electricity Rules, 1956.",
        },
        {
          type: "p",
          text: "The same page says the Board inquires into allegations of incompetence, negligence, breach of the Indian Electricity Rules or malpractice against licence holders and certificate holders, and takes action where it considers it necessary. A licence is therefore not a one-time purchase: it can be questioned, and it can be cancelled.",
        },
        { type: "p", text: "The Board also publishes how many licences it had issued as on 31 March 2025. The number of licences falls steeply as the grade rises:" },
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
      accent: "by voltage.",
      summary: "As the Tamil Nadu Electrical Inspectorate lists them.",
      blocks: [
        {
          type: "cols",
          items: [
            { title: "EB", body: "The smallest grade. The Inspectorate's list does not state a scope for it, and we have not found one in the Board's published forms, so ask the Board for its limits." },
            { title: "ESB", body: "Electrical installations up to 650 V." },
            { title: "EA", body: "Electrical installations up to and including 33 kV. The Board's form adds that an EA contractor can undertake high-voltage installation and all medium- and low-voltage electrical installation work." },
            { title: "ESA", body: "Electrical installations at every voltage, with no limitation in voltage or capacity." },
          ],
        },
        {
          type: "note",
          title: "Why we do not give EB a number",
          body: "Some websites quote a connected-load limit for the EB grade. We could not find it on the Inspectorate's or the Board's pages, so we do not repeat it. A wrong limit would send a project to the wrong contractor.",
        },
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
          columns: ["The voltage of the work", "Grades whose stated scope covers it"],
          rows: [
            { label: "A home or shop rooftop system on a single-phase or 415 V three-phase supply", cells: ["Up to 650 V", "ESB, EA and ESA. For EB, ask the Board about its limits."] },
            { label: "A commercial or factory system connected at 415 V", cells: ["Up to 650 V", "ESB, EA and ESA. For EB, ask the Board."] },
            { label: "Work on an 11 kV transformer or HT panel", cells: ["Above 650 V, up to 33 kV", "EA and ESA"] },
            { label: "A 33 kV installation", cells: ["Up to and including 33 kV", "EA and ESA"] },
            { label: "Anything above 33 kV", cells: ["Above 33 kV", "ESA"] },
          ],
        },
        {
          type: "p",
          text: "A three-phase supply does not make a site high voltage. A factory taking 415 V is still below 650 V, so the voltage test does not by itself rule out the lower grades. What the work actually is, what the connected load is and what the supply authority requires all count as well, which is why the grade is checked against each project and not once for all time.",
        },
      ],
    },
    {
      id: "behind",
      badge: "Behind a grade",
      title: "What a licensed contractor",
      accent: "must have.",
      summary: "From the Board's application forms for the EA and ESA grades, as printed.",
      blocks: [
        { type: "p", text: "The Board's application forms show what stands behind the two highest grades. These are the requirements as the forms print them. The Board can change them, so read the current form before relying on this." },
        {
          type: "compare",
          columns: ["EA (Grade A)", "ESA (Super A)"],
          rows: [
            {
              label: "Full-time staff",
              cells: [
                "One supervisor holding the Board's Supervisor Competency Certificate, with a diploma in electrical engineering or the Board's certificate based on the Directorate of Technical Education route, and two wiremen with valid Wireman certificates",
                "Two supervisors with the Board's certificate, one of them a graduate or diploma engineer, a qualified draughtsman, and two wiremen with valid Wireman certificates",
              ],
            },
            {
              label: "Experience asked of the supervisor",
              cells: [
                "Installation experience of not less than two years and at least five high-voltage works involving transformer erection",
                "For the engineer: five years (graduate) or ten years (diploma) in carrying out at least five high-voltage works and two extra-high-voltage works involving transformer erection",
              ],
            },
            {
              label: "Instruments",
              cells: [
                "Seven: an earth resistance tester, 500 V and 1000 V insulation testers, a phase sequence indicator, a tong-type ammeter, a live line tester and a portable voltmeter",
                "Eight: the same kinds, with a 2500 V insulation tester added",
              ],
            },
          ],
        },
        {
          type: "list",
          items: [
            "The proprietor, managing partner or director must be at least 25 years old and have passed at least the VIII standard",
            "The staff are full-time and employed solely for the contract works, and each gives the Board a signed consent letter",
            "The original competency certificates of the staff are sent to the Board with the application",
            "The instruments are tested in the Government Electrical Standards Laboratory or the TNEB laboratory within three months before applying, and the test reports go with the application",
            "An applicant from outside Tamil Nadu must have a branch office in Tamil Nadu",
            "The applicant declares having the latest Indian Electricity Rules and understanding that a breach makes the licence liable to cancellation",
          ],
        },
        {
          type: "note",
          title: "What this tells you",
          body: "A licence is not a logo on a vehicle. It rests on named people, calibrated instruments and a signed declaration. That is why we ask a partner for the licence itself and for the people behind it.",
        },
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
            { title: "The licence", body: "The grade, the number and the validity, in a copy of the licence itself. Check it with the Board." },
            { title: "The people", body: "The named supervisor and wiremen for your project, with their certificate numbers and validity." },
            { title: "The instruments", body: "That the contractor owns the testing instruments the grade requires, with current test reports." },
            { title: "The scope", body: "The voltage and work of your project, in writing, and the grade that covers it." },
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
      answer: "No. The licence belongs to a business. A Wireman or Supervisor competency certificate belongs to a person. Both are issued by TNELB, and the Board's forms for the higher grades require the business to employ people who hold the certificates.",
    },
    {
      question: "What can an EB licence cover?",
      answer: "The Inspectorate's list does not state a scope for EB, and we have not found one in the Board's published forms. Ask the Board. We do not publish a limit we could not confirm.",
    },
    {
      question: "Does software or monitoring work need a contractor licence?",
      answer: "Dashboards, data and configuring a gateway are not electrical installation work. Wiring, panels, protection devices and earthing are, and they must be done by appropriately licensed and qualified people.",
    },
    {
      question: "How long does the Board take?",
      answer: "The Board lists the longest periods it works to: one month to issue a contractor licence and 20 days to renew one. Check its current service standards.",
    },
    {
      question: "Where do I check the current rules?",
      answer: "With the Tamil Nadu Electrical Licensing Board at tnelb.gov.in. The grades, their limits and the requirements are set by the Board and can change.",
    },
  ],
  sources: [
    {
      label: "Tamil Nadu Electrical Inspectorate: Approved Contractors List",
      url: "https://tnei.tn.gov.in/pages/display/61-approved-contractors-list",
      note: "States the scope of ESA (no limitation in voltage or capacity), EA (up to and inclusive of 33 kV) and ESB (up to 650 V). It does not state a scope for EB.",
    },
    {
      label: "TNELB: Services and Standards",
      url: "https://tnelb.gov.in/servAndStand.html",
      note: "The services the Board renders, the number of licences and certificates issued as on 31 March 2025, and its service standards.",
    },
    {
      label: "TNELB Form A: application for an Electrical Contractor's Licence, Grade A (EA)",
      url: "https://tnelb.gov.in/Forms/FrmEAen.pdf",
      note: "The staff, instruments, age and education conditions, the branch-office rule, and the declaration. A PDF.",
    },
    {
      label: "TNELB Form for the Super A grade (ESA)",
      url: "https://tnelb.gov.in/Forms/FrmSAen.pdf",
      note: "The staff and instruments required for the ESA grade. A PDF.",
    },
    BOARD,
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
    "The difference between a contractor licence and a competency certificate, what the Board's Supervisor application asks for, how certificates tie a person to one contractor, and what WayTara asks to see.",
  name: "Wireman and Supervisor certificates",
  eyebrow: "Partners and licences",
  title: "Wireman and Supervisor certificates:",
  accent: "who holds what.",
  answer:
    "A contractor licence belongs to a business. A competency certificate belongs to a person. TNELB issues both, and a contractor's licence depends on the business employing people who hold the right certificates.",
  inShort: [
    "The Board issues three levels of competency certificate for people working on electrical installations: Wireman Helper, Wireman and Supervisor.",
    "For the EA and Super A contractor grades, the Board's forms require full-time staff with its Supervisor and Wireman certificates.",
    "The Board's consent form says the certificate holder is not working under any other contractor or organisation, so a named supervisor belongs to one licensed contractor at a time.",
    "The Supervisor application, Form S, lists a diploma or degree in electrical engineering, or A.M.I.E. Part A and B, and two years' experience of high-voltage installations, as the route.",
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
          text: "The Board's services page says it issues and renews the Wireman Helper, Wireman and Supervisor competency certificates under Rule 45(1) of the Indian Electricity Rules, 1956, and a separate competency certificate for operation and maintenance personnel working in power stations and associated substations under Rule 3(2A). As on 31 March 2025 it had issued 154,601 Wireman certificates, 64,465 Supervisor certificates, 29,203 Wireman Helper certificates and 377 for power generating operators.",
        },
        { type: "p", text: "The Board works to stated maximum periods: 30 days to issue a certificate and 20 days to renew one. It says it strives to beat them." },
      ],
    },
    {
      id: "supervisor",
      badge: "The Supervisor route",
      title: "What the Supervisor",
      accent: "application asks.",
      summary: "From TNELB Form S, as printed.",
      blocks: [
        { type: "p", text: "The Board's Form S is the application for a Supervisor Competency Certificate. Its instructions give the qualification and experience, and it lists what must go with it." },
        {
          type: "cols",
          items: [
            { title: "Qualification", body: "A diploma in electrical engineering from the Department of Technical Education, or a degree in electrical engineering from an Indian university, or A.M.I.E. in electrical engineering with Parts A and B." },
            { title: "Experience", body: "Two years' experience in erection, or operation and maintenance, of high-voltage installations. The form also names a route for applicants who hold an electrical supervisor competency certificate from the Department of Technical Education." },
            { title: "Previous certificate", body: "The form asks whether you hold a Wireman or Wireman Helper certificate from the Board, and asks you to give its details and surrender it." },
          ],
        },
        {
          type: "list",
          items: [
            "Proof of date of birth, in original with a photocopy",
            "The technical qualification certificate, in original with a photocopy",
            "Details of past and present experience, with evidence",
            "Details of any earlier application",
            "A demand draft for the fee, drawn in favour of the Secretary of the Board",
            "Passport-size photographs, one attested by a Gazetted Officer, and the signature in triplicate",
          ],
        },
        { type: "p", text: "The Board can change the form, the qualification and the fee. Read the current Form S on tnelb.gov.in before you apply. We have not found the Board's published form for the Wireman certificate, so we do not state its eligibility rules here." },
      ],
    },
    {
      id: "contractor",
      badge: "Tied to a contractor",
      title: "How a certificate",
      accent: "ties to a licence.",
      summary: "From the Board's forms for the EA and Super A contractor grades.",
      blocks: [
        { type: "p", text: "A contractor cannot hold an EA or Super A licence on paper alone. The Board's forms require the business to employ named people full-time, solely for contract works: for EA, one supervisor and two wiremen, and for Super A, two supervisors, a draughtsman and two wiremen. Each one gives the Board a signed consent letter, and the Board asks for the original certificates." },
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
      answer: "Not as the staff of a licence. In the Board's consent form for the EA and Super A grades, the certificate holder declares that they are working for that contractor as a full-time employee and are not working under any other contractor or organisation.",
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
  ],
  sources: [
    {
      label: "TNELB Form S: application for a Supervisor Competency Certificate",
      url: "https://tnelb.gov.in/Forms/FrmSen.pdf",
      note: "The qualification, the experience, the documents, and the question about a Wireman or Wireman Helper certificate. A PDF.",
    },
    {
      label: "TNELB: Services and Standards",
      url: "https://tnelb.gov.in/servAndStand.html",
      note: "Rule 45(1) and Rule 3(2A), the certificates issued as on 31 March 2025, and the service standards.",
    },
    {
      label: "TNELB Form A for the EA contractor licence",
      url: "https://tnelb.gov.in/Forms/FrmEAen.pdf",
      note: "The full-time staff, the consent-cum-declaration letter from the supervisor or wireman. A PDF.",
    },
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
    "How a solar or EV charging team without its own contractor licence can work with WayTara through a licensed contractor, what the Board's forms imply, how to set it up in writing, and the warning signs.",
  name: "Working under a licensed contractor",
  eyebrow: "Partners and licences",
  title: "Working under a licensed contractor:",
  accent: "how it works.",
  answer:
    "Many solar and EV charging teams do the installation but do not hold a contractor licence themselves. That can work when the electrical work is done, and signed for, by a licensed contractor you really work with, and you can show how.",
  inShort: [
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
      id: "forms",
      badge: "What the forms show",
      title: "Why a licence number",
      accent: "is not enough.",
      summary: "From the Board's forms for the EA and Super A grades.",
      blocks: [
        { type: "p", text: "The Board's forms require a contractor to employ named supervisors and wiremen full-time, solely for contract works, and each of them signs a consent letter. The consent letter has the certificate holder declare that they work for the contractor as a full-time employee and are not working under any other contractor or organisation." },
        { type: "p", text: "That is why borrowing a licence, or borrowing a supervisor's name, does not work. A contractor's licence rests on people who really work for it, and the Board can inquire into breaches and act against licence and certificate holders. A team that leans on a licence it has no real connection with puts the contractor's licence at risk as well as its own work." },
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
            "The licence has expired, or its grade does not cover the voltage of the work",
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
      question: "Is this legal advice?",
      answer: "No. It is general information. The Tamil Nadu Electrical Licensing Board and the electrical inspectorate decide what is allowed.",
    },
  ],
  sources: [
    {
      label: "TNELB Form A for the EA contractor licence",
      url: "https://tnelb.gov.in/Forms/FrmEAen.pdf",
      note: "The full-time staff, and the consent-cum-declaration letter from the supervisor or wireman. A PDF.",
    },
    { label: "TNELB: Services and Standards", url: "https://tnelb.gov.in/servAndStand.html", note: "The Board's power to inquire into breaches and act against licence and certificate holders." },
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
    "We never ask for a full Aadhaar number, an OTP or biometric details. Where an identity proof is needed, we ask for a masked copy.",
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
            { label: "An identity proof, usually for an individual", cells: ["To confirm that you are who you say you are"] },
          ],
        },
        {
          type: "note",
          title: "Identity proof and Aadhaar",
          body: "Where an identity proof is needed, we ask for a masked Aadhaar copy, with all but the last four digits hidden. We never ask for the full number, an OTP or biometric details. If you prefer, another proof of identity can be used.",
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
      answer: "Because we do not need it. A masked copy is enough to confirm who you are, and it keeps a sensitive number out of our records.",
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
