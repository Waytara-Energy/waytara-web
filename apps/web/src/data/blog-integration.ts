import type { Guide } from "./guides";
import { PLATFORM_CTA, UPDATED, UPDATED_LABEL } from "./blog-shared";

// Two articles written from primary documents: the Modbus specifications (serial line V1.02 of 20 December 2006, and the application protocol V1.1b3 of 26 April
// 2012, both from modbus.org) and the CEA safety regulations, 2023 (regulations 31, 32, 44 and chapter XI). What is said of the WayTara gateway is what the product does.

const MODBUS_SERIAL = {
  label: "Modbus.org: MODBUS over Serial Line, Specification and Implementation Guide V1.02, 20 December 2006",
  url: "https://www.modbus.org/file/secure/modbusoverserial.pdf",
  note: "Sections 2.1 and 2.2 (master and slaves, addresses), 2.5.1 (RTU framing), 3.2 (speeds) and 3.4 (devices, length, termination, polarisation, grounding). A PDF.",
};
const MODBUS_APP = {
  label: "Modbus.org: MODBUS Application Protocol Specification V1.1b3, 26 April 2012",
  url: "https://www.modbus.org/file/secure/modbusprotocolspecification.pdf",
  note: "Sections 4.2 to 4.4 (data encoding, data model, addressing) and 6.3 and 6.4 (the functions that read registers). A PDF.",
};
const MODBUS_PAGE = { label: "Modbus.org: Specifications and Implementation Guides", url: "https://modbus.org/modbus-specifications", note: "The official list of the specifications." };
const CEA_SAFETY = {
  label: "CEA (Measures relating to Safety and Electric Supply) Regulations, 2023, Gazette notification of 8 June 2023",
  url: "https://kseb.in/uploads/Downloadtemsuppy/Central%20Electricity%20Authority%20(Measures%20relating%20to%20Safety%20and%20Electric%20Supply)%20Regulations,%202023-1699594973944568556.pdf",
  note: "Regulations 31, 32 and 44, and Chapter XI (regulations 123 to 128). A copy hosted by KSEB; the official text is on the CEA website. A PDF.",
};

