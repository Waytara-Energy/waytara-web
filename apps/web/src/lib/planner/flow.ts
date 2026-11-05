import type { Answers, ChargerCount, Goal, PlannerContext, Property } from "./types";

// The planner's questions, in order, with the rule for when each one applies. Pure data and pure functions: the screen only renders what
// activeQuestions() says, so the adaptive routing is testable without a browser.
//
// Design rule from the notes: every question must change the recommendation, the route, or what reaches the team. Otherwise it is not here.

export interface Option {
  value: string;
  label: string;
  hint?: string;
}

export interface Part {
  field: keyof Answers;
  kind: "single" | "multi";
  /** A small label above the options when a screen holds more than one part. */
  label?: string;
  options: Option[] | ((a: Answers) => Option[]);
  /** The most a multi part may hold (the goals step allows two). */
  max?: number;
  /** Choosing one of these clears the rest, and choosing any other clears these ("Nothing yet", "Not sure"). */
  exclusive?: string[];
  when?: (a: Answers) => boolean;
}

export interface Question {
  id: string;
  title: string;
  hint?: string;
  when: (a: Answers, ctx: PlannerContext) => boolean;
  parts: Part[];
}

// ---- What the answers imply (shared with the engine) ----

export const has = (a: Answers, e: Answers["equipment"][number]) => a.equipment.includes(e);
export const wants = (a: Answers, g: Goal) => a.goals.includes(g);

/** Any goal that leads to an installation (the EPC route). */
export const isEpcPath = (a: Answers) => wants(a, "bill") || wants(a, "backup") || wants(a, "ev_install") || wants(a, "upgrade");

/** Solar is a candidate when the visitor wants lower bills, or an upgrade and has no panels yet. */
export const solarCandidate = (a: Answers) => wants(a, "bill") || (wants(a, "upgrade") && !has(a, "panels"));

const businessProperty = (p: Property | undefined) => p === "commercial" || p === "factory" || p === "campus" || p === "fleet";

// ---- Options ----

const NOT_SURE: Option = { value: "unsure", label: "Not sure" };

export const GOAL_OPTIONS: Option[] = [
  { value: "bill", label: "Reduce my electricity bills with solar" },
  { value: "backup", label: "Add battery backup", hint: "Keep selected things running in a power cut" },
  { value: "ev_install", label: "Install EV charging" },
  { value: "upgrade", label: "Upgrade or expand my existing energy system" },
  { value: "monitor", label: "Monitor and control equipment I already have" },
  { value: "chargers", label: "Manage multiple EV chargers or a charging site" },
  { value: "unsure", label: "I'm not sure: help me decide" },
];

const GOALS_BY_START: Record<NonNullable<PlannerContext["start"]>, Goal[]> = {
  build: ["bill", "backup", "ev_install", "upgrade", "unsure"],
  charge: ["ev_install", "chargers", "unsure"],
  manage: ["monitor", "chargers", "unsure"],
};

export const PROPERTY_OPTIONS: Option[] = [
  { value: "home", label: "Home or villa", hint: "An independent residential property" },
  { value: "apartment", label: "Apartment or RWA", hint: "An individual apartment, or shared facilities" },
  { value: "commercial", label: "Commercial", hint: "Offices, retail, hospitals, hotels" },
  { value: "factory", label: "Factory or industrial", hint: "Manufacturing, warehouses and industry" },
  { value: "campus", label: "IT park or campus", hint: "Institutions and multi-building sites" },
  { value: "fleet", label: "EV fleet or charging site", hint: "Fleet depots, workplace and public charging" },
  { value: "developer", label: "New development or builder", hint: "Projects being planned, designed or built" },
];

const EQUIPMENT_OPTIONS: Option[] = [
  { value: "panels", label: "Solar panels" },
  { value: "inverter", label: "Inverter" },
  { value: "battery", label: "Battery storage" },
  { value: "ev_charger", label: "EV charger" },
  { value: "dg", label: "Generator (DG)" },
  { value: "meters", label: "Energy meters or monitoring" },
  { value: "nothing", label: "Nothing yet" },
  NOT_SURE,
];

