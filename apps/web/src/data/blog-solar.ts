import type { Guide } from "./guides";
import { PLATFORM_CTA, UPDATED, UPDATED_LABEL } from "./blog-shared";

// Three articles on running a solar system: the power-cut rule, looking after the panels and inverter, and what monitoring should show. The first is from the CEA
// connectivity regulations and the BIS and IEC texts; the other two are from the NREL/Sandia/SunSpec operation and maintenance guide (3rd edition, 2018),
// whose data come mostly from studies in the United States, which the articles say.

const NREL = {
  label: "H. A. Walker, Best Practices for Operation and Maintenance of Photovoltaic and Energy Storage Systems, 3rd edition, NREL/TP-7A40-73822, December 2018",
  url: "https://www.osti.gov/biblio/1489002",
};

export const antiIslanding: Guide = {
  slug: "why-solar-stops-in-a-power-cut",
  path: "/blog/why-solar-stops-in-a-power-cut",
  metaTitle: "Why On-Grid Solar Stops in a Power Cut",
  metaDescription:
    "Why an on-grid solar system switches off when the grid fails, what the CEA connectivity rules require, and what you need to have power during a cut.",
  name: "Why solar stops in a power cut",
  eyebrow: "Solar systems",
  title: "Why your solar stops in a power cut,",
  accent: "and what the rules say.",
  answer:
    "A grid-connected solar system switches itself off when the grid goes down. That is not a fault: Indian rules require it, so that your system never keeps a dead line energised. To have power during a cut, the system has to be designed for it.",
  inShort: [
    "An on-grid inverter must stop energising the grid within two seconds of an unintended island forming. That is a requirement of the CEA connectivity regulations, not a maker's choice.",
    "After the grid returns, the inverter does not restart at once: the regulations require voltage and frequency to be within limits and stable for at least sixty seconds first.",
    "Connecting a system to the grid is a process: a request to the utility, a study, a connection agreement, tests and drawings before it is switched on.",
    "Inverters sold in India are tested for islanding prevention to IS 16169:2019, the same test procedure as IEC 62116:2014.",
    "Power during a cut needs a design that provides it, such as a battery with a hybrid inverter and a proper changeover. Do not ask anyone to switch the protection off.",
  ],
  sections: [
    {
      id: "story",
      badge: "In a power cut",
      title: "What happens when",
      accent: "the grid fails.",
      summary: "Four things, in about a minute.",
      blocks: [
        {
          type: "steps",
          items: [
            { title: "The grid goes down", body: "The utility's supply to your street is switched off, by a fault or by the utility for work." },
            { title: "The inverter notices", body: "It watches the voltage and frequency of the grid all the time. When they disappear or drift outside limits, it knows something is wrong." },
            { title: "It stops within two seconds", body: "The regulations require it to stop energising the system within two seconds of an unintended island forming." },
            { title: "It waits to come back", body: "When the grid returns, it reconnects only after voltage and frequency have been within limits and stable for at least sixty seconds." },
          ],
        },
        { type: "p", text: "So your lights go out and your panels sit idle on a sunny afternoon. It feels like waste. It is the system doing what the rules require, and for a reason." },
      ],
    },
    {
      id: "island",
      badge: "The idea",
      title: "What an island is,",
      accent: "and why it matters.",
      blocks: [
        { type: "p", text: "In the regulations, an unintended island is a part of the electricity system that stays energised by one or more distributed generation resources, such as rooftop solar, after that part has been isolated from the rest of the system." },
        { type: "p", text: "For a home with solar, that would mean your roof system keeping the street's wires live after the utility has switched the supply off. People working on those wires would be working on a line that is not dead. That is the danger the rules are written to prevent, and it is why the inverter must be the one to stop." },
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
      id: "connecting",
      badge: "Getting connected",
      title: "How a system is",
      accent: "connected to the grid.",
      summary: "The same regulations also set out the process, from the first request to the first switch-on.",
      blocks: [
        {
          type: "steps",
          items: [
            { title: "A formal request", body: "The applicant asks the utility for connection (regulation 4(1)), and is responsible for the design, protection and safe operation of their own equipment (4(2))." },
            { title: "A study", body: "The utility carries out an interconnection study: where the connection is made, the largest capacity a location can take, the effect on service to other consumers, and extra measures for the safety of equipment and people (4(6))." },
            { title: "A connection agreement", body: "Every connection is covered by an agreement with the utility, with the general and specific technical conditions for that connection (4(7))." },
            { title: "Drawings and tests", body: "A single-line diagram is prepared and given to the utility (9). Before physical connection, all inspections and tests agreed with the utility are completed, and the drawings, specifications and test records are made available to it (10)." },
            { title: "Agreeing the protection", body: "Before the first synchronisation, the applicant and the utility agree the protection features and control diagrams, and each keeps a signed copy. The drawings are amended whenever the system changes (11(10) to 11(12))." },
          ],
        },
        { type: "p", text: "This is the formal side of what an installer does for you when they say they will arrange the net-metering application. It is also why you should expect to be asked for, and to receive, drawings and test records." },
      ],
    },
    {
      id: "isolator",
      badge: "The isolating switch",
      title: "A switch the utility",
      accent: "can reach.",
      blocks: [
        { type: "p", text: "For a generator above a capacity the utility sets, the regulations let the utility require a manually operated isolating switch between the generator and the grid (regulation 11(9)). The switch must:" },
        {
          type: "list",
          items: [
            "Allow visible verification that the separation has been made",
            "Show clearly whether it is open or closed",
            "Be quickly and conveniently reachable at any hour by the utility's personnel, without needing the owner's clearance",
            "Be capable of being locked in the open position",
            "Be located at least 2.44 m above ground level",
          ],
        },
        { type: "p", text: "Whether your system needs one is the utility's decision, based on its maintenance and safety procedures." },
      ],
    },
    {
      id: "quality",
      badge: "Power quality",
      title: "Other limits",
      accent: "on your inverter.",
      blocks: [
        {
          type: "cols",
          items: [
            { title: "Harmonics", body: "Harmonic current injected into the grid must stay within the limits of the IEEE 519 standard (11(1))." },
            { title: "Direct current", body: "The system must not inject direct current greater than 0.5% of its full rated output at the connection point (11(2))." },
            { title: "Flicker and voltage", body: "It must not introduce flicker beyond the limits of IEC 61000, and synchronising must not cause a voltage fluctuation greater than 5% at the point of connection (11(3), 11(8))." },
          ],
        },
        { type: "p", text: "Harmonic current, direct current and flicker are measured with calibrated meters before commissioning and once a year, in the presence of the parties, and the date is written into the connection agreement (regulation 8(2)). An inverter has the synchronising device built in, which the regulations accept in place of a separate one (11(4))." },
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
        { type: "note", title: "Elsewhere too", body: "The NREL operation and maintenance guide notes that string inverters and micro-inverters shut down automatically on loss of the AC connection, as the US standard IEEE 1547 requires. The behaviour is not peculiar to India." },
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
    {
      id: "ask",
      badge: "Before you sign",
      title: "What to ask",
      accent: "your installer.",
      blocks: [
        {
          type: "list",
          items: [
            "Does the inverter model have BIS registration, and can I see its test report?",
            "Who is making the connection request and the net-metering application, and what is the status?",
            "Will I get the single-line diagram, the drawings and the test records?",
            "Does my utility require an isolating switch, and where will it be?",
            "Is the system on-grid only, or will it supply selected loads in a cut? How?",
          ],
        },
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
    {
      question: "Do these rules apply to my home system?",
      answer: "The regulations apply to distributed generation, charging stations and prosumers connected below 33 kV, as amended in 2019. Your installer and your utility confirm what applies to your connection.",
    },
  ],
  sources: [
    {
      label: "CEA (Technical Standards for Connectivity of the Distributed Generation Resources) Regulations, 2013, with the First Amendment, 2019",
      url: "https://www.cbip.org/cearegulations/CEA%20DATA/Connectivity/Connectivity%20Regulation/Con%20Coneectivity%20Regulations%202013.pdf",
      note: "Regulations 2(1)(m), 3, 4, 8, 9, 10 and 11. A PDF download.",
    },
    {
      label: "Bureau of Indian Standards: Guidelines for Implementation of Revised QCO for Utility-Interconnected Photovoltaic Inverters, 26 March 2025",
      url: "https://www.crsbis.in/BIS/app_srv/tdc/gl/docs/changeover_guidelines_IS_16169_V2_final.pdf",
      note: "IS 16169:2019 / IEC 62116:2014, the trip-setting rule, and the 27 July 2025 date. A PDF download.",
    },
    { label: "IEC 62116:2014, Utility-interconnected photovoltaic inverters: test procedure of islanding prevention measures", url: "https://webstore.iec.ch/en/publication/6479", note: "The scope of the standard, from the IEC webstore." },
    { ...NREL, note: "Section 5.2.2: string and micro-inverters shut down automatically on loss of the AC connection." },
  ],
  related: ["clean-and-maintain-rooftop-solar", "good-solar-monitoring", "on-grid-hybrid-off-grid-solar"],
  updated: UPDATED,
  updatedLabel: UPDATED_LABEL,
  category: "Solar systems",
};

export const solarCare: Guide = {
  slug: "clean-and-maintain-rooftop-solar",
  path: "/blog/clean-and-maintain-rooftop-solar",
  metaTitle: "Cleaning and Maintaining Solar Panels",
  metaDescription:
    "How dirt affects solar output, how to clean panels safely and how often, what to inspect, and a yearly routine, based on the NREL maintenance guide.",
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
    "Monitoring alone is not enough: the guide says a periodic inspection is a common second check. Anything electrical is for qualified people, and roof work is dangerous.",
  ],
  sections: [
    {
      id: "why",
      badge: "Why it matters",
      title: "What dirt",
      accent: "does.",
      blocks: [
        { type: "p", text: "Soiling reduces the energy a solar array produces. If it is uneven, for example from bird droppings, it can also lead to localised hot-spot failures in the module, which is why uneven dirt is the kind to deal with first." },
        { type: "p", text: "How fast panels get dirty depends on where they are. The NREL guide collects reported rates: typically about 0.05% of output lost per day, but about 0.36% a day in an area of heavy agricultural activity compared with 0.01% a day in a desert with no agriculture, construction or industry nearby. It reports up to about 0.5% a day with large bird populations, and around 1.5% a day during dust storms in places such as India." },
        { type: "p", text: "Annual soiling losses in the studies it reviews run from 4.3% to 7.5%, with many near 6% a year. These are figures from studies, mostly in the United States, and not a prediction for your roof." },
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
        { type: "p", text: "The guide notes that care must be taken to avoid damaging the components. For a large system, robotic cleaning exists, and some of these need the array to be designed to accommodate them. The water used in the study it cites was around one litre for each square metre of array." },
      ],
    },
    {
      id: "often",
      badge: "How often",
      title: "How often is",
      accent: "worth it?",
      blocks: [
        { type: "p", text: "The guide's point is that the right interval is a local cost-and-benefit question. It depends on what a cleaning costs, how quickly dirt builds up as a loss of power, how sunny the place is, what each unit of electricity is worth, and how efficient the modules are. It also says that cleaning can be on a fixed interval or 'condition based', triggered by an instrument that measures soiling." },
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
      id: "inspect",
      badge: "Looking over the array",
      title: "Looking over",
      accent: "the array.",
      blocks: [
        { type: "p", text: "The guide says that, because of the inherent inaccuracies of monitoring data alone, it is common to add a second check of the DC array: a periodic inspection that finds string- and module-level faults. It names two methods, manual electrical testing and thermal imaging." },
        {
          type: "cols",
          items: [
            { title: "Manual electrical testing", body: "Measuring open-circuit voltage, operating current or the module's current-voltage curve. It finds faults that are already causing significant failure, and not hot spots that are not yet doing so." },
            { title: "Thermal imaging", body: "Looks for temperature differences between modules, which can show a defect that lowers a module's efficiency, and can reveal hot spots and possible fire risks early." },
          ],
        },
        { type: "p", text: "The guide notes that manual testing is done inside the combiner box while the system is live, so arc-flash protective equipment is needed, and that every enclosure opened must be properly re-sealed. In other words, it is a job for trained people with the right equipment. As an owner, ask your installer whether and how often they inspect." },
      ],
    },
    {
      id: "roof",
      badge: "The roof",
      title: "The roof under",
      accent: "your panels.",
      blocks: [
        { type: "p", text: "The guide treats the roof as part of the system. It says a roof system is more than the surface: it includes the membrane, insulation, barriers and the deck. Panels should be serviced without damaging any of them, and any leak or the attachment points need maintenance." },
        { type: "p", text: "It adds that roofs under warranty require annual preventive roof maintenance to keep the warranty, and that it is a best practice for the solar maintenance provider to meet the roof maintenance provider so both know their roles. A roof that fails can force the panels to be taken off so the roof can be repaired." },
      ],
    },
    {
      id: "inverter",
      badge: "The electrical side",
      title: "Looking after",
      accent: "the inverter and battery.",
      blocks: [
        { type: "p", text: "The guide notes that inverter failure is one of the most frequent causes of loss of performance in a PV system, and that the best preventive maintenance is to carry out the manufacturer's required maintenance. It names, for example, re-tightening current-carrying connections and thermal imaging of electrical connections and components. It also says inverter air filters take in dust in windy or dusty conditions, so a filter clean or swap should follow such conditions." },
        { type: "p", text: "For batteries, it says the maker of the storage product should state the periodic maintenance it needs. Ask for that in writing when you buy." },
        { type: "p", text: "Opening an inverter, a battery or their connections is electrical work. It must be done by appropriately licensed and qualified people, not by the owner." },
      ],
    },
    {
      id: "faults",
      badge: "When something is wrong",
      title: "How quickly",
      accent: "should a fault be fixed?",
      blocks: [
        { type: "p", text: "The guide says faults or conditions that are a safety problem should be dealt with as soon as possible, even if the lost output is small. For other faults, it says a maintenance contract typically sets a response time of ten days or less, and that for small residential systems an operator may repair only when enough work has built up, or at the next scheduled visit." },
        { type: "p", text: "That is a useful question to ask your installer: how long, in writing, before someone looks at a fault that stops the system, and how long for one that only lowers its output?" },
      ],
    },
    {
      id: "routine",
      badge: "A simple routine",
      title: "A simple routine",
      accent: "for the year.",
      summary: "Drawn from the guidance above. Adjust to your system and your maker's advice.",
      blocks: [
        {
          type: "steps",
          items: [
            { title: "After dusty weeks", body: "Look at your output. If it has dropped and not recovered after rain, a clean may be worth it." },
            { title: "Once a year", body: "Ask a qualified person to inspect the array, wiring, inverter and battery as the makers require, and to check the roof around the panels." },
            { title: "After storms and heavy winds", body: "Look from the ground for loose or damaged panels or cables, and for a drop in output. Do not climb up to check." },
            { title: "Always", body: "Keep the maker's maintenance instructions and any service records together, and watch the dashboard for alerts." },
          ],
        },
      ],
    },
    {
      id: "safety",
      badge: "Safety",
      title: "Stay safe",
      accent: "on the roof.",
      blocks: [
        { type: "p", text: "The guide lists roof fall protection and electrocution among the hazards of special importance to people who maintain PV systems, and says every worker needs at least basic safety training. It notes that steeper roofs need a higher standard of fall protection." },
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
    {
      question: "Does cleaning affect my warranty?",
      answer: "It can. The guide says to follow the module maker's recommendations for cleaning, and the warranty may depend on them. Read your module's warranty and ask the maker.",
    },
  ],
  sources: [
    {
      ...NREL,
      note: "Section 5.7.1 (cleaning), 5.3 (roof), 5.2 (inverters), 6.6 and 6.7 (maintenance), 7 (safety) and 9.1 (array inspection). Most of its data are from studies in the United States, which is why we tell you to test the advice on your own roof.",
    },
  ],
  related: ["good-solar-monitoring", "why-solar-stops-in-a-power-cut", "waytara-gateway"],
  updated: UPDATED,
  updatedLabel: UPDATED_LABEL,
  category: "Solar systems",
};

export const solarMonitoring: Guide = {
  slug: "good-solar-monitoring",
  path: "/blog/good-solar-monitoring",
  metaTitle: "What Good Solar Monitoring Should Show You",
  metaDescription:
    "The three questions monitoring should answer, what availability and performance ratio mean, what a good report contains, and how often alerts should fire.",
  name: "What good solar monitoring shows",
  eyebrow: "Solar systems",
  title: "What good solar monitoring",
  accent: "should show you.",
  answer:
    "Good monitoring answers three questions: is the system running, is it producing what it should for today's weather, and what has it done over time. A single 'kWh today' number answers none of them well.",
  inShort: [
    "Monitoring is more than a chart: NREL's guide describes it as watching system status, alarms and diagnostics, and comparing results with an expected benchmark.",
    "Availability (was it running?) and performance (did it produce what it should?) are different, and you need both.",
    "Performance ratio is a common measure, but it moves with the seasons. A performance index, which compares measured output with what the weather should have produced, is steadier.",
    "The guide recommends reporting a total loss of output daily, and a shortfall against the weather weekly or monthly. Alerts that fire too fast mostly produce false alarms.",
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
        { type: "p", text: "The NREL guide puts the quality of a plant's operation in two parts: the ratio of the energy harvested to the energy that was available, and the availability of the equipment over time. Both need accurate measurement, an easy way to pinpoint problems, and a prompt, cost-effective repair." },
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
        { type: "p", text: "It also says a performance ratio of 0.8 may be fine for some places and not for others, which is why a single number from a brochure tells you little about your own roof." },
      ],
    },
    {
      id: "report",
      badge: "A good report",
      title: "What a good report",
      accent: "contains.",
      summary: "The guide's list for a plant's reports. A home dashboard will show less, but the idea is the same.",
      blocks: [
        {
          type: "list",
          items: [
            "The site and the size of the system",
            "Sunshine (insolation) and temperature",
            "Real power and energy delivered, and peak power",
            "An estimate of the energy that should have been produced, and the performance ratio",
            "Availability, by time and by energy",
            "Inverter efficiency",
            "A measure of soiling, if there is one",
          ],
        },
        { type: "p", text: "The guide adds that a portal should be reachable at any time, with downloadable raw data and charts, that daily, month-to-date and year-to-date production should be kept, and that the data format should be clearly documented and compatible with open standards such as IEC 61724 and SunSpec so it can be used elsewhere." },
      ],
    },
    {
      id: "alerts",
      badge: "Alerts",
      title: "How fast should",
      accent: "an alert fire?",
      blocks: [
        { type: "p", text: "It is tempting to want an alert the second anything is odd. The guide recommends the opposite, for good reasons:" },
        {
          type: "cols",
          items: [
            { title: "Safety first", body: "Fire and intrusion alarms should be pushed out immediately, and critical production or safety issues as soon as possible." },
            { title: "Total loss, daily", body: "A complete loss of production, and a loss of communication, should be reported daily. Reporting them immediately is a source of false alarms, because communication may be quickly restored." },
            { title: "A shortfall, weekly", body: "A system producing less than forecast for the weather should be reported weekly or monthly. Intervals shorter than a week raise the chance of false positives and usually give no value." },
          ],
        },
        { type: "p", text: "Issues that affect production but not safety should reach someone who can act within five days, depending on the fault and the cost of the lost energy. The aim is alerts that people trust and act on." },
      ],
    },
    {
      id: "inspect",
      badge: "Not a replacement",
      title: "Monitoring is not",
      accent: "an inspection.",
      blocks: [
        { type: "p", text: "The guide says that because of the inherent inaccuracies of monitoring data alone, it is common to add periodic inspection and testing of the DC array to find string- and module-level faults. A dashboard can show that output is low. It cannot always say that one string has failed or a module has a hot spot. Ask for both: monitoring every day, and an inspection by qualified people from time to time." },
      ],
    },
    {
      id: "quality",
      badge: "The system itself",
      title: "What makes monitoring",
      accent: "trustworthy.",
      summary: "The guide's checklist for the quality of monitoring equipment.",
      blocks: [
        {
          type: "list",
          items: [
            "Measurement methods that are open to see and to audit",
            "Hardware and software that more than one service provider can maintain",
            "The ability to share information with the people who need it",
            "Backup and restore, so the record survives a failure",
            "Access for third parties to build their own tools",
            "Security of the software and applications",
            "Power for the monitoring system that survives a cut, where it matters",
          ],
        },
        { type: "p", text: "It also says a data logger should ideally store six months of data and back it up to cloud storage, so a gap in the internet does not become a gap in the record." },
      ],
    },
    {
      id: "waytara",
      badge: "At WayTara",
      title: "What our platform",
      accent: "shows.",
      blocks: [
        { type: "p", text: "WayTara's platform gives live readings, history, alerts and reports for connected equipment, plus controls for the settings we have tested on supported equipment. Deye hybrid inverters are supported today, and other makes and models are assessed and added after testing on real equipment. If the internet at your site drops, the gateway keeps its readings and sends them when the connection is back." },
        { type: "note", title: "What it does not claim", body: "What can be read or controlled depends on the make, model and enabled features of each device. We do not promise optimisation of solar, battery and charging unless a control policy has been set up and tested for your site." },
      ],
    },
    {
      id: "ask",
      badge: "Before you trust one",
      title: "Questions to ask",
      accent: "of any monitoring.",
      blocks: [
        {
          type: "list",
          items: [
            "Does it tell me when the system stops, and how soon?",
            "Does it compare my output with what the weather should give?",
            "Can I look back over months and years?",
            "Can I download my own data?",
            "What happens to the record if my internet drops?",
            "Who can see my readings?",
          ],
        },
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
      question: "Why does my alert not come the moment the inverter goes offline?",
      answer: "Because immediate alerts on lost communication are a source of false alarms, as communication is often quickly restored. The guide recommends daily reporting of a total loss of output.",
    },
    {
      question: "Can WayTara monitor an inverter I already have?",
      answer: "If it is supported, yes, through the gateway. Send us the make and model and we will tell you what connecting involves, with no commitment.",
    },
  ],
  sources: [
    {
      ...NREL,
      note: "Section 6.1 (key performance indicators), 9.1 (array inspection), 9.4 (data presentation and alerting) and 9.5 (quality of monitoring equipment). Most of its data are from the United States.",
    },
    { label: "WayTara platform: how it connects and what it supports", url: "/technology", note: "The statements on what WayTara's platform shows and does not claim." },
  ],
  related: ["clean-and-maintain-rooftop-solar", "monitor-existing-solar", "waytara-gateway"],
  updated: UPDATED,
  updatedLabel: UPDATED_LABEL,
  category: "Solar systems",
  cta: PLATFORM_CTA,
};
