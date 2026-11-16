import { GUIDE_LIST, GUIDES, type Guide, type GuideCta } from "./guides";

/**
 * The blog: every article in one place, under a few topics. The older customer guides (solar, subsidy and bills) keep their own addresses and are listed here under
 * "Solar and subsidy"; the newer articles live at /blog/<slug>. Same rules as the guides: only what is true and checked, no prices, no comparison with other
 * companies, and government rules are pointed to at their official source, not restated as promises.
 */

export const BLOG_CATEGORIES = ["Partners and licences", "Gateway and integration", "EV charging", "Solar systems", "Solar and subsidy"] as const;
export type BlogCategory = (typeof BLOG_CATEGORIES)[number];

const UPDATED = "2026-11-16";
const UPDATED_LABEL = "16 November 2026";

const PARTNER_CTA: GuideCta = {
  primary: { label: "Apply to partner", href: "/partner#apply" },
  secondary: { label: "See the Partner Network", href: "/partner" },
  closing: {
    heading: "Want to work",
    accent: "with WayTara?",
    a: { label: "Apply to partner", href: "/partner#apply", hint: "A short form. No documents are needed at this stage." },
    b: { label: "Read the partner page", href: "/partner", hint: "Who we work with, how it works and what we promise." },
  },
};

const PLATFORM_CTA: GuideCta = {
  primary: { label: "Check my equipment", href: "/technology#compatibility" },
  secondary: { label: "Talk to us", href: "/contact" },
  closing: {
    heading: "Does your equipment",
    accent: "connect?",
    a: { label: "Check my equipment", href: "/technology#compatibility", hint: "Tell us the make and model. You do not need to replace anything to ask." },
    b: { label: "Talk to an engineer", href: "/contact", hint: "Ask about your site, your inverter or your charger. There is no commitment either way." },
  },
};

const licenceGrades: Guide = {
  slug: "licence-grades",
  path: "/blog/licence-grades",
  metaTitle: "Electrical Contractor Licence Grades in Tamil Nadu: EB, ESB, EA, ESA",
  metaDescription: "What the four Tamil Nadu electrical contractor licence grades cover, how a grade is matched to the work, and how WayTara checks a partner's licence.",
  name: "Contractor licence grades",
  eyebrow: "Partners and licences",
  title: "Electrical contractor licence grades",
  accent: "in Tamil Nadu.",
  answer:
    "Electrical installation work in Tamil Nadu is licensed by the Tamil Nadu Electrical Licensing Board (TNELB). A contractor licence comes in four grades, EB, ESB, EA and ESA, and the grade sets the work the business may take.",
  inShort: [
    "ESB covers installations up to 650 V, EA up to and including 33 kV, and ESA every voltage with no limit.",
    "EB is the smallest grade, for smaller low-voltage installations. TNELB sets its limits, so check them with the Board.",
    "A 415 V three-phase supply is still low voltage, however large the site.",
    "The grade is matched to the work: the voltage, the connected load and what is being installed.",
  ],
  sections: [
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
            { title: "EB", body: "Smaller low-voltage installations. TNELB sets the limits of this grade." },
            { title: "ESB", body: "Electrical installations up to 650 V." },
            { title: "EA", body: "Electrical installations up to and including 33 kV." },
            { title: "ESA", body: "Electrical installations at every voltage, with no limit." },
          ],
        },
      ],
    },
    {
      id: "fit",
      badge: "Which grade fits",
      title: "Matching the grade",
      accent: "to the work.",
      blocks: [
        { type: "p", text: "The grade is not decided by the size of a solar plant alone. The supply voltage, the connected load and the work itself (wiring, panels, protection, earthing, transformers) all count." },
        {
          type: "list",
          items: [
            "Homes and small shops, on a single-phase or 415 V three-phase supply, are low-voltage work.",
            "Work on 11 kV or 33 kV equipment, such as transformers and HT panels, needs a grade that covers that voltage: EA or ESA.",
            "Anything above 33 kV needs ESA.",
          ],
        },
        { type: "note", title: "General information", body: "This is not a licensing decision. Ask TNELB or the electrical inspectorate about your own project. We check every partner's licence ourselves." },
      ],
    },
    {
      id: "waytara",
      badge: "At WayTara",
      title: "How we use",
      accent: "the grade.",
      blocks: [
        { type: "p", text: "We ask partners for the licence itself, with its number and validity, and check it with the Board. Choosing a grade on a form proves nothing. A project goes to a partner only where the verified grade fits it." },
      ],
    },
  ],
  faqs: [
    {
      question: "Is a contractor licence the same as a Wireman certificate?",
      answer: "No. The licence belongs to a business. A Wireman or Supervisor competency certificate belongs to a person. Both are issued by TNELB, and we ask for both.",
    },
    {
      question: "Does software or monitoring work need a contractor licence?",
      answer: "Dashboards, data and configuring a gateway are not electrical installation work. Wiring, panels, protection devices and earthing are, and they must be done by appropriately licensed and qualified people.",
    },
    {
      question: "Where do I check the current rules?",
      answer: "With the Tamil Nadu Electrical Licensing Board at tnelb.gov.in. The grades, their limits and the rules for certificates are set by the Board and can change.",
    },
  ],
  related: ["competency-certificates", "working-under-a-contractor", "partner-documents-and-privacy"],
  updated: UPDATED,
  updatedLabel: UPDATED_LABEL,
  category: "Partners and licences",
  cta: PARTNER_CTA,
};