const HOME_USAGE: Option[] = [
  { value: "under_2k", label: "Under ₹2,000 a month" },
  { value: "2k_5k", label: "₹2,000 to ₹5,000" },
  { value: "5k_10k", label: "₹5,000 to ₹10,000" },
  { value: "over_10k", label: "Over ₹10,000" },
  { value: "bill_later", label: "I'll share my latest bill later" },
  NOT_SURE,
];

const BUSINESS_USAGE: Option[] = [
  { value: "under_50k", label: "Under ₹50,000 a month" },
  { value: "50k_2l", label: "₹50,000 to ₹2 lakh" },
  { value: "2l_10l", label: "₹2 lakh to ₹10 lakh" },
  { value: "over_10l", label: "Over ₹10 lakh" },
  { value: "bill_later", label: "I'll share my bills and consumption later" },
  NOT_SURE,
];

const COUNT_OPTIONS: Option[] = [
  { value: "one", label: "One" },
  { value: "two_to_five", label: "2 to 5" },
  { value: "six_to_twenty", label: "6 to 20" },
  { value: "twenty_plus", label: "More than 20" },
  NOT_SURE,
];

export const usageOptions = (a: Answers): Option[] => (a.property === "home" || a.property === "apartment" || a.property === "developer" || !a.property ? HOME_USAGE : BUSINESS_USAGE);

// ---- The questions ----

