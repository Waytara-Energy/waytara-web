import type { Guide } from "./guides";
import { PLATFORM_CTA, UPDATED, UPDATED_LABEL } from "./blog-shared";

// Articles on connecting equipment to WayTara: the gateway, an existing solar system, an EV charger, and what the OCPP version means. What is said about the
// WayTara platform is what the product does today (the platform page and the installer guide); what is said about OCPP and the CEA regulations is from the documents.

const PLATFORM_SOURCE = { label: "WayTara platform: how it connects and what it supports", url: "/technology", note: "The statements on supported equipment, what can be controlled and what is not promised." };
const OCA_PAPER = {
  label: "Open Charge Alliance, What is new in OCPP 2.0.1, white paper version 1.0, March 2023",
  url: "https://openchargealliance.org/ocpp-info-whitepapers/what-is-new-in-ocpp-2-0-1/",
  note: "The history of OCPP, the incompatibility of 2.0.1 with 1.6, the device model, transactions, ISO 15118, security, the functional blocks and the plan for 2.1.",
};

export const gateway: Guide = {
  slug: "waytara-gateway",
  path: "/blog/waytara-gateway",
  metaTitle: "The WayTara Gateway Explained",
  metaDescription:
    "What the WayTara gateway is, how it reads an inverter, why it needs one Wi-Fi connection, what happens when the internet drops, and how it is set up.",
  name: "The WayTara gateway",
  eyebrow: "Gateway and integration",
  title: "The WayTara gateway:",
  accent: "what it does.",
  answer:
    "The WayTara gateway is a small box at your site that connects your inverters, batteries and meters and shares one internet connection with the WayTara platform. Chargers connect to the platform directly instead.",
  inShort: [
    "One connection for many devices: the devices do not each need a network of their own.",
    "It reads the inverter's values over a wired serial link and sends them to the platform, which shows them in your dashboard.",
    "Deye hybrid inverters are supported today. Other makes and models are assessed and added after testing on real equipment.",
    "If the internet drops, the unit keeps its readings and sends them when it is back. We have not yet measured how long it can hold them.",
    "What can be read or controlled depends on the make, model and enabled features of each device.",
  ],
  sections: [
    {
      id: "what",
      badge: "The idea",
      title: "One box,",
      accent: "one platform.",
      blocks: [
        { type: "p", text: "Most inverters can report what they are doing, but they do it in their own way, often only to their maker's app. The WayTara gateway is the piece that goes between: it speaks to your inverter on one side and to the WayTara platform on the other, so the numbers appear in your dashboard next to everything else." },
        {
          type: "cols",
          items: [
            { title: "The gateway", body: "Connects your inverters, batteries and meters, and shares a single connection with WayTara." },
            { title: "Energy management", body: "Live readings, history, alerts and reports for connected equipment, plus controls for the settings we have tested on supported equipment." },
            { title: "Charger management", body: "Status, sessions and remote controls for compatible OCPP chargers, in the same dashboard as your energy. Chargers connect directly, not through the gateway." },
          ],
        },
      ],
    },
    {
      id: "reads",
      badge: "How it reads",
      title: "How it reads",
      accent: "an inverter.",
      blocks: [
        { type: "p", text: "The gateway talks to the inverter over a wired two-wire serial link, using a standard industrial protocol called Modbus. The gateway asks, the inverter answers: it requests a set of values by their register numbers and the inverter replies with their current figures." },
        { type: "p", text: "For the Deye hybrid inverter we have tested, the dashboard shows close to a hundred values read from the inverter, such as power from each solar input, battery and grid and load figures, temperatures, and the inverter's warning and fault codes. Another few dozen, such as total solar power, are worked out by the platform from those values, from your site record and from the weather service." },
        { type: "p", text: "Not every value is read as often. Fast-changing values such as power are read every few seconds, slower ones every half minute or every few minutes, and identity details such as the serial number and firmware version once an hour. That keeps the link to the inverter free and the dashboard lively where it matters." },
      ],
    },
    {
      id: "internet",
      badge: "The connection",
      title: "One connection,",
      accent: "and what if it drops.",
      blocks: [
        { type: "p", text: "The gateway joins the site's Wi-Fi, on the 2.4 GHz band only, and keeps up to three networks in memory. Everything it reads goes to the platform over that one connection, so the inverter, battery and meters need no network of their own." },
        { type: "note", title: "When the internet goes down", body: "The unit keeps its readings and sends them when the connection is back. We have not yet measured how long it can hold them, and after a long outage the oldest readings are dropped. We would rather say so than promise a number." },
        { type: "p", text: "The platform shows a device as online when it is hearing from it, and offline when it is not. If the dashboard says the inverter is not answering, the gateway is online but the inverter is not replying to it, which points at the wiring or the inverter's settings and not the internet." },
      ],
    },
    {
      id: "setup",
      badge: "Setting one up",
      title: "What an installer",
      accent: "does.",
      summary: "For WayTara staff and the site engineers assigned to the site. A customer does not do this.",
      blocks: [
        {
          type: "steps",
          items: [
            { title: "Wire it", body: "Connect the unit to the inverter's Modbus communication port using the inverter's own documentation. On the Deye model we have tested, that is the socket labelled Modbus, wired to the unit's A, B and ground terminals." },
            { title: "Pair it", body: "Using a phone or laptop with Chrome, sign in to WayTara, pick the device the unit is wired to, and find the unit over Bluetooth. iPhones cannot do this step, so installers use an Android phone or a laptop." },
            { title: "Join the Wi-Fi", body: "Choose the site's 2.4 GHz network, enter its password, and run the connection and speed checks. Anything shown in red, such as no internet, is fixed before going on." },
            { title: "Finish", body: "The unit restarts, joins the Wi-Fi and connects to WayTara. The device shows as online in the dashboard within a few minutes, and the first readings appear after the next quarter hour." },
          ],
        },
        { type: "p", text: "It takes about ten minutes a unit. Each unit belongs to one device at a time and gets its own key when it is set up. Setting it up again replaces the old key, which then stops working. The key is shown once and is never to be shared in a message or an e-mail." },
        { type: "note", title: "Wiring depends on the inverter", body: "The wiring and the inverter's Modbus settings differ between makes and models. Always follow the inverter maker's documentation. What we describe is the model we have tested." },
      ],
    },
    {
      id: "control",
      badge: "Monitor and control",
      title: "Monitor, and control",
      accent: "within limits.",
      blocks: [
        { type: "p", text: "Everything supported can be monitored. Control covers selected, tested settings on supported inverters, such as certain charging schedules, and the supported commands on compatible chargers. A setting change is sent, the inverter is read again, and the dashboard shows what the inverter actually did." },
        { type: "note", title: "What it is not", body: "It is not unrestricted battery-management control or grid-scale dispatch. We do not promise automatic optimisation of solar, battery and charging unless a control policy has been set up and tested for your site." },
        { type: "p", text: "Readings from your devices belong to your site. You, and the people you have given access to, can see them. WayTara staff can see them where they need to in order to install, support and repair your system. The Privacy Policy sets this out." },
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
    {
      question: "Can I set the unit up myself?",
      answer: "No. Setup is done by WayTara staff and the site engineers assigned to your site, so that each unit is tied to the right device and site.",
    },
    {
      question: "Who can see my readings?",
      answer: "You and the people you give access to. WayTara staff see them where they need to in order to install, support and repair your system.",
    },
  ],
  sources: [
    PLATFORM_SOURCE,
    { label: "WayTara Privacy Policy: Data from your devices", url: "/privacy", note: "Who can see readings from your devices, and what we use them for." },
  ],
  related: ["modbus-rs485-explained", "monitor-existing-solar", "good-solar-monitoring"],
  updated: UPDATED,
  updatedLabel: UPDATED_LABEL,
  category: "Gateway and integration",
  cta: PLATFORM_CTA,
};

export const existingSolar: Guide = {
  slug: "monitor-existing-solar",
  path: "/blog/monitor-existing-solar",
  metaTitle: "Add Monitoring to Solar You Already Have",
  metaDescription:
    "How to bring an existing inverter, battery or EV charger onto WayTara without replacing it: what to check, what to send us, and what to expect.",
  name: "Monitoring an existing solar system",
  eyebrow: "Gateway and integration",
  title: "Adding monitoring to a solar system",
  accent: "you already have.",
  answer:
    "You often do not need to replace a working inverter to see and manage it. If your equipment is supported, the gateway brings it onto the WayTara platform. If it is not, we assess it case by case, so send us the make and model first.",
  inShort: [
    "Compatibility decides the route, so start with the make and model.",
    "Deye hybrid inverters are supported through the gateway today. OCPP 1.6J chargers connect directly. Others are assessed and added after testing.",
    "Fitting the gateway can involve electrical work, which must be done by appropriately licensed and qualified people.",
    "Control means selected, tested settings on supported equipment. It is not unrestricted battery control.",
    "The site needs one internet connection, and you decide at the end. Asking costs nothing.",
  ],
  sections: [
    {
      id: "why",
      badge: "Why connect",
      title: "Why connect",
      accent: "what you already own?",
      blocks: [
        { type: "p", text: "A solar system that works but cannot be seen is easy to forget. A fault that stops it for a week looks the same as a good week until the electricity bill arrives. Monitoring turns that around: you see the system's status, its output against what it should do, and any alert, the day it happens." },
        { type: "p", text: "The usual alternative is to replace the inverter with one that comes with an app. That is costly and often unnecessary: if your inverter is on the supported list, the gateway can read it as it is." },
      ],
    },
    {
      id: "routes",
      badge: "The routes",
      title: "Three routes,",
      accent: "by equipment.",
      blocks: [
        {
          type: "cols",
          items: [
            { title: "Inverters, batteries and meters", body: "A supported inverter is read by the WayTara gateway over a wired serial link, and the gateway shares one connection with the platform. Deye hybrid inverters are supported today." },
            { title: "EV chargers", body: "A charger that speaks OCPP 1.6J connects to the platform directly over the internet, without the gateway. The functions available depend on the charger's supported features and firmware." },
            { title: "Everything else", body: "Other makes and models are assessed case by case and added after testing on real equipment. We tell you what connecting would involve before you commit." },
          ],
        },
      ],
    },
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
            { title: "We tell you what connecting involves", body: "Whether it uses the gateway or the charger's own connection, and what that would take on your site." },
            { title: "You decide", body: "You do not need to replace anything to ask, and you can stop after any step." },
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
        { type: "list", items: ["The make and model of the inverter, the battery and any meter", "A photo of each rating plate, if you can", "The make and model of any EV charger", "Whether the site has an internet connection, and which Wi-Fi band it uses", "Where the inverter is, and how easy it is to reach"] },
        { type: "p", text: "A gateway joins the site's Wi-Fi on the 2.4 GHz band, so a router that offers only 5 GHz will not do. Tell us what you have and we will say what is needed." },
      ],
    },
    {
      id: "install",
      badge: "Installation",
      title: "What installation",
      accent: "involves.",
      blocks: [
        { type: "p", text: "Fitting the gateway means connecting it to the inverter's communication port and powering it. That is work near electrical equipment, so it is done by WayTara staff or a site engineer assigned to your site, and where it touches wiring, protection or earthing it must be done by appropriately licensed and qualified people." },
        { type: "p", text: "Once it is joined to your Wi-Fi, the device shows as online in the dashboard within a few minutes, and the first readings appear after the next quarter hour." },
      ],
    },
    {
      id: "expect",
      badge: "What to expect",
      title: "What you will see,",
      accent: "and what you will not.",
      blocks: [
        { type: "list", items: ["Live readings, history, alerts and reports for the connected equipment", "Controls for the settings we have tested on supported equipment", "A device that shows online or offline, so you know when a fault is on the site and not in the numbers"] },
        { type: "note", title: "What we do not promise", body: "We do not promise automatic optimisation of solar, battery and EV charging unless a control policy has been set up and tested for your site. What can be read or controlled depends on the make, model and enabled features of each device." },
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
    {
      question: "Do I need new internet or a new router?",
      answer: "You need one connection at the site. The gateway uses Wi-Fi on the 2.4 GHz band, so if your router offers only 5 GHz, tell us.",
    },
    {
      question: "Does connecting change my warranty?",
      answer: "That depends on the equipment maker's terms. Ask the maker, and tell us the make and model so we can say what connecting involves.",
    },
  ],
  sources: [PLATFORM_SOURCE],
  related: ["waytara-gateway", "modbus-rs485-explained", "good-solar-monitoring"],
  updated: UPDATED,
  updatedLabel: UPDATED_LABEL,
  category: "Gateway and integration",
  cta: PLATFORM_CTA,
};

export const evOcpp: Guide = {
  slug: "connect-ev-charger-ocpp",
  path: "/blog/connect-ev-charger-ocpp",
  metaTitle: "Connecting an EV Charger to WayTara",
  metaDescription:
    "What happens when an OCPP 1.6J charger connects to WayTara: sessions, meter readings, the commands the dashboard can send, and the CEA connectivity rules.",
  name: "Connecting an EV charger (OCPP)",
  eyebrow: "EV charging",
  title: "Connecting an EV charger:",
  accent: "what happens, step by step.",
  answer:
    "A charger that speaks OCPP 1.6J connects to the WayTara platform directly over the internet, announces itself, and then reports its status and sessions. What you can see and control depends on what your charger and its firmware support.",
  inShort: [
    "OCPP 1.6J chargers connect to WayTara over the internet. They do not need the gateway, and each needs its own connection.",
    "The platform answers the charger's first message and sets how often it reports. A charger that goes quiet shows as degraded and then offline.",
    "Sessions, status and the commands the dashboard can send depend on each charger's supported OCPP features and firmware.",
    "The charger's electrical installation is separate work for appropriately licensed and qualified people. The CEA connectivity regulations also cover charging stations connected below 33 kV.",
  ],
  sections: [
    {
      id: "connect",
      badge: "The connection",
      title: "How a charger",
      accent: "connects.",
      blocks: [
        { type: "p", text: "OCPP charge points call the management system: the charger opens a connection to a web address and keeps it open. In WayTara each charger is registered first, and is given an address with a secret in it, which identifies that one charger. The address is entered in the charger's own settings. Never post it in a message or an e-mail; it can be replaced if it is ever exposed." },
        { type: "p", text: "WayTara prefers an encrypted connection (wss). Some low-cost chargers cannot use one, and a few have no field for credentials at all. We check what yours can do before we agree how it will connect, and we say so if the route is not as secure as we would like." },
      ],
    },
    {
      id: "talk",
      badge: "The conversation",
      title: "What the charger",
      accent: "and platform say.",
      blocks: [
        {
          type: "steps",
          items: [
            { title: "Boot", body: "The charger announces itself. The platform accepts it and tells it how often to send a heartbeat." },
            { title: "Status", body: "The charger reports whether each connector is available, preparing, charging or faulted, and any error." },
            { title: "Session", body: "When a vehicle is connected and authorised, a session starts. The charger sends meter values for power, current and voltage while it charges." },
            { title: "Stop", body: "When the session ends, the charger reports the energy delivered. The platform keeps the session and its readings." },
          ],
        },
        { type: "p", text: "While a charger is idle it sends a heartbeat. The platform treats the charger as online while it is hearing from it, as degraded if it has gone quiet for a minute or so, and as offline after about two minutes of silence. Where a charger supports it, WayTara asks for meter values about every half minute during a session, so the live session page is current." },
      ],
    },
    {
      id: "commands",
      badge: "Commands",
      title: "What the dashboard",
      accent: "can ask a charger to do.",
      blocks: [
        { type: "p", text: "Beyond watching, the platform can send commands that the OCPP 1.6J standard defines, as far as each charger supports them:" },
        { type: "list", items: ["Remote start and remote stop of a charging session", "Reset the charger", "Unlock a connector", "Set a limit on charging power or current", "Ask the charger for a fresh meter value on demand"] },
        { type: "note", title: "Chargers differ", body: "Not every charger supports every command, and some cheaper chargers ignore parts of the standard. The functions available depend on each charger's supported OCPP features and firmware. We confirm what yours can do before we promise anything." },
      ],
    },
    {
      id: "rules",
      badge: "The rules",
      title: "Charging stations",
      accent: "and the grid rules.",
      summary: "The CEA connectivity regulations, as amended in 2019.",
      blocks: [
        { type: "p", text: "The Central Electricity Authority's technical standards for connectivity below 33 kV were amended in 2019 to apply expressly to charging stations and prosumers as well as to generators. The amended text asks a charging station for a reliable protection system that detects faults and abnormal conditions and isolates the faulty equipment automatically, requires that a fault in its equipment does not adversely affect the grid, and sets the limits on current harmonics by the IEEE 519-2014 standard (regulation 11A)." },
        { type: "p", text: "Those are matters of electrical installation, not of the management platform. The circuit, its protection, earthing and testing are electrical work for appropriately licensed and qualified people, and the platform does not replace any of it." },
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
    {
      question: "Why is my charger shown as degraded?",
      answer: "It means the connection is open but the charger has said nothing for a minute or two. If it goes quiet for about two minutes, it shows as offline. Check the charger's own internet connection.",
    },
    {
      question: "Can WayTara start my charger remotely?",
      answer: "Where the charger supports the remote start command, yes. Whether it does is up to the charger and its firmware.",
    },
  ],
  sources: [
    PLATFORM_SOURCE,
    OCA_PAPER,
    {
      label: "CEA (Technical Standards for Connectivity of the Distributed Generation Resources) Regulations, 2013, with the First Amendment, 2019",
      url: "https://www.cbip.org/cearegulations/CEA%20DATA/Connectivity/Connectivity%20Regulation/Con%20Coneectivity%20Regulations%202013.pdf",
      note: "Regulation 3 (application to charging stations) and regulation 11A. A PDF download.",
    },
  ],
  related: ["ocpp-1-6-or-2-0-1", "home-ev-charger-installation", "waytara-gateway"],
  updated: UPDATED,
  updatedLabel: UPDATED_LABEL,
  category: "EV charging",
  cta: PLATFORM_CTA,
};

export const ocppVersions: Guide = {
  slug: "ocpp-1-6-or-2-0-1",
  path: "/blog/ocpp-1-6-or-2-0-1",
  metaTitle: "OCPP 1.6J or 2.0.1 for Your EV Charger",
  metaDescription:
    "What OCPP is, how versions 1.6 and 2.0.1 differ, why they are not compatible, what certification means, and what to ask about your charger.",
  name: "OCPP 1.6J or 2.0.1",
  eyebrow: "EV charging",
  title: "OCPP 1.6J or 2.0.1:",
  accent: "what the version means.",
  answer:
    "OCPP is the open protocol chargers use to talk to a charging management system. Version 1.6 (2015) became the most widely used, and version 2.0.1 (2020) is a big step forward that is not backward compatible. A charger and its management system must speak the same version. WayTara supports OCPP 1.6J chargers.",
  inShort: [
    "The Open Charge Alliance calls OCPP the industry-supported de facto standard for communication between a charging station and a management system, and an open standard with no cost or licensing barriers.",
    "OCPP 2.0.1 is not an incremental extension of 1.6 and is not backward compatible with it.",
    "The biggest changes are in transactions, a new device model, security, and support for ISO 15118 and Plug & Charge.",
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
        { type: "p", text: "It has to serve both simple, low-cost home chargers and high-power fast chargers with several connectors, and it has to stay usable by low-cost stations with limited memory and processing power. That tension runs through the story of the two versions: asking for more configuration, monitoring and security is a good reason to move on, and the cost of a cheap charger is a good reason not to." },
      ],
    },
    {
      id: "1-6",
      badge: "Version 1.6J",
      title: "Where",
      accent: "1.6J stands.",
      blocks: [
        { type: "p", text: "The 'J' stands for JSON. The Alliance notes that JSON over WebSockets, introduced with 1.6, brought a large reduction in mobile data cost compared with the earlier approach. In 1.6, a transaction is started when the car is connected and authorisation to charge is granted, and stops when the authorisation ends, for example by presenting the card a second time." },
        { type: "p", text: "Reporting a transaction in 1.x is split across the messages StartTransaction, StopTransaction, MeterValue and StatusNotification. The management system gives every transaction its ID, so a charger that is offline has to invent temporary IDs and swap them for the real ones when it reconnects." },
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
            { label: "Start and stop points", cells: ["Started when the car is connected and charging is authorised", "Configurable: for example when the cable is connected, or when authorisation begins, even with parking bay occupancy"] },
            { label: "Transaction IDs", cells: ["Created by the management system, so an offline charger makes temporary ones", "Created by the charger, with sequence numbers to restore the order"] },
            { label: "Configuration and monitoring", cells: ["Limited reporting through StatusNotification", "A device model: inventory reporting, better error and state reporting, configurable monitoring"] },
            { label: "Data use", cells: ["JSON over WebSockets", "WebSocket compression added"] },
            { label: "Security", cells: ["Added later by an Alliance extension for 1.6-J", "Three security profiles, client certificate key management, signed firmware updates and a security event log"] },
            { label: "ISO 15118 and Plug & Charge", cells: ["Plug & Charge possible through an Alliance customisation", "ISO 15118-2 fully supported, including Plug & Charge and smart charging input from the car"] },
          ],
        },
        { type: "p", text: "The Alliance says 2.0.1 uses many of the same concepts and even shares some messages with 1.6, but the changes to transaction handling and the new device model mean the two are not compatible." },
      ],
    },
    {
      id: "device-model",
      badge: "A closer look",
      title: "The device model,",
      accent: "in plain words.",
      blocks: [
        { type: "p", text: "The device model is the feature the Alliance singles out as long awaited by operators who manage many chargers from different makers. A charger describes itself to the management system when it connects, as a tree of components with values and settings: the connector, the controller, the power converter. The system does not need to be told in advance what the charger has." },
        { type: "p", text: "An event or fault is reported against the component it comes from, which the Alliance calls a huge improvement over the limited StatusNotification of 1.6. An operator can also ask to be told when a value, such as the temperature of a converter, passes a threshold, or ask for it to be sampled regularly. The idea is to catch problems early and to need fewer visits by an engineer." },
      ],
    },
    {
      id: "blocks",
      badge: "How it is organised",
      title: "Functional blocks",
      accent: "and certification.",
      blocks: [
        { type: "p", text: "OCPP 2.0.1 is built from functional blocks, each grouping the use cases for a topic. Not every charger needs every block. The Alliance lists sixteen:" },
        {
          type: "list",
          items: ["Security", "Provisioning", "Authorization", "Local authorization list management", "Transactions", "Remote control", "Availability", "Reservation", "Tariff and cost", "Metering", "Smart charging", "Firmware management", "ISO 15118 certificate management", "Diagnostics", "Display message", "Data transfer"],
        },
        { type: "p", text: "An implementer chooses which blocks to implement, but there is a minimum set that must be implemented to qualify for OCPP certification. The specification's certification profiles define exactly what a basic implementation, the Core profile, must have, and extended profiles for more advanced features such as smart charging and ISO 15118." },
      ],
    },
    {
      id: "yours",
      badge: "For you",
      title: "What to ask",
      accent: "about your charger.",
      blocks: [
        { type: "list", items: ["Which OCPP version it supports, and whether the JSON variant is used", "Whether it can be pointed at a management platform of your choice", "Which firmware it runs, and whether the maker can update it", "Which features it supports, since a platform can only use what the charger offers", "Whether it is certified, and to which profile"] },
        { type: "note", title: "Looking ahead", body: "The Alliance says it will support bidirectional charging, grid code support, integration with energy management systems and a new ISO 15118 version in a future OCPP 2.1 release, and that this and later releases will stay backward compatible with 2.0.1." },
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
    {
      question: "Is 1.6J going away?",
      answer: "We found nothing in the Alliance's paper that says so. It describes 1.6 as having been adopted by manufacturers all over the world, and 2.0.1 as a foundation for many years to come. Ask your charger's maker about its plans.",
    },
  ],
  sources: [
    OCA_PAPER,
    { label: "The white paper as a PDF", url: "https://www.openchargealliance.org/wp-content/uploads/2024/01/new_in_ocpp_201-v10.pdf" },
    PLATFORM_SOURCE,
  ],
  related: ["connect-ev-charger-ocpp", "waytara-gateway", "monitor-existing-solar"],
  updated: UPDATED,
  updatedLabel: UPDATED_LABEL,
  category: "EV charging",
  cta: PLATFORM_CTA,
};