export const modbusExplained: Guide = {
  slug: "modbus-rs485-explained",
  path: "/blog/modbus-rs485-explained",
  metaTitle: "Modbus and RS-485 in Plain Words: How an Inverter Gets Read",
  metaDescription:
    "How Modbus works, what RS-485 wiring needs, what the specification says about addresses, speeds, cable length, termination and registers, and what to check when an inverter does not answer.",
  name: "Modbus and RS-485 explained",
  eyebrow: "Gateway and integration",
  title: "Modbus and RS-485 in plain words:",
  accent: "how an inverter gets read.",
  answer:
    "Modbus is a simple question-and-answer protocol: one master asks, a slave answers. RS-485 is the pair of wires it often travels on. A gateway that reads an inverter is a Modbus master asking for the inverter's registers over RS-485.",
  inShort: [
    "One master starts every exchange, and slaves only ever reply. Slave addresses run from 1 to 247, and 0 is for broadcast.",
    "RS-485 is a balanced two-wire pair plus a common. The specification calls the wires D0 and D1 (A and B on many devices). Makers do not always label them the same way, so swapping them is the first thing to try.",
    "The serial specification requires 9600 and 19200 bit/s, with even parity as the default. At 9600 bit/s a trunk can run up to 1,000 m on cable of AWG 26 or wider.",
    "Termination goes at the two ends of the trunk only. Biasing, where needed, goes in one place only.",
    "A register is a 16-bit word. The specification does not say what any register means; that is up to the inverter's maker. Register numbers in manuals and the addresses on the wire can differ by one.",
  ],
  sections: [
    {
      id: "idea",
      badge: "The idea",
      title: "Ask and answer,",
      accent: "one at a time.",
      summary: "How the Modbus serial protocol works.",
      blocks: [
        { type: "p", text: "Modbus is a small set of simple rules. The serial-line specification calls it a master and slaves protocol. Only one master is connected to the bus at a time, and up to 247 slaves share it." },
        {
          type: "steps",
          items: [
            { title: "The master asks", body: "A Modbus communication is always started by the master. It sends a request to one slave." },
            { title: "The slave answers", body: "The slave addressed processes the request and returns a reply. Slaves never send data without a request." },
            { title: "Nobody else talks", body: "Slaves never talk to each other, and the master starts only one transaction at a time." },
          ],
        },
        { type: "p", text: "There is also a broadcast mode, where the master sends a request to all slaves and no reply is returned. Broadcast requests are necessarily writing commands." },
      ],
    },
    {
      id: "addresses",
      badge: "Addresses",
      title: "Who is who",
      accent: "on the bus.",
      blocks: [
        {
          type: "cols",
          items: [
            { title: "0", body: "The broadcast address. All slaves must recognise it, and none reply." },
            { title: "1 to 247", body: "The addresses of individual slaves. Each must be unique on the bus." },
            { title: "248 to 255", body: "Reserved." },
          ],
        },
        { type: "p", text: "The master has no address of its own, only the slaves do. This is why an inverter's settings include a Modbus ID, which is its address on the bus: two devices with the same ID on one bus will answer over each other. The inverter we tested ships with ID 1 and 9600 bit/s as its defaults." },
      ],
    },
    {
      id: "wires",
      badge: "The wires",
      title: "What RS-485",
      accent: "needs.",
      blocks: [
        { type: "p", text: "The specification asks a new Modbus serial solution to use the RS-485 electrical standard, in a two-wire configuration: one balanced twisted pair that carries data in both directions, with only one driver transmitting at any time, plus a third conductor, the common, that links all the devices." },
        { type: "p", text: "The specification names the pair's two wires D0 and D1. D1 corresponds to the terminal many makers label B (or B'), and D0 to the one labelled A (or A'). It asks makers to use the names D0, D1 and Common in their documents so devices can work together. In practice labels differ, which is why 'swap A and B' is the standard first move when a device will not answer. On the first WayTara unit we set up, it fixed the fault." },
      ],
    },
    {
      id: "speed",
      badge: "Speed and framing",
      title: "Speed and",
      accent: "framing.",
      blocks: [
        {
          type: "list",
          items: [
            "9600 and 19200 bit/s are required, and 19200 is the required default. Other rates may be offered, such as 1200, 2400, 4800 and 38400",
            "In the usual RTU mode each byte is sent as 11 bits: one start bit, eight data bits, one parity bit and one stop bit",
            "Even parity is required and is the default. With no parity, two stop bits fill the character out",
            "Every message ends with a two-byte CRC, so a corrupted frame can be detected",
            "Frames are separated by a silent interval of at least 3.5 character times, and a message is at most 256 bytes",
            "Devices can work together only if they are all in the same transmission mode, and RTU is the default. In practice the speed and the parity must match as well",
          ],
        },
        { type: "p", text: "That last point is the source of many 'it does not answer' reports: a master set to 9600 baud with even parity cannot read a slave set to 19200 baud with no parity." },
      ],
    },
    {
      id: "cable",
      badge: "Cable and layout",
      title: "How to lay out",
      accent: "the bus.",
      summary: "The serial-line specification's rules for a multipoint RS-485 bus.",
      blocks: [
        {
          type: "compare",
          columns: ["What the specification says"],
          rows: [
            { label: "Length of the trunk", cells: ["For up to 9600 baud and AWG 26 or wider cable, a maximum of 1,000 m. Category 5 cable may be used up to 600 m. It depends on baud rate, cable and the number of loads"] },
            { label: "Branches", cells: ["Derivations must be short, never more than 20 m. With a multi-port tap of n branches, each is limited to 40 m divided by n"] },
            { label: "Number of devices", cells: ["32 are always allowed without a repeater. More are possible if the devices are documented for it, and a repeater can extend the bus"] },
            { label: "Line termination", cells: ["Needed near each of the two ends of the trunk, never more than two on a pair, never on a branch. A 150 ohm (0.5 W) resistor, or 120 ohms in series with a 1 nF capacitor where the pair is biased"] },
            { label: "Biasing (polarisation)", cells: ["If one or more devices need it, one pair of resistors, 450 to 650 ohms, at a single place on the whole bus, usually at the master. It reduces the number of devices allowed by four"] },
            { label: "The common conductor", cells: ["Connected directly to protective ground, preferably at one point only, usually at the master"] },
          ],
        },
        { type: "p", text: "A gateway and one inverter a few metres apart hardly need most of this. On a longer or busier bus, these are the rules to check first: the length, the branches, the ends and the common." },
      ],
    },
    {
      id: "registers",
      badge: "Registers",
      title: "What is in",
      accent: "a register.",
      summary: "From the application protocol specification.",
      blocks: [
        { type: "p", text: "Data in Modbus lives in tables. The one that matters for an inverter is registers, each a 16-bit word. The specification describes four tables: single-bit discrete inputs and coils, and 16-bit input registers and holding registers. Input registers are read-only. Holding registers can be read and written." },
        {
          type: "cols",
          items: [
            { title: "Reading", body: "Function 03 reads a block of holding registers and function 04 reads a block of input registers. A request may ask for 1 to 125 consecutive registers." },
            { title: "Big-endian", body: "A 16-bit value is sent with its more significant byte first, so 0x1234 goes out as 0x12 then 0x34." },
            { title: "Errors", body: "If a request cannot be carried out, the reply carries the function code plus 0x80 and an exception code, instead of data." },
          ],
        },
        { type: "note", title: "One off by one", body: "On the wire, registers are addressed from zero. The specification's own example says registers numbered 1 to 16 are addressed as 0 to 15. A manual may list register numbers or addresses, so check which a manual means before asking for register 100." },
        { type: "p", text: "The specification also says that how the data model maps onto a device's own memory is entirely specific to the maker. In practice, what a register means, its unit and its scale are in the inverter's own Modbus documentation, not in the specification." },
      ],
    },
    {
      id: "waytara",
      badge: "At WayTara",
      title: "How our gateway",
      accent: "uses Modbus.",
      blocks: [
        { type: "p", text: "The WayTara gateway is the master. It reads only the registers its register map lists, joins neighbouring registers into one request where the gap is small, and asks for each at its own interval, from every few seconds for fast-moving values to once an hour for identity details." },
        { type: "p", text: "Each request has a timeout, three retries, a CRC check and handling of exception codes. A register that fails three passes in a row is flagged and not silently shown as zero. Reads do not overlap writes. For a setting, the gateway writes, reads the register back and compares, and the dashboard shows it as applying, confirmed or failed." },
        { type: "p", text: "Makers differ in what they accept. The Deye inverter we tested ignores the write-single-register function and accepts write-multiple-registers, so our firmware uses the second." },
      ],
    },
    {
      id: "trouble",
      badge: "When it does not answer",
      title: "When an inverter",
      accent: "does not answer.",
      blocks: [
        {
          type: "steps",
          items: [
            { title: "Swap A and B", body: "The most common cause. The labels differ between makers." },
            { title: "Check the ID, speed and parity", body: "The master and the inverter must agree on all three, and the ID must be unique on the bus." },
            { title: "Check the port", body: "Many inverters have several RS-485 ports for different jobs. Use the one the manual says is for Modbus." },
            { title: "Check power and termination", body: "That the inverter is on, that the line is terminated at both ends only, and that no branch is long." },
            { title: "Look at the cable", body: "Length, damage, and noise from nearby power cables. Keep the common connected." },
          ],
        },
      ],
    },
    {
      id: "old",
      badge: "Old systems",
      title: "Can an older inverter",
      accent: "be read?",
      blocks: [
        { type: "p", text: "In principle, yes, if it has a Modbus RS-485 port and its maker documents its registers. If either is missing, there is nothing to ask and nothing to interpret, and the answer is that it cannot be read by this route. A few makers use their own protocol on the same wires." },
        { type: "p", text: "Send us the make and model and we will tell you. Deye hybrid inverters are supported today, and others are assessed and added after testing on real equipment." },
      ],
    },
  ],
  faqs: [
    {
      question: "Is Modbus the same as RS-485?",
      answer: "No. RS-485 is the electrical standard for the wires. Modbus is the protocol that says what the devices say to each other. Modbus on RS-485 is a common pair, and Modbus also runs over other links.",
    },
    {
      question: "Why did swapping A and B fix it?",
      answer: "The specification names the wires D0 and D1, and makers label the terminals A and B in different ways. If the labels are the other way round, the master hears nothing. Swapping the two wires puts them right.",
    },
    {
      question: "How many inverters can one gateway read?",
      answer: "The specification always allows 32 devices on a bus without a repeater. Our gateway is set up for one inverter at a time, and each unit belongs to one device.",
    },
    {
      question: "Can WayTara read any Modbus inverter?",
      answer: "No. A Modbus connection only gets you the registers. Someone has to know what each register means, and that is in the maker's documentation. We add makes and models after testing on real equipment.",
    },
  ],
  sources: [MODBUS_SERIAL, MODBUS_APP, MODBUS_PAGE, { label: "WayTara platform: how it connects and what it supports", url: "/technology", note: "The statements on supported equipment and on what the gateway does." }],
  related: ["waytara-gateway", "monitor-existing-solar", "good-solar-monitoring"],
  updated: UPDATED,
  updatedLabel: UPDATED_LABEL,
  category: "Gateway and integration",
  cta: PLATFORM_CTA,
};