const competencyCertificates: Guide = {
  slug: "competency-certificates",
  path: "/blog/competency-certificates",
  metaTitle: "Wireman and Supervisor Competency Certificates: Who Needs What",
  metaDescription: "The difference between a contractor licence and a Wireman or Supervisor competency certificate, and what WayTara asks to see from a partner's team.",
  name: "Wireman and Supervisor certificates",
  eyebrow: "Partners and licences",
  title: "Wireman and Supervisor certificates:",
  accent: "who needs what.",
  answer:
    "A contractor licence belongs to a business. A Wireman or Supervisor competency certificate belongs to a person. TNELB issues both, and electrical work needs the right people as well as the right licence.",
  inShort: [
    "The licence is for the business, and the certificate is for the individual.",
    "A Wireman certificate and a Supervisor certificate are different, and a job title such as lineman does not by itself prove either.",
    "A contractor's work depends on employing people who hold the right certificates.",
    "Ask for the certificate number, who issued it, how long it is valid and what it covers. Do not accept a job title.",
  ],
  sections: [
    {
      id: "roles",
      badge: "The roles",
      title: "Three roles,",
      accent: "three certificates.",
      blocks: [
        {
          type: "cols",
          items: [
            { title: "Wireman", body: "A qualified electrical worker who carries out installation work within their competency and under the required supervision." },
            { title: "Supervisor", body: "Supervises electrical work and is responsible for technical supervision and safety within their competency." },
            { title: "Wireman helper", body: "An assistant-level certificate for someone who helps a competent wireman. It does not replace a wireman or a supervisor." },
          ],
        },
      ],
    },
    {
      id: "check",
      badge: "What to check",
      title: "What to ask",
      accent: "to see.",
      blocks: [
        { type: "list", items: ["The certificate number and who issued it", "How long it is valid, and whether it is current", "What it covers", "The work the person has actually done and supervised"] },
        {
          type: "p",
          text: "For example, TNELB's Form S, the application for a Supervisor Competency Certificate, lists a diploma in electrical engineering, a degree in electrical engineering, or A.M.I.E. (Part A and B) as the qualification, and two years' experience in erecting or running and maintaining high-voltage installations as the experience (or a supervisor certificate from the Department of Technical Education). It also asks whether you hold a Wireman or Wireman Helper certificate from the Board.",
        },
        { type: "p", text: "The rules for each certificate are set by TNELB and can change. Read the current form on tnelb.gov.in, or ask the Board, before you rely on any of this." },
      ],
    },
  ],
  faqs: [
    {
      question: "Does a technician need a certificate to work with WayTara?",
      answer: "Not always. Some assignments are supervised or do not need one, and we do not turn a technician away automatically. We ask what you hold, and where the work needs a certificate we check it.",
    },
    {
      question: "Who checks a partner's certificates?",
      answer: "We do, with the issuing authority, before we approve a partner. A certificate number typed into a form is not proof.",
    },
  ],
  related: ["licence-grades", "working-under-a-contractor", "partner-documents-and-privacy"],
  updated: UPDATED,
  updatedLabel: UPDATED_LABEL,
  category: "Partners and licences",
  cta: PARTNER_CTA,
};

const workingUnderContractor: Guide = {
  slug: "working-under-a-contractor",
  path: "/blog/working-under-a-contractor",
  metaTitle: "Working Under a Licensed Contractor: Solar and EV Charging Teams",
  metaDescription: "How a solar or EV charging team without its own contractor licence can still work with WayTara, and why borrowing a licence does not count.",
  name: "Working under a licensed contractor",
  eyebrow: "Partners and licences",
  title: "Working under a licensed contractor:",
  accent: "how it works.",
  answer:
    "Many solar and EV charging teams do the installation but do not hold a contractor licence themselves. That can be fine when the electrical work is done, and signed for, by a licensed contractor you really work with.",
  inShort: [
    "A team can be a WayTara partner without its own licence if a licensed contractor does and signs for the electrical work.",
    "The contractor must really work with you. Lending a licence number is not enough.",
    "We ask who the contractor is, then check their licence and the supervisor they name.",
    "Approval covers only the scope we have verified.",
  ],
  sections: [
    {
      id: "ways",
      badge: "Three ways",
      title: "Three ways",
      accent: "to qualify.",
      blocks: [
        {
          type: "cols",
          items: [
            { title: "You hold the licence", body: "Your business holds a TNELB contractor licence and employs a supervisor and wiremen with their own certificates." },
            { title: "You work with a contractor", body: "A licensed contractor carries out and signs for the electrical work on your projects. They are named in your application." },
            { title: "You are a technician", body: "You work through an authorised partner, under a supervisor, or on assignments that do not need a certificate." },
          ],
        },
      ],
    },
    {
      id: "ask",
      badge: "What we ask",
      title: "What we ask",
      accent: "about the contractor.",
      blocks: [
        {
          type: "steps",
          items: [
            { title: "Who they are", body: "The business name and the licence grade and number." },
            { title: "Who signs", body: "The named supervisor for your projects, with their certificate." },
            { title: "How you work together", body: "That the arrangement is real: they carry out and sign for the electrical work." },
          ],
        },
      ],
    },
  ],
  faqs: [
    {
      question: "Can I borrow a licence?",
      answer: "No. We do not accept a licence or certificate that is used by someone it does not belong to.",
    },
    {
      question: "Does WayTara find me a contractor?",
      answer: "No. You bring the contractor you work with. If you are not sure you have one, tell us when we call you.",
    },
  ],
  related: ["licence-grades", "competency-certificates", "partner-documents-and-privacy"],
  updated: UPDATED,
  updatedLabel: UPDATED_LABEL,
  category: "Partners and licences",
  cta: PARTNER_CTA,
};

const partnerDocuments: Guide = {
  slug: "partner-documents-and-privacy",
  path: "/blog/partner-documents-and-privacy",
  metaTitle: "Partner Documents: What WayTara Asks For and How It Is Protected",
  metaDescription: "The documents a WayTara partner is asked for at onboarding, why, who can open them, and why an Aadhaar number is never collected in full.",
  name: "Partner documents and privacy",
  eyebrow: "Partners and licences",
  title: "Partner documents:",
  accent: "what we ask, how we protect them.",
  answer:
    "You give us only a few details to apply. If you are shortlisted, we ask for documents so we can verify your business and your people. They are kept private, opened only by the people doing the verification, and not shared with customers, other partners or anyone else, except where the law requires it.",
  inShort: [
    "Nothing is asked for in the first form: no licence, no ID, no documents.",
    "At onboarding we ask for business details, licences, certificates, your team and some past work.",
    "We never ask for a full Aadhaar number. Where an identity proof is needed, we ask for a masked copy.",
    "Documents are used only to verify you. They are not shown to customers or other partners, and they are not sold or used for advertising.",
  ],
  sections: [
    {
      id: "asked",
      badge: "What we ask",
      title: "What we ask for,",
      accent: "and why.",
      summary: "Only for shortlisted applicants, and only what verification needs.",
      blocks: [
        {
          type: "cols",
          items: [
            { title: "Your business", body: "The legal name and address, the GST registration if you have one, and the business PAN. This identifies the business we would sign an agreement with." },
            { title: "Licences and certificates", body: "A copy of the contractor licence, and the certificates of your supervisor and wiremen, so we can check them with the issuing authority." },
            { title: "Your team and your work", body: "The people who would do the work, the districts you cover, and photographs or references from projects you have done." },
          ],
        },
        {
          type: "note",
          title: "Identity proof and Aadhaar",
          body: "Where an identity proof is needed, usually for an individual technician, we ask for a masked Aadhaar copy, with all but the last four digits hidden. We never ask for the full number, an OTP or biometric details. If you prefer, another proof of identity can be used.",
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
            "Documents are kept in private storage that cannot be reached from the web.",
            "Only authorised WayTara staff doing the verification can open them, from the admin app.",
            "We do not show them to customers or other partners, and we do not sell them or use them for advertising.",
            "We share them with no one outside WayTara, except where the law requires it, such as an order from a court or a government authority with the right to ask.",
            "Checking a licence or certificate number with the Board that issued it is part of verification.",
          ],
        },
        { type: "p", text: "You can ask to see what we hold about you, to correct it, or to have it deleted, as the Privacy Policy explains. The Partner Terms set out what you and WayTara agree to when you apply." },
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
      question: "Can I withdraw?",
      answer: "Yes. Tell us, and we will stop the review. You can also ask for your documents to be deleted, as the Privacy Policy explains.",
    },
  ],
  related: ["licence-grades", "competency-certificates", "working-under-a-contractor"],
  updated: UPDATED,
  updatedLabel: UPDATED_LABEL,
  category: "Partners and licences",
  cta: PARTNER_CTA,
};