export const QUESTIONS: Question[] = [
  {
    id: "goals",
    title: "What would you like WayTara to help with?",
    hint: "Choose up to two.",
    when: () => true,
    parts: [
      {
        field: "goals",
        kind: "multi",
        max: 2,
        options: GOAL_OPTIONS,
        exclusive: ["unsure"],
      },
    ],
  },
  {
    id: "property",
    title: "Where will this be used?",
    when: (_a, ctx) => !ctx.property,
    parts: [{ field: "property", kind: "single", options: PROPERTY_OPTIONS }],
  },
  {
    id: "apartment-scope",
    title: "What are you planning for?",
    when: (a) => a.property === "apartment",
    parts: [
      {
        field: "aptScope",
        kind: "single",
        options: [
          { value: "own", label: "My individual apartment" },
          { value: "common", label: "Common facilities and shared loads" },
          { value: "both", label: "Both" },
        ],
      },
    ],
  },
  {
    id: "developer-stage",
    title: "How far along is the project?",
    when: (a) => a.property === "developer",
    parts: [
      {
        field: "devStage",
        kind: "single",
        options: [
          { value: "concept", label: "Still at the concept stage" },
          { value: "design", label: "In design" },
          { value: "construction", label: "Under construction" },
          { value: "nearly_done", label: "Nearly complete" },
        ],
      },
    ],
  },
  {
    id: "equipment",
    title: "What equipment do you already have?",
    hint: "Select everything you have now. We will check compatibility with you later: no need to work it out.",
    when: (a) => a.property !== "developer",
    parts: [
      { field: "equipment", kind: "multi", options: EQUIPMENT_OPTIONS, exclusive: ["nothing", "unsure"] },
      {
        field: "batteryType",
        kind: "single",
        label: "What type of battery?",
        options: [
          { value: "lithium", label: "Lithium" },
          { value: "lead_acid", label: "Lead-acid" },
          NOT_SURE,
        ],
        when: (a) => has(a, "battery"),
      },
      {
        field: "keepInverter",
        kind: "single",
        label: "Would you prefer to keep your existing inverter, if it is compatible?",
        options: [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
          NOT_SURE,
        ],
        when: (a) => has(a, "inverter") && (wants(a, "upgrade") || wants(a, "bill") || wants(a, "backup")),
      },
    ],
  },
  {
    id: "usage",
    title: "Roughly how much electricity do you use?",
    hint: "A rough band is enough. It is only a signal: we do not size a system from it.",
    when: (a) => solarCandidate(a) || (isEpcPath(a) && businessProperty(a.property) && a.property !== "fleet"),
    parts: [{ field: "usage", kind: "single", options: usageOptions }],
  },
  {
    id: "ems",
    title: "What would you like to do with your equipment?",
    hint: "Choose any that apply.",
    when: (a) => wants(a, "monitor"),
    parts: [
      {
        field: "emsWants",
        kind: "multi",
        options: [
          { value: "view", label: "View generation and electricity usage" },
          { value: "battery", label: "Monitor battery and backup equipment" },
          { value: "control", label: "Monitor and control compatible inverter settings" },
          { value: "ev", label: "View and manage EV charging" },
          { value: "several", label: "Bring several pieces of equipment into one dashboard" },
        ],
      },
    ],
  },
  {
    id: "chargers",
    title: "Tell us about the chargers",
    when: (a) => wants(a, "chargers"),
    parts: [
      { field: "chargerCount", kind: "single", label: "How many chargers are installed or planned?", options: COUNT_OPTIONS },
      {
        field: "chargerUse",
        kind: "single",
        label: "Who uses them?",
        options: [
          { value: "personal", label: "Personal use" },
          { value: "shared", label: "Shared, such as residents or staff" },
          { value: "fleet", label: "A fleet" },
          { value: "public", label: "The public" },
        ],
      },
      {
        field: "chargerNeeds",
        kind: "multi",
        label: "What do you need from the software?",
        options: [
          { value: "access", label: "Access management" },
          { value: "records", label: "Charging records" },
          { value: "billing", label: "Billing" },
        ],
      },
    ],
  },
  {
    id: "backup",
    title: "When the grid goes down, what must keep running?",
    when: (a) => wants(a, "backup") || (a.property === "factory" && isEpcPath(a)),
    parts: [
      {
        field: "backup",
        kind: "single",
        options: [
          { value: "essential", label: "Essential loads", hint: "Lights, fans, Wi-Fi and refrigeration" },
          { value: "selected", label: "Selected appliances or equipment" },
          { value: "most", label: "Most of the property" },
          { value: "critical", label: "Critical equipment or operations" },
          { value: "none", label: "I don't need backup" },
        ],
      },
    ],
  },
  {
    id: "space",
    title: "Where might solar panels be installed?",
    when: (a) => solarCandidate(a),
    parts: [
      {
        field: "solarSpace",
        kind: "single",
        options: [
          { value: "roof", label: "Rooftop" },
          { value: "parking", label: "Parking area or canopy" },
          { value: "ground", label: "Available ground space" },
          { value: "none", label: "No suitable space that I know of" },
          NOT_SURE,
        ],
      },
    ],
  },
  {
    id: "ev",
    title: "Tell us about the EV charging",
    when: (a) => wants(a, "ev_install"),
    parts: [
      {
        field: "evHome",
        kind: "single",
        label: "Which describes you best?",
        options: [
          { value: "one", label: "One EV" },
          { value: "multiple", label: "Multiple EVs" },
          { value: "planning", label: "Planning to get an EV" },
          NOT_SURE,
        ],
        when: (a) => a.property === "home" || (a.property === "apartment" && a.aptScope === "own"),
      },
      {
        field: "evCount",
        kind: "single",
        label: "How many vehicles or chargers?",
        options: COUNT_OPTIONS,
        when: (a) => !(a.property === "home" || (a.property === "apartment" && a.aptScope === "own")),
      },
      {
        field: "evSimultaneous",
        kind: "single",
        label: "About how many charge at the same time?",
        options: COUNT_OPTIONS,
        when: (a) => !(a.property === "home" || (a.property === "apartment" && a.aptScope === "own")),
      },
      {
        field: "evDwell",
        kind: "single",
        label: "How long do vehicles usually stay parked?",
        options: [
          { value: "short", label: "Under an hour" },
          { value: "few_hours", label: "A few hours" },
          { value: "overnight", label: "Overnight" },
          NOT_SURE,
        ],
        when: (a) => !(a.property === "home" || (a.property === "apartment" && a.aptScope === "own")),
      },
    ],
  },
  {
    id: "operation",
    title: "How does the site operate?",
    when: (a) => (a.property === "commercial" || a.property === "factory") && isEpcPath(a),
    parts: [
      {
        field: "operation",
        kind: "single",
        options: [
          { value: "day", label: "Mainly daytime" },
          { value: "shifts", label: "Multiple shifts" },
          { value: "twenty_four", label: "24-hour operation" },
          { value: "variable", label: "Variable hours" },
        ],
      },
    ],
  },
  {
    id: "site-size",
    title: "How large is the site?",
    when: (a) => a.property === "campus",
    parts: [
      {
        field: "siteSize",
        kind: "single",
        options: [
          { value: "one", label: "One building" },
          { value: "buildings", label: "Multiple buildings at one campus" },
          { value: "locations", label: "Multiple locations" },
        ],
      },
    ],
  },
  {
    id: "facilities",
    title: "Which shared facilities are in scope?",
    hint: "Choose any that apply.",
    when: (a) => a.property === "apartment" && (a.aptScope === "common" || a.aptScope === "both"),
    parts: [
      {
        field: "aptFacilities",
        kind: "multi",
        options: [
          { value: "lifts", label: "Lifts" },
          { value: "pumps", label: "Water pumps" },
          { value: "lighting", label: "Common lighting" },
          { value: "clubhouse", label: "Clubhouse" },
          { value: "ev", label: "EV charging" },
          { value: "backup", label: "Backup" },
        ],
      },
    ],
  },
];