export const homeEvCharger: Guide = {
  slug: "home-ev-charger-installation",
  path: "/blog/home-ev-charger-installation",
  metaTitle: "Installing an EV Charger at Home: A Checklist from India's Safety Regulations",
  metaDescription:
    "Who may install an EV charger, what the CEA safety regulations 2023 require of EV charging equipment and its circuit, what to ask your installer, and which records to keep.",
  name: "Installing an EV charger at home",
  eyebrow: "EV charging",
  title: "Installing an EV charger at home:",
  accent: "a checklist from the regulations.",
  answer:
    "A home EV charger is electrical installation work. The CEA safety regulations expect a licensed contractor under a certified supervisor, a protected circuit of its own, earth protection, and a residual current device. Use this checklist to ask the right questions before the work starts.",
  inShort: [
    "Installation work, including an addition to an existing installation, must be done by a contractor licensed by the State Government under the direct supervision of a competency-certificate holder (regulation 31). Work done otherwise may not be energised.",
    "Chapter XI of the 2023 regulations sets rules for EV charging stations: a dedicated sub-circuit with overcurrent protection for each charging point, earth continuity monitoring, the socket outlet at least 800 mm above the ground, and no portable socket outlets, extension cords or adaptors.",
    "A residual current device of not more than 30 mA is required for a domestic installation (regulation 44).",
    "The chapter does not define 'charging station' or say whether it covers one private charger, so ask your installer and your utility which rules they apply.",
    "Keep the test certificates and inspection results. The regulations ask charging station owners to keep them for at least seven years (regulation 128).",
  ],
  sections: [
    {
      id: "who",
      badge: "Who may do it",
      title: "Who may",
      accent: "install it.",
      summary: "Regulation 31 of the CEA safety regulations, 2023.",
      blocks: [
        { type: "p", text: "Regulation 31(1) says that no electrical installation work, including additions, alterations, repairs and adjustments to existing installations, may be carried out except by an electrical contractor licensed by the State Government, on its behalf under the direct supervision of a person holding a certificate of competency, and by a person holding a permit issued or recognised by the State Government." },
        { type: "p", text: "The exceptions are replacing lamps, fans, fuses, switches, domestic appliances of not more than 250 V and fittings, where that in no way alters the capacity or character of the installation. A new circuit for a charger is an addition to the installation, which those exceptions do not cover." },
        { type: "p", text: "Under regulation 31(2), installation work done in contravention of that rule shall not be energised or connected to the works of any supplier. That is a practical risk for a charger fitted by someone who is not licensed." },
      ],
    },
    {
      id: "applies",
      badge: "What applies",
      title: "What applies",
      accent: "to a home charger?",
      blocks: [
        { type: "p", text: "Chapter XI of the 2023 regulations is headed 'Additional safety requirements for electric vehicle charging station', and says it applies to charging stations in addition to chapters I to VII. The regulations define 'electric vehicle supply equipment' (the part that supplies energy to recharge the battery) and 'supply lead', but they do not define a 'charging station'. They do not say how many charging points make one, or whether one private charger is a station." },
        { type: "note", title: "Ask, do not assume", body: "Because the chapter does not say, ask your installer and your utility which rules they apply to your charger. Chapter XI is the clearest statement of what India's safety regulations expect of EV charging equipment, and the general rules, such as a licensed contractor and a residual current device, apply to any installation." },
      ],
    },
    {
      id: "circuit",
      badge: "The circuit",
      title: "A circuit",
      accent: "of its own.",
      blocks: [
        {
          type: "cols",
          items: [
            { title: "A dedicated sub-circuit", body: "Each charging point is supplied individually by a dedicated sub-circuit protected by an overcurrent protective device, which is part of a switchboard (regulation 125(1))." },
            { title: "Separate overload protection", body: "Charging stations have separate protection against the overload of the input supply and of the output supply, to the relevant standards (regulation 124(1))." },
            { title: "A residual current device", body: "Electrical installations are controlled by a residual current device. In a domestic installation its residual operating current must not exceed 30 mA (regulation 44)." },
          ],
        },
        { type: "p", text: "All protective devices in a charging station must be coordinated with each other (regulation 125(2)), and for a three-phase charging point only four-core cable may be used (regulation 124(15))." },
      ],
    },
    {
      id: "earth",
      badge: "Earthing",
      title: "Earth protection",
      accent: "and the lead.",
      blocks: [
        {
          type: "list",
          items: [
            "An earth continuity monitoring system that disconnects the supply if the earthing connection to the vehicle becomes ineffective (regulation 125(3))",
            "A protective earth conductor between the supply's earth terminal and the conductive parts of the vehicle, to the relevant standards (125(5))",
            "A charging lead with an earth-connected metal shielding and wear-resistant, flexible insulation (125(4))",
            "Lightning protection for the charging station, to the relevant standards (124(7))",
            "A protective device against uncontrolled reverse power flow from the vehicle to the charging point (124(8))",
          ],
        },
      ],
    },
    {
      id: "placement",
      badge: "Equipment and placement",
      title: "Where and how",
      accent: "it is fitted.",
      blocks: [
        {
          type: "cols",
          items: [
            { title: "Socket outlet height", body: "The socket outlet of a charging point is installed at least 800 mm above the finished ground level (124(2))." },
            { title: "No shortcuts", body: "No cord extension set or second supply lead, no adaptor to connect a vehicle connector to a vehicle inlet, and no portable socket outlets for EV charging (124(3), 124(4), 124(6))." },
            { title: "Distance", body: "The distance between the charging point and the connection on the vehicle must not be more than five metres during charging (124(5))." },
          ],
        },
        {
          type: "list",
          items: [
            "The enclosure of the supply equipment must be fire-retardant, self-extinguishing and halogen-free, with fire detection, alarm and control as the relevant standards require (126)",
            "Underground cables through the charging area or vehicle passage are avoided, and if provided are at least one metre below the finished surface (124(17))",
            "A charging point disconnects supply if the output voltage exceeds the vehicle's limit, and does not energise the cable when the connector is unlocked (124(11), 124(12))",
          ],
        },
      ],
    },
    {
      id: "records",
      badge: "Testing and records",
      title: "Test it,",
      accent: "then keep the records.",
      blocks: [
        { type: "p", text: "The owner of a charging station must make sure the tests set out in the manufacturer's instructions for the residual current devices and the charging station have been carried out (regulation 127)." },
        { type: "p", text: "The owner must also keep records of design, construction and labelling, the relevant test certificates, and the result of every inspection, test and periodic assessment, with any issues found and the action taken. Copies, on paper or electronic, are kept for at least seven years and shown to officials at an inspection (regulation 128)." },
        { type: "p", text: "Separately, regulation 32 requires periodic inspection and testing of installations. For installations at or below the notified voltage it is done by the owner as self-certification, reported to the Electrical Inspector, and the State Government sets how often, not more than five years." },
      ],
    },
    {
      id: "ask",
      badge: "Before you start",
      title: "Questions to ask",
      accent: "your installer.",
      blocks: [
        {
          type: "list",
          items: [
            "Are you a licensed electrical contractor, and who is the supervisor with a certificate of competency? Can I see both?",
            "Will the charger have its own circuit with its own protective device on the switchboard?",
            "Is there a residual current device of not more than 30 mA, and an earth continuity monitoring system?",
            "How high will the socket outlet be, and how far is the charger from where I park?",
            "Will you test it and give me the test certificates? How long should I keep them?",
            "Does my utility or my housing society need to be told or to approve?",
            "Which OCPP version does the charger speak, if I want it connected to a management platform?",
          ],
        },
      ],
    },
    {
      id: "waytara",
      badge: "At WayTara",
      title: "Connecting it",
      accent: "afterwards.",
      blocks: [
        { type: "p", text: "A charger that speaks OCPP 1.6J can connect to the WayTara platform over the internet, and the dashboard then shows its status and sessions and can send the commands the charger supports. The electrical installation is separate work for appropriately licensed and qualified people, and the platform does not replace any of it." },
      ],
    },
  ],
  faqs: [
    {
      question: "Can I plug my charger into a normal wall socket?",
      answer: "Chapter XI says portable socket outlets are not permitted for EV charging and that each charging point is supplied by its own dedicated sub-circuit. The chapter does not say whether it covers a single home charger, so ask a licensed contractor what is right for your wiring and follow the charger maker's instructions.",
    },
    {
      question: "Do I need permission from my utility or housing society?",
      answer: "We could not open the Ministry of Power's EV charging guidelines of 2024, so we do not say what they require. Ask your utility and your housing society.",
    },
    {
      question: "How often must the installation be inspected?",
      answer: "Regulation 32 has installations at or below the notified voltage self-certified by the owner, reported to the Electrical Inspector, at a period the State Government sets, not more than five years.",
    },
    {
      question: "Were these regulations amended after 2023?",
      answer: "Reports say a 2026 amendment adds a chapter on battery energy storage systems. We have not found that it changes the EV charging chapter, but we have not read the amendment itself, so check the current consolidated text on the CEA website.",
    },
  ],
  sources: [CEA_SAFETY, { label: "WayTara platform: how it connects and what it supports", url: "/technology", note: "The statements on OCPP 1.6J chargers connecting to the platform." }],
  related: ["connect-ev-charger-ocpp", "ocpp-1-6-or-2-0-1", "working-under-a-contractor"],
  updated: UPDATED,
  updatedLabel: UPDATED_LABEL,
  category: "EV charging",
  cta: PLATFORM_CTA,
};