const gateway: Guide = {
  slug: "waytara-gateway",
  path: "/blog/waytara-gateway",
  metaTitle: "The WayTara Gateway: What It Connects and What It Does",
  metaDescription: "What the WayTara gateway is, which equipment it connects, why it needs only one internet connection, and what monitoring and control mean.",
  name: "The WayTara gateway",
  eyebrow: "Gateway and integration",
  title: "The WayTara gateway:",
  accent: "what it does.",
  answer:
    "The WayTara gateway is a small box at your site that connects your inverters, batteries and meters and shares one internet connection with the WayTara platform. Chargers connect to the platform directly instead.",
  inShort: [
    "One connection for many devices: each device does not need a network of its own.",
    "Deye hybrid inverters are supported today. Other makes and models are assessed and added after testing on real equipment.",
    "OCPP 1.6J chargers connect to the platform directly, without the gateway.",
    "What can be read or controlled depends on the make, model and enabled features of each device.",
  ],
  sections: [
    {
      id: "parts",
      badge: "The parts",
      title: "One box,",
      accent: "one platform.",
      blocks: [
        {
          type: "cols",
          items: [
            { title: "The gateway", body: "Connects your inverters, batteries and meters, and shares a single connection with WayTara." },
            { title: "Energy management", body: "Live readings, history, alerts and reports for connected equipment, plus controls for the settings we have tested on supported equipment." },
            { title: "Charger management", body: "Status, sessions and remote controls for compatible OCPP chargers, in the same dashboard as your energy." },
          ],
        },
      ],
    },
    {
      id: "control",
      badge: "Monitor and control",
      title: "Monitor, and control",
      accent: "within limits.",
      blocks: [
        { type: "p", text: "Everything supported can be monitored. Control covers selected, tested settings on supported inverters and the supported commands on compatible chargers." },
        { type: "note", title: "What it is not", body: "It is not unrestricted battery-management control or grid-scale dispatch. We do not promise automatic optimisation of solar, battery and charging unless a control policy has been set up and tested for your site." },
      ],
    },
  ],
  faqs: [
    {
      question: "Do I need to replace my existing inverter?",
      answer: "Often not. If your equipment is supported, the gateway brings it onto the platform. We check your make and model first.",
    },
    {
      question: "Does it need internet at my site?",
      answer: "Yes, one connection. The gateway shares it for all the equipment it connects. Chargers connect to the platform directly, so they need their own connection.",
    },
    {
      question: "Which equipment is supported?",
      answer: "Deye hybrid inverters today, and OCPP 1.6J chargers on the charging platform. Other equipment is assessed case by case, so send us the make and model.",
    },
  ],
  related: ["monitor-existing-solar", "connect-ev-charger-ocpp", "licence-grades"],
  updated: UPDATED,
  updatedLabel: UPDATED_LABEL,
  category: "Gateway and integration",
  cta: PLATFORM_CTA,
};

const existingSolar: Guide = {
  slug: "monitor-existing-solar",
  path: "/blog/monitor-existing-solar",
  metaTitle: "Adding Monitoring to a Solar System You Already Have",
  metaDescription: "How to bring an existing inverter and battery onto the WayTara platform without replacing them: what to check, what to send us, and what to expect.",
  name: "Monitoring an existing solar system",
  eyebrow: "Gateway and integration",
  title: "Adding monitoring to a solar system",
  accent: "you already have.",
  answer:
    "You often do not need to replace a working inverter to see and manage it. If your equipment is supported, the gateway brings it onto the WayTara platform. If it is not, we assess it case by case, so send us the make and model first.",
  inShort: [
    "Compatibility decides the route, so start with the make and model.",
    "Deye hybrid inverters are supported through the gateway today. Others are assessed and added after testing.",
    "Control means selected, tested settings on supported equipment. It is not unrestricted battery control.",
    "The site needs one internet connection for the gateway.",
  ],
  sections: [
    {
      id: "steps",
      badge: "The steps",
      title: "Three steps,",
      accent: "no commitment.",
      blocks: [
        {
          type: "steps",
          items: [
            { title: "We read your make and model", body: "We check it against the equipment WayTara supports." },
            { title: "We tell you what connecting involves", body: "Whether it uses the gateway or the charger's own connection, and what that would take." },
            { title: "You decide", body: "You do not need to replace anything to ask." },
          ],
        },
      ],
    },
    {
      id: "ready",
      badge: "Have ready",
      title: "What to have",
      accent: "ready.",
      blocks: [
        { type: "list", items: ["The make and model of the inverter, the battery and any meter", "A photo of each rating plate, if you can", "Whether the site has an internet connection"] },
        { type: "p", text: "Fitting the gateway at an existing site can involve electrical work, which must be done by appropriately licensed and qualified people. We tell you what is involved before you decide." },
      ],
    },
  ],
  faqs: [
    {
      question: "What if my inverter is not on the supported list?",
      answer: "Tell us the make and model. Other equipment is assessed case by case, and added only after testing on real equipment.",
    },
    {
      question: "Will it switch my battery and solar automatically?",
      answer: "Not as a general feature. We do not promise automatic solar-following or battery-aware charging unless a control policy has been set up and tested for your site.",
    },
  ],
  related: ["waytara-gateway", "connect-ev-charger-ocpp"],
  updated: UPDATED,
  updatedLabel: UPDATED_LABEL,
  category: "Gateway and integration",
  cta: PLATFORM_CTA,
};