// ---- Navigation ----

export function resolveOptions(part: Part, a: Answers): Option[] {
  return typeof part.options === "function" ? part.options(a) : part.options;
}

/** The goal options a visitor sees: all of them, or only the ones that fit the door they came through. */
export function goalOptionsFor(ctx: PlannerContext): Option[] {
  const allowed = ctx.start ? GOALS_BY_START[ctx.start] : null;
  return allowed ? GOAL_OPTIONS.filter((o) => allowed.includes(o.value as Goal)) : GOAL_OPTIONS;
}

/** The questions that apply to these answers, in order. This changes as the visitor answers: that is the adaptive part. */
export function activeQuestions(a: Answers, ctx: PlannerContext = {}): Question[] {
  return QUESTIONS.filter((q) => q.when(a, ctx));
}

export function visibleParts(q: Question, a: Answers): Part[] {
  return q.parts.filter((p) => !p.when || p.when(a));
}

/** A question is done when every part showing has an answer. "Not sure" is an answer. Choosing a charger's software needs is optional. */
export function isQuestionComplete(q: Question, a: Answers): boolean {
  return visibleParts(q, a).every((p) => {
    if (p.field === "chargerNeeds") return true;
    const v = a[p.field];
    return Array.isArray(v) ? v.length > 0 : v !== undefined && v !== "";
  });
}

export function validProperty(value: string | null | undefined): Property | undefined {
  const map: Record<string, Property> = { home: "home", apartment: "apartment", commercial: "commercial", factory: "factory", "it-park": "campus", it_park: "campus", campus: "campus", "ev-fleet": "fleet", ev_fleet: "fleet", fleet: "fleet", developer: "developer" };
  return value ? map[value] : undefined;
}

export function validStart(value: string | null | undefined): PlannerContext["start"] {
  return value === "build" || value === "charge" || value === "manage" ? value : undefined;
}

/** What to start with: the property already known from the page the visitor came from. */
export function initialAnswers(ctx: PlannerContext): Answers {
  return { goals: [], equipment: [], emsWants: [], chargerNeeds: [], aptFacilities: [], ...(ctx.property ? { property: ctx.property } : {}) };
}

export const COUNT_LABEL: Record<ChargerCount, string> = { one: "One", two_to_five: "2 to 5", six_to_twenty: "6 to 20", twenty_plus: "More than 20", unsure: "Not sure" };