const evOcpp: Guide = {
  slug: "connect-ev-charger-ocpp",
  path: "/blog/connect-ev-charger-ocpp",
  metaTitle: "Connecting an EV Charger to WayTara: What OCPP Means",
  metaDescription: "What OCPP is, why WayTara supports OCPP 1.6J chargers, what you can see and control, and what to ask your charger's maker.",
  name: "Connecting an EV charger (OCPP)",
  eyebrow: "EV charging",
  title: "Connecting an EV charger:",
  accent: "what OCPP means.",
  answer:
    "OCPP is the language a charger uses to talk to a charge point management system. WayTara supports OCPP 1.6J chargers, which connect to the platform directly over the internet. What you can see and control depends on what your charger and its firmware support.",
  inShort: [
    "OCPP 1.6J chargers connect to WayTara over the internet. They do not need the gateway.",
    "The functions available depend on each charger's supported OCPP features and firmware.",
    "Each charger needs its own internet connection.",
    "OCPP 2.0.1 is a different version and is not backward compatible with 1.6, so ask which version your charger speaks.",
  ],
  sections: [
    {
      id: "what",
      badge: "What it means",
      title: "What OCPP",
      accent: "gives you.",
      blocks: [
        { type: "p", text: "A charger that speaks OCPP can report its status and sessions to a management platform and accept commands such as starting or stopping a session. In WayTara that sits in the same dashboard as your energy." },
        { type: "note", title: "Limits", body: "Control covers the supported commands on compatible chargers. The functions available depend on the charger's own OCPP features and firmware." },
      ],
    },
    {
      id: "ask",
      badge: "Ask the maker",
      title: "Three things",
      accent: "to ask.",
      blocks: [
        { type: "list", items: ["Which OCPP version the charger supports", "Whether it can be pointed at a different management platform", "Which firmware version it runs, and whether it can be updated"] },
        { type: "p", text: "The electrical installation of a charger, the circuit, its protection, earthing and testing, is electrical work for appropriately licensed and qualified people. The platform does not replace it." },
      ],
    },
  ],
  faqs: [
    {
      question: "Does my charger need the gateway?",
      answer: "No. Chargers connect to the platform directly over the internet. The gateway is for inverters, batteries and meters.",
    },
    {
      question: "What if my charger does not support OCPP 1.6J?",
      answer: "Tell us the make and model. Other equipment is assessed case by case.",
    },
  ],
  related: ["waytara-gateway", "monitor-existing-solar", "working-under-a-contractor"],
  updated: UPDATED,
  updatedLabel: UPDATED_LABEL,
  category: "EV charging",
  cta: PLATFORM_CTA,
};

const antiIslanding: Guide = {
  slug: "why-solar-stops-in-a-power-cut",
  path: "/blog/why-solar-stops-in-a-power-cut",
  metaTitle: "Why Grid-Connected Solar Stops in a Power Cut, and What the Rules Say",
  metaDescription: "Why an on-grid solar system switches off when the grid fails, what the CEA connectivity regulations require, how inverters are tested in India, and what you need to have power during a cut.",
  name: "Why solar stops in a power cut",
  eyebrow: "Solar systems",
  title: "Why your solar stops in a power cut,",
  accent: "and what the rules say.",
  answer:
    "A grid-connected solar system switches itself off when the grid goes down. That is not a fault: Indian rules require it, so that your system never keeps a dead line energised. To have power during a cut, the system has to be designed for it.",
  inShort: [
    "An on-grid inverter must stop energising the grid within two seconds of an unintended island forming. That is a requirement of the CEA connectivity regulations, not a maker's choice.",
    "After the grid returns, the inverter does not restart at once: the regulations require voltage and frequency to be within limits and stable for at least sixty seconds first.",
    "Inverters sold in India are tested for islanding prevention to IS 16169:2019, which is the same test procedure as IEC 62116:2014.",
    "Power during a cut needs a design that provides it, such as a battery with a hybrid inverter and a proper changeover. Do not ask anyone to switch the protection off.",
  ],
  sections: [
    {
      id: "island",
      badge: "The idea",
      title: "What an island is,",
      accent: "and why it matters.",
      blocks: [
        { type: "p", text: "In the regulations, an unintended island is a part of the electricity system that stays energised by one or more distributed generation resources, such as rooftop solar, after that part has been isolated from the rest of the system." },
        { type: "p", text: "For a home with solar, that would mean your roof system keeping the street's wires live after the utility has switched the supply off. People working on those wires would be working on a line that is not dead. That is the danger the rules are written to prevent." },
      ],
    },
    {
      id: "rules",
      badge: "The rules",
      title: "What the regulations",
      accent: "require.",
      summary: "Regulation 11(6) of the CEA connectivity regulations, as amended in 2019.",
      blocks: [
        {
          type: "cols",
          items: [
            { title: "Stop within two seconds", body: "A generator connected in parallel with the grid must have a function that prevents it from contributing to an unintended island, and makes it cease to energise the system within two seconds of one forming. This is regulation 11(6)(e)." },
            { title: "Never energise a dead line", body: "It must also have voltage and frequency sensing with a time delay, so that it does not energise a de-energised circuit. This is regulation 11(6)(d)." },
            { title: "Wait before reconnecting", body: "After a stop, it may reconnect only when voltage and frequency are within the prescribed limits and have been stable for at least sixty seconds. This is also regulation 11(6)(d)." },
          ],
        },
        {
          type: "p",
          text: "The same regulation also makes the system disconnect when the grid itself is abnormal: on over- or under-voltage (trip levels of 110% and 80%, clearing within up to two seconds) and on over- or under-frequency (trip levels of 50.5 Hz and 47.5 Hz, clearing within up to 0.2 seconds), and when there is a fault in the circuit it is connected to. The utility may set narrower ranges.",
        },
        { type: "note", title: "Which rules these are", body: "They are the Central Electricity Authority's technical standards for connecting distributed generation below 33 kV, as consolidated with the first amendment of 2019. Regulations can be amended, so check the current text on the CEA website." },
      ],
    },
    {
      id: "tested",
      badge: "How it is tested",
      title: "How inverters are",
      accent: "tested in India.",
      blocks: [
        { type: "p", text: "IEC 62116 gives a test procedure to evaluate how well the islanding prevention measures of utility-interconnected photovoltaic inverters work. In India the same procedure is IS 16169." },
        { type: "p", text: "A BIS letter of 26 March 2025 explains that the Solar Systems, Devices and Components Goods Order, 2025 replaces the 2017 order and brings in the revised IS 16169:2019 (IEC 62116:2014) in place of IS 16169:2014 (IEC 62116:2008). It says the voltage and frequency trip settings used in the test must follow the CEA regulations, and that from 27 July 2025 no new licence for utility-interconnected inverters is granted without meeting the new order." },
        { type: "p", text: "When you buy a system, ask for the inverter's BIS registration and test report for the exact model. We do not publish a list of approved models here." },
      ],
    },
    {
      id: "backup",
      badge: "Power in a cut",
      title: "Getting power",
      accent: "during a cut.",
      blocks: [
        { type: "p", text: "A standard on-grid system gives no backup, because it has to stop. To keep selected loads running in a cut, the system needs to be designed for it: typically a battery and a hybrid inverter, with the loads you want on a backed-up circuit and a changeover that disconnects the house from the grid while it runs." },
        { type: "list", items: ["Decide which loads must keep running, such as lights, fans, a fridge and the router", "Size the battery and the inverter to those loads", "Have the changeover and wiring done by appropriately licensed and qualified people", "Ask what happens when the battery is empty, and how long the sun alone can carry the loads"] },
        { type: "note", title: "No promise of hours", body: "How long a system keeps loads running depends on the battery, the loads and the sun that day. We do not promise a duration. See the guide on on-grid, hybrid and off-grid solar for how the types differ." },
      ],
    },
  ],
  faqs: [
    {
      question: "Is my solar system broken if it stops in a power cut?",
      answer: "No. An on-grid system stopping when the grid fails is the required behaviour. It is working as the regulations intend.",
    },
    {
      question: "Why does it take a minute or more to start again after power returns?",
      answer: "The regulations require voltage and frequency to be within limits and stable for at least sixty seconds before a system reconnects. That is a minimum. The exact delay on your inverter is in its manual.",
    },
    {
      question: "Can the protection be switched off so I get backup?",
      answer: "No. The function is a requirement of the regulations, and it protects the people working on the grid. A system has power in a cut by being designed for it, with a changeover, not by disabling protection.",
    },
    {
      question: "Does a battery change this?",
      answer: "A battery with a hybrid inverter can be designed to supply selected loads while the grid is down. It depends on how the system is designed and installed, which is why the loads, the battery and the changeover are chosen together.",
    },
  ],
  related: ["clean-and-maintain-rooftop-solar", "good-solar-monitoring", "on-grid-hybrid-off-grid-solar"],
  updated: UPDATED,
  updatedLabel: UPDATED_LABEL,
  category: "Solar systems",
};

const solarCare: Guide = {
  slug: "clean-and-maintain-rooftop-solar",
  path: "/blog/clean-and-maintain-rooftop-solar",
  metaTitle: "Cleaning and Maintaining Rooftop Solar Panels: What the Research Says",
  metaDescription: "How dirt affects solar output, how to clean panels safely, how to decide how often, and what to look after on the inverter, based on the NREL operation and maintenance guide.",
  name: "Cleaning and caring for rooftop solar",
  eyebrow: "Solar systems",
  title: "Cleaning and caring for",
  accent: "rooftop solar.",
  answer:
    "Most rooftop solar needs little attention: keep the panels reasonably clean, look over the system now and then, and watch its output. How much cleaning is worth doing depends on your dust, birds and rain, so let your own energy readings guide you.",
  inShort: [
    "Dirt reduces output, and uneven dirt, such as bird droppings, can cause hot spots in a module.",
    "Follow the module maker's cleaning instructions. The NREL guide recommends plain demineralised water and a mild detergent the maker approves, and advises against high-pressure water, brushes, solvents, abrasives and harsh detergents.",
    "The studies it reviews report annual soiling losses of 4.3% to 7.5%, with many near 6%, but rates vary widely by place. It notes reports of about 1.5% a day during dust storms in places such as India.",
    "Rain helps, but light rain cleans little and can even add soiling when dust sticks to the droplets.",
    "Roof work is dangerous. Do not go onto a roof you cannot work on safely.",
  ],
  sections: [
    {
      id: "why",
      badge: "Why it matters",
      title: "What dirt",
      accent: "does.",
      blocks: [
        { type: "p", text: "Soiling reduces the energy a solar array produces. If it is uneven, for example from bird droppings, it can also lead to localised hot-spot failures in the module, which is why uneven dirt is the kind to deal with first." },
        { type: "p", text: "How fast panels get dirty depends on where they are. The NREL guide collects reported rates: typically about 0.05% of output lost per day, but about 0.36% a day in an area of heavy agricultural activity compared with 0.01% a day in a desert with no agriculture, construction or industry nearby. It reports up to about 0.5% a day with large bird populations, and around 1.5% a day during dust storms in places such as India. These are figures from studies, not a prediction for your roof." },
      ],
    },
    {
      id: "how",
      badge: "How to clean",
      title: "How to clean",
      accent: "safely.",
      blocks: [
        {
          type: "steps",
          items: [
            { title: "Read the maker's advice", body: "Follow the module manufacturer's recommendations for cleaning. They can set conditions for your warranty." },
            { title: "Use gentle methods", body: "The NREL guide suggests plain demineralised water and a mild detergent that the manufacturer recommends, applied with a bucket, a strip cleaner and a squeegee, with overlapping vertical strokes as for window glass." },
            { title: "Avoid what scratches", body: "Do not use high-pressure water, brushes, solvents, abrasives or harsh detergents, which can damage the glass and coating." },
          ],
        },
        { type: "p", text: "Care must be taken to avoid damaging the components. For a large system, robotic cleaning exists, and some of these need the array to be designed to accommodate them." },
      ],
    },
    {
      id: "often",
      badge: "How often",
      title: "How often is",
      accent: "worth it?",
      blocks: [
        { type: "p", text: "The guide's point is that the right interval is a local cost-and-benefit question. It depends on what a cleaning costs, how quickly dirt builds up as a loss of power, how sunny the place is, what each unit of electricity is worth, and how efficient the modules are." },
        {
          type: "cols",
          items: [
            { title: "Rain does some of the work", body: "Heavy rain gives a nearly complete cleaning effect. Light rain cleans much less and can increase soiling if dust then sticks to sparse droplets." },
            { title: "Cleaning is not always worth it", body: "In one US study the guide cites, a single yearly cleaning cut a 1.91% annual soiling loss to 1.52%, two cleanings to 1.32% and three to 1.20%. It concluded that routine cleaning was not cost-effective for the systems studied." },
            { title: "Special conditions change this", body: "Where there is heavy dust, large bird populations or other special sources of dirt, the guide says cleaning is required on a schedule that depends on the source and nature of the soiling." },
          ],
        },
        { type: "note", title: "Your readings decide", body: "That study was in a US desert climate, so do not copy its answer. Watch your own energy output after dusty weeks and after rain: a clear step up after a wash tells you it was worth it." },
      ],
    },
    {
      id: "inverter",
      badge: "The electrical side",
      title: "Looking after",
      accent: "the inverter.",
      blocks: [
        { type: "p", text: "The guide notes that inverter failure is one of the most frequent causes of loss of performance in a PV system, and that the best preventive maintenance is to carry out the manufacturer's required maintenance. It names, for example, re-tightening current-carrying connections and thermal imaging of electrical connections and components. It also says inverter air filters take in dust in windy or dusty conditions, so a filter clean or swap should follow such conditions." },
        { type: "p", text: "Opening an inverter or its connections is electrical work. It must be done by appropriately licensed and qualified people, not by the owner." },
      ],
    },
    {
      id: "safety",
      badge: "Safety",
      title: "Stay safe",
      accent: "on the roof.",
      blocks: [
        { type: "p", text: "The guide lists roof fall protection and electrocution among the hazards of special importance to people who maintain PV systems, and says every worker needs at least basic safety training." },
        { type: "list", items: ["Do not clean from a roof edge or a surface you cannot stand on safely", "Hire people with fall protection and safety training for a high or sloping roof", "Never touch cables, connectors or the inverter's wiring", "Leave anything electrical to qualified people"] },
      ],
    },
  ],
  faqs: [
    {
      question: "Can I use a pressure washer?",
      answer: "The NREL guide advises against high-pressure water, and against brushes, solvents, abrasives and harsh detergents. Check your module maker's instructions as well.",
    },
    {
      question: "How often should I clean?",
      answer: "There is no single answer. It depends on your dust, birds and rain, and on the cost of a clean. Compare your energy output before and after a clean, and watch it over a few weeks.",
    },
    {
      question: "Does rain clean my panels enough?",
      answer: "Heavy rain does a nearly complete clean. Light rain cleans much less and can even leave dust stuck to droplets.",
    },
    {
      question: "Who should check the inverter and wiring?",
      answer: "Appropriately licensed and qualified people, following the inverter maker's required maintenance. It is not owner work.",
    },
  ],
  sources: [
    {
      label: "H. A. Walker, Best Practices for Operation and Maintenance of Photovoltaic and Energy Storage Systems, 3rd edition, NREL/TP-7A40-73822, December 2018",
      url: "https://www.osti.gov/biblio/1489002",
      note: "Section 5.7.1 (cleaning), the inverter maintenance passage in section 5.2, and the health and safety section. Its data come mostly from studies in the United States, which is why we tell you to test the advice on your own roof.",
    },
  ],
  related: ["good-solar-monitoring", "why-solar-stops-in-a-power-cut", "waytara-gateway"],
  updated: UPDATED,
  updatedLabel: UPDATED_LABEL,
  category: "Solar systems",
};

const solarMonitoring: Guide = {
  slug: "good-solar-monitoring",
  path: "/blog/good-solar-monitoring",
  metaTitle: "What Good Solar Monitoring Should Show You",
  metaDescription: "The three questions monitoring should answer, what availability, performance ratio and performance index mean, and what to ask before you trust a dashboard.",
  name: "What good solar monitoring shows",
  eyebrow: "Solar systems",
  title: "What good solar monitoring",
  accent: "should show you.",
  answer:
    "Good monitoring answers three questions: is the system running, is it producing what it should for today's weather, and what has it done over time. A single 'kWh today' number answers none of them well.",
  inShort: [
    "Monitoring is more than a chart: NREL's guide describes it as watching system status, alarms and diagnostics, and comparing results with an expected benchmark.",
    "Availability (was it running?) and performance (did it produce what it should?) are different, and you need both. A system can be available 95% of the time and still perform at 100% of expectation when it runs.",
    "Performance ratio is a common measure, but it moves with the seasons and is higher in winter and lower in summer. A performance index, which compares measured output with what the weather should have produced, is steadier.",
    "WayTara shows live readings, history, alerts and reports for connected, supported equipment. What can be read depends on the make, model and features of each device.",
  ],
  sections: [
    {
      id: "questions",
      badge: "Three questions",
      title: "Three questions",
      accent: "to ask of any dashboard.",
      blocks: [
        {
          type: "steps",
          items: [
            { title: "Is it running?", body: "Status and alarms: whether the inverter is on, online and free of faults, and a warning when it is not." },
            { title: "Is it producing enough?", body: "Today's output compared with what the weather should give, not just a number with no yardstick." },
            { title: "What has it done?", body: "History over days, months and years, so you can see a slow decline and compare like with like." },
          ],
        },
      ],
    },
    {
      id: "numbers",
      badge: "The numbers",
      title: "Three measures",
      accent: "worth knowing.",
      summary: "As the NREL operation and maintenance guide describes them.",
      blocks: [
        {
          type: "cols",
          items: [
            { title: "Availability", body: "How much of the time the system was able to produce. Time when it is not available is lost energy." },
            { title: "Performance ratio", body: "Defined in IEC 61724-1. The standard definition has no temperature correction, so it is usually higher in winter and lower in summer, and different definitions of it exist, which can stop direct comparisons." },
            { title: "Performance index", body: "Compares the measured power or energy with the expected power or energy, worked out from measured weather and irradiance and a model the people involved have agreed. It is more consistent than a performance ratio." },
          ],
        },
        { type: "p", text: "The guide's point is that you need both a downtime measure and an energy measure. It gives the example of a system with availability of 95% but a weather-adjusted performance ratio of 100%: it produced what it should when it ran, but it was not running all the time." },
      ],
    },
    {
      id: "why",
      badge: "Why it matters",
      title: "Why watching",
      accent: "pays off.",
      blocks: [
        { type: "p", text: "The guide says inverter failure is one of the most frequent causes of performance loss in a PV system. A fault that is noticed the same day costs a day of output. One that is noticed at the next electricity bill can cost weeks." },
        { type: "list", items: ["Alerts when the inverter goes offline or reports a fault", "A comparison with expected output, not only a daily total", "History you can look back over", "Reports you can share with whoever maintains the system"] },
      ],
    },
    {
      id: "waytara",
      badge: "At WayTara",
      title: "What our platform",
      accent: "shows.",
      blocks: [
        { type: "p", text: "WayTara's platform gives live readings, history, alerts and reports for connected equipment, plus controls for the settings we have tested on supported equipment. Deye hybrid inverters are supported today, and other makes and models are assessed and added after testing on real equipment." },
        { type: "note", title: "What it does not claim", body: "What can be read or controlled depends on the make, model and enabled features of each device. We do not promise optimisation of solar, battery and charging unless a control policy has been set up and tested for your site." },
      ],
    },
  ],
  faqs: [
    {
      question: "Is a good performance ratio the same everywhere?",
      answer: "No. The guide says a performance ratio that is fine for one location may not be for another, and that it varies with the seasons. Compare your own system with itself over time, and with the expected output for the weather.",
    },
    {
      question: "My dashboard only shows total kWh. Is that enough?",
      answer: "It tells you what happened, not whether it was good. Ask for alerts when the system stops, and a comparison with expected output.",
    },
    {
      question: "Can WayTara monitor an inverter I already have?",
      answer: "If it is supported, yes, through the gateway. Send us the make and model and we will tell you what connecting involves, with no commitment.",
    },
  ],
  sources: [
    {
      label: "H. A. Walker, Best Practices for Operation and Maintenance of Photovoltaic and Energy Storage Systems, 3rd edition, NREL/TP-7A40-73822, December 2018",
      url: "https://www.osti.gov/biblio/1489002",
      note: "The monitoring function, and section 6.1 on key performance indicators: availability, performance ratio and performance index.",
    },
  ],
  related: ["clean-and-maintain-rooftop-solar", "monitor-existing-solar", "waytara-gateway"],
  updated: UPDATED,
  updatedLabel: UPDATED_LABEL,
  category: "Solar systems",
  cta: PLATFORM_CTA,
};

const ocppVersions: Guide = {
  slug: "ocpp-1-6-or-2-0-1",
  path: "/blog/ocpp-1-6-or-2-0-1",
  metaTitle: "OCPP 1.6J or 2.0.1: What the Version Means for Your EV Charger",
  metaDescription: "What OCPP is, how version 1.6 and version 2.0.1 differ according to the Open Charge Alliance, why they are not compatible, and what to ask about your charger.",
  name: "OCPP 1.6J or 2.0.1",
  eyebrow: "EV charging",
  title: "OCPP 1.6J or 2.0.1:",
  accent: "what the version means.",
  answer:
    "OCPP is the open protocol chargers use to talk to a charging management system. Version 1.6 (2015) became the most widely used, and version 2.0.1 (2020) is a big step forward that is not backward compatible. A charger and its management system must speak the same version. WayTara supports OCPP 1.6J chargers.",
  inShort: [
    "The Open Charge Alliance calls OCPP the industry-supported de facto standard for communication between a charging station and a management system, and an open standard with no cost or licensing barriers.",
    "OCPP 2.0.1 is not an incremental extension of 1.6 and is not backward compatible with it.",
    "Future releases, such as 2.1, are meant to stay backward compatible with 2.0.1.",
    "Which version your charger speaks decides which platforms it can connect to, so ask its maker.",
  ],
  sections: [
    {
      id: "what",
      badge: "What it is",
      title: "What OCPP",
      accent: "does.",
      blocks: [
        { type: "p", text: "OCPP lets a charging station report its status and sessions to a charging station management system and accept commands from it. The Open Charge Alliance says it has been around since 2010, was first used in Western Europe, and became the de facto standard once version 1.6, released in 2015 with support for smart charging, was adopted by manufacturers around the world." },
        { type: "p", text: "The Alliance says OCPP has to serve both simple, low-cost home chargers and high-power fast chargers with several connectors, and has to stay usable by low-cost stations with limited memory and processing power." },
      ],
    },
    {
      id: "differences",
      badge: "The differences",
      title: "1.6J and 2.0.1",
      accent: "side by side.",
      summary: "As the Open Charge Alliance describes them in its white paper.",
      blocks: [
        {
          type: "compare",
          columns: ["OCPP 1.6J", "OCPP 2.0.1"],
          rows: [
            { label: "Released", cells: ["2015", "2020"] },
            { label: "Transactions", cells: ["Reported through StartTransaction, StopTransaction, MeterValue and StatusNotification", "One TransactionEvent message for everything about a transaction"] },
            { label: "Transaction IDs", cells: ["Created by the management system, so an offline charger makes temporary ones", "Created by the charger, with sequence numbers to restore the order"] },
            { label: "Configuration and monitoring", cells: ["Limited reporting through StatusNotification", "A device model: inventory reporting, better error and state reporting, configurable monitoring"] },
            { label: "Security", cells: ["Added later by an Alliance extension for 1.6-J", "Three security profiles, client certificate key management, signed firmware updates and a security event log"] },
            { label: "ISO 15118 and Plug & Charge", cells: ["Plug & Charge possible through an Alliance customisation", "ISO 15118-2 fully supported, including Plug & Charge and smart charging input from the car"] },
          ],
        },
        { type: "p", text: "The Alliance says 2.0.1 uses many of the same concepts and even shares some messages with 1.6, but the changes to transaction handling and the new device model mean the two are not compatible." },
      ],
    },
    {
      id: "yours",
      badge: "For you",
      title: "What to ask",
      accent: "about your charger.",
      blocks: [
        { type: "list", items: ["Which OCPP version it supports, and whether the 'J' (JSON) variant is used", "Whether it can be pointed at a management platform of your choice", "Which firmware it runs, and whether the maker can update it", "Which features it supports, since a platform can only use what the charger offers"] },
        { type: "note", title: "At WayTara", body: "We support OCPP 1.6J chargers, and the functions available depend on each charger's supported OCPP features and firmware. Other equipment is assessed case by case, so send us the make and model." },
      ],
    },
  ],
  faqs: [
    {
      question: "Can I upgrade a 1.6J charger to 2.0.1?",
      answer: "The two versions are not interchangeable, and whether a given charger can move to 2.0.1 is up to its maker and its hardware and firmware. Ask the maker.",
    },
    {
      question: "Is OCPP free to use?",
      answer: "The Open Charge Alliance describes it as an open standard with no cost or licensing barriers for adoption.",
    },
    {
      question: "Does OCPP make my charger safe?",
      answer: "No. It is a communication protocol. The electrical installation of a charger is separate work for appropriately licensed and qualified people.",
    },
  ],
  sources: [
    {
      label: "Open Charge Alliance, What is new in OCPP 2.0.1, white paper version 1.0, March 2023",
      url: "https://openchargealliance.org/ocpp-info-whitepapers/what-is-new-in-ocpp-2-0-1/",
      note: "Sections 1 to 3: the history of OCPP, the incompatibility of 2.0.1 with 1.6, the device model, transaction handling, ISO 15118 and security, and the plan for 2.1.",
    },
    { label: "The white paper as a PDF", url: "https://www.openchargealliance.org/wp-content/uploads/2024/01/new_in_ocpp_201-v10.pdf" },
  ],
  related: ["connect-ev-charger-ocpp", "waytara-gateway", "working-under-a-contractor"],
  updated: UPDATED,
  updatedLabel: UPDATED_LABEL,
  category: "EV charging",
  cta: PLATFORM_CTA,
};

// The sources of the articles written earlier.
licenceGrades.sources = [
  {
    label: "Tamil Nadu Electrical Inspectorate: Approved Contractors List",
    url: "https://tnei.tn.gov.in/pages/display/61-approved-contractors-list",
    note: "States the scope of ESA (no limitation in voltage or capacity), EA (up to and inclusive of 33 kV) and ESB (up to 650 V). The page does not state a scope for EB.",
  },
  { label: "Tamil Nadu Electrical Licensing Board", url: "https://tnelb.gov.in", note: "The Board that issues contractor licences and competency certificates. Check its current rules." },
];
competencyCertificates.sources = [
  {
    label: "TNELB Form S: application for a Supervisor Competency Certificate",
    url: "https://tnelb.gov.in/Forms/FrmSen.pdf",
    note: "The qualification and experience listed on the form's instructions, and the question about a Wireman or Wireman Helper certificate.",
  },
  { label: "Tamil Nadu Electrical Licensing Board", url: "https://tnelb.gov.in" },
];
gateway.sources = [{ label: "WayTara platform: how it connects, what it supports", url: "/technology", note: "The statements on supported equipment and on control come from this page." }];
evOcpp.sources = [{ label: "Open Charge Alliance: OCPP 1.6 and 2.0.1", url: "https://openchargealliance.org/ocpp-info-whitepapers/what-is-new-in-ocpp-2-0-1/" }];
antiIslanding.sources = [
  {
    label: "CEA (Technical Standards for Connectivity of the Distributed Generation Resources) Regulations, 2013, with the First Amendment, 2019",
    url: "https://www.cbip.org/cearegulations/CEA%20DATA/Connectivity/Connectivity%20Regulation/Con%20Coneectivity%20Regulations%202013.pdf",
    note: "Regulation 2(1)(m) (definition of an unintended island) and regulation 11(6)(a) to (e) (protective functions). A PDF download.",
  },
  {
    label: "Bureau of Indian Standards: Guidelines for Implementation of Revised QCO for Utility-Interconnected Photovoltaic Inverters, 26 March 2025",
    url: "https://www.crsbis.in/BIS/app_srv/tdc/gl/docs/changeover_guidelines_IS_16169_V2_final.pdf",
    note: "IS 16169:2019 / IEC 62116:2014, the trip-setting rule, and the 27 July 2025 date. A PDF download.",
  },
  { label: "IEC 62116:2014, Utility-interconnected photovoltaic inverters: test procedure of islanding prevention measures", url: "https://webstore.iec.ch/en/publication/6479", note: "The scope of the standard, from the IEC webstore." },
];

export const BLOG_POSTS: Guide[] = [licenceGrades, competencyCertificates, workingUnderContractor, partnerDocuments, gateway, existingSolar, evOcpp, ocppVersions, antiIslanding, solarCare, solarMonitoring];
export const BLOG_BY_SLUG: Record<string, Guide> = Object.fromEntries(BLOG_POSTS.map((p) => [p.slug, p]));

/** An article by slug, from the blog or from the older guides. */
export function findArticle(slug: string): Guide | undefined {
  return BLOG_BY_SLUG[slug] ?? GUIDES[slug];
}

export interface ArticleCard {
  slug: string;
  path: string;
  title: string;
  excerpt: string;
  category: BlogCategory;
  minutes: number;
  date: string;
  dateLabel: string;
}

function words(g: Guide): number {
  const text: string[] = [g.answer, ...g.inShort];
  for (const s of g.sections)
    for (const b of s.blocks) {
      if (b.type === "p") text.push(b.text);
      else if (b.type === "list") text.push(...b.items);
      else if (b.type === "steps" || b.type === "cols") text.push(...b.items.flatMap((i) => [i.title, i.body]));
      else if (b.type === "note") text.push(b.title, b.body);
      else if (b.type === "compare") text.push(...b.rows.flatMap((r) => [r.label, ...r.cells]));
    }
  for (const f of g.faqs) text.push(f.question, f.answer);
  return text.join(" ").split(/\s+/).filter(Boolean).length;
}

const card = (g: Guide): ArticleCard => ({
  slug: g.slug,
  path: g.path,
  title: `${g.title} ${g.accent}`.replace(/\s+/g, " ").trim(),
  excerpt: g.metaDescription,
  category: (g.category as BlogCategory | undefined) ?? "Solar and subsidy",
  minutes: Math.max(2, Math.round(words(g) / 200)),
  date: g.updated,
  dateLabel: g.updatedLabel,
});

/** Every article, newest first, for the hub: the blog posts and the older guides. */
export const ARTICLES: ArticleCard[] = [...BLOG_POSTS, ...GUIDE_LIST].map(card).sort((a, b) => b.date.localeCompare(a.date));

/** The groups at the top of the hub: a decision, and the articles that help with it. */
export const BLOG_STARTS: { title: string; body: string; slugs: string[] }[] = [
  { title: "Partner with WayTara", body: "Licences, certificates, documents and how we work with partners.", slugs: ["licence-grades", "competency-certificates", "working-under-a-contractor", "partner-documents-and-privacy"] },
  { title: "Connect your equipment", body: "The gateway, an existing solar system and EV chargers.", slugs: ["waytara-gateway", "monitor-existing-solar", "connect-ev-charger-ocpp", "ocpp-1-6-or-2-0-1"] },
  { title: "Look after your system", body: "Power cuts, cleaning and what good monitoring shows.", slugs: ["why-solar-stops-in-a-power-cut", "clean-and-maintain-rooftop-solar", "good-solar-monitoring"] },
  { title: "Solar, subsidy and bills", body: "Sizing, system types, the PM Surya Ghar subsidy and your bill.", slugs: ["solar-for-home", "solar-subsidy", "reduce-electricity-bill-solar"] },
];
