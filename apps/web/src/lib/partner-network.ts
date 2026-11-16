// The WayTara Partner Network (Tamil Nadu): the four kinds of partner, the short questions each one answers, the regions we recruit in, and the checking of the
// answers. Shared by the form and the API route so the two can never disagree, and pure so it is tested.

import { PARTNER_CITIES } from "./partner-options";

export const PARTNER_TYPES = [
  { id: "contractor", label: "Electrical contractor", blurb: "A licensed contractor business or electrical EPC company" },
  { id: "solar", label: "Solar installation partner", blurb: "A solar EPC company or an installation team" },
  { id: "ev", label: "EV charging partner", blurb: "Charger installers, commissioning and integration teams" },
  { id: "technician", label: "Field technician", blurb: "An electrician or technician working on projects" },
] as const;

export type PartnerTypeId = (typeof PARTNER_TYPES)[number]["id"];
export const PARTNER_TYPE_IDS = PARTNER_TYPES.map((t) => t.id) as [PartnerTypeId, ...PartnerTypeId[]];
export const PARTNER_TYPE_LABEL: Record<string, string> = Object.fromEntries(PARTNER_TYPES.map((t) => [t.id, t.label]));
export const isPartnerType = (v: unknown): v is PartnerTypeId => typeof v === "string" && PARTNER_TYPE_IDS.includes(v as PartnerTypeId);

/** The districts and cities of Tamil Nadu to pick from. */
export const TN_DISTRICTS: readonly string[] = PARTNER_CITIES["Tamil Nadu"];

/** The regions the network recruits in, and the places in each. */
export const PARTNER_REGIONS = [
  { name: "Chennai and the north", places: ["Chennai", "Tiruvallur", "Chengalpattu", "Kanchipuram", "Vellore", "Ranipet"] },
  { name: "Western Tamil Nadu", places: ["Coimbatore", "Tiruppur", "Erode", "Salem", "Namakkal", "Hosur"] },
  { name: "Central and the south", places: ["Tiruchirappalli", "Thanjavur", "Madurai", "Dindigul", "Tirunelveli", "Thoothukudi"] },
] as const;

export interface Choice {
  id: string;
  label: string;
}
export interface Question {
  key: string;
  label: string;
  /** single: one choice; multi: any number (at least one when required); text: a short line */
  kind: "single" | "multi" | "text";
  options?: readonly Choice[];
  required: boolean;
  /** Asked only when another answer of the same form has this value. */
  showIf?: { key: string; equals: string };
  placeholder?: string;
}

const YES_NO_NOT_SURE: readonly Choice[] = [
  { id: "yes", label: "Yes" },
  { id: "no", label: "No" },
  { id: "not_sure", label: "Not sure" },
];
const YES_NO: readonly Choice[] = [
  { id: "yes", label: "Yes" },
  { id: "no", label: "No" },
];
const EXPERIENCE: readonly Choice[] = [
  { id: "under_2", label: "Below 2 years" },
  { id: "2_5", label: "2 to 5 years" },
  { id: "5_10", label: "5 to 10 years" },
  { id: "over_10", label: "More than 10 years" },
];

/** The questions after the contact details and the district, for each kind of partner. */
export const PARTNER_QUESTIONS: Record<PartnerTypeId, readonly Question[]> = {
  contractor: [
    { key: "business", label: "Business or company name", kind: "text", required: true },
    { key: "tnelb", label: "Do you currently hold a TNELB electrical contractor licence?", kind: "single", options: YES_NO_NOT_SURE, required: true },
    {
      key: "tnelb_grade",
      label: "If yes, which grade?",
      kind: "single",
      options: [
        { id: "eb", label: "EB" },
        { id: "esb", label: "ESB" },
        { id: "ea", label: "EA" },
        { id: "esa", label: "ESA" },
        { id: "other", label: "Other" },
      ],
      required: true,
      showIf: { key: "tnelb", equals: "yes" },
    },
    { key: "experience", label: "Years of experience", kind: "single", options: EXPERIENCE, required: true },
    {
      key: "services",
      label: "Your main services",
      kind: "multi",
      options: [
        { id: "electrical_contracting", label: "Electrical contracting" },
        { id: "solar_epc", label: "Solar EPC" },
        { id: "industrial_electrical", label: "Industrial electrical" },
        { id: "ev_charging", label: "EV charging" },
      ],
      required: true,
    },
  ],
  solar: [
    { key: "business", label: "Business or team name", kind: "text", required: true },
    {
      key: "services",
      label: "What installations do you handle?",
      kind: "multi",
      options: [
        { id: "residential_rooftop", label: "Residential rooftop" },
        { id: "commercial_rooftop", label: "Commercial rooftop" },
        { id: "industrial_solar", label: "Industrial solar" },
        { id: "hybrid_systems", label: "Hybrid systems" },
      ],
      required: true,
    },
    { key: "experience", label: "Years of experience", kind: "single", options: EXPERIENCE, required: true },
    { key: "installed_before", label: "Have you completed solar installations before?", kind: "single", options: YES_NO, required: true },
    { key: "licensed_contractor", label: "Is the electrical work done through an appropriately licensed contractor?", kind: "single", options: YES_NO_NOT_SURE, required: true },
  ],
  ev: [
    { key: "business", label: "Business or team name", kind: "text", required: true },
    {
      key: "services",
      label: "Which services do you offer?",
      kind: "multi",
      options: [
        { id: "ac_charger", label: "AC charger installation" },
        { id: "dc_charger", label: "DC charger installation" },
        { id: "commissioning", label: "Charger commissioning" },
        { id: "ev_electrical", label: "EV electrical infrastructure" },
        { id: "ocpp_cms", label: "OCPP / CMS integration" },
        { id: "ev_maintenance", label: "Maintenance and service" },
      ],
      required: true,
    },
    { key: "experience", label: "Years of experience", kind: "single", options: EXPERIENCE, required: true },
    { key: "installed_before", label: "Have you installed EV chargers before?", kind: "single", options: YES_NO, required: true },
    { key: "licensed_contractor", label: "Where it is required, is the electrical work done through an appropriately licensed contractor?", kind: "single", options: YES_NO_NOT_SURE, required: true },
  ],
  technician: [
    {
      key: "services",
      label: "Your trade",
      kind: "single",
      options: [
        { id: "electrician", label: "Electrician" },
        { id: "solar_technician", label: "Solar technician" },
        { id: "inverter_battery_technician", label: "Inverter or battery technician" },
        { id: "ev_technician", label: "EV charger technician" },
        { id: "electronics_technician", label: "Electronics technician" },
        { id: "other_trade", label: "Other" },
      ],
      required: true,
    },
    {
      key: "qualification",
      label: "Your qualification",
      kind: "single",
      options: [
        { id: "iti", label: "ITI" },
        { id: "diploma", label: "Diploma" },
        { id: "degree", label: "Degree" },
        { id: "experience_based", label: "Other or experience-based" },
      ],
      required: true,
    },
    { key: "experience", label: "Years of experience", kind: "single", options: EXPERIENCE, required: true },
    {
      key: "certificate",
      label: "Do you hold a Wireman or Supervisor competency certificate?",
      kind: "single",
      options: [
        { id: "wireman", label: "Wireman" },
        { id: "supervisor", label: "Supervisor" },
        { id: "both", label: "Both" },
        { id: "neither", label: "Neither" },
      ],
      required: true,
    },
    { key: "available", label: "Are you available for project-based assignments?", kind: "single", options: YES_NO, required: true },
  ],
};

/** How every id stored in `services` reads to a person: the ones of the questions above, and the ones of the form that came before it. */
export const PARTNER_SERVICE_LABEL: Record<string, string> = {
  ...Object.fromEntries(Object.values(PARTNER_QUESTIONS).flatMap((qs) => qs.filter((q) => q.key === "services").flatMap((q) => (q.options ?? []).map((o) => [o.id, o.label])))),
  solar: "Solar installation",
  battery: "Battery storage",
  ev_charger: "EV charger installation",
  ems_integration: "Monitoring and integration",
  maintenance: "Operations and maintenance",
};

/** Whether a question is asked, given the answers so far. */
export function isAsked(q: Question, answers: Record<string, string | string[] | undefined>): boolean {
  return !q.showIf || answers[q.showIf.key] === q.showIf.equals;
}

export type RawAnswers = Record<string, unknown>;

export interface CheckedAnswers {
  /** The questions and answers as people read them, in the order of the form (stored with the application so the admins need no list of questions). */
  qa: { q: string; a: string }[];
  /** The ids of the "services" question: what the partner does (a technician's trade is one id). */
  services: string[];
  /** The answer to a question by key, as its label (or the text typed). */
  byKey: Record<string, string>;
}

const MAX_TEXT = 200;

/**
 * Checks what came from the form against the questions of the partner's kind: every asked, required question has an answer, every choice is one of the
 * options, nothing unknown gets in, and a question that is not asked (the licence grade of someone with no licence) is dropped. Returns the first problem
 * as a sentence a person can act on.
 */
export function checkPartnerAnswers(type: PartnerTypeId, raw: RawAnswers): { ok: true; value: CheckedAnswers } | { ok: false; error: string } {
  const questions = PARTNER_QUESTIONS[type];
  // the choice ids as given, for the "asked only when" rules
  const given: Record<string, string | string[] | undefined> = {};
  for (const q of questions) {
    const v = raw[q.key];
    given[q.key] = Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : typeof v === "string" ? v.trim() : undefined;
  }
  const qa: { q: string; a: string }[] = [];
  const byKey: Record<string, string> = {};
  let services: string[] = [];
  for (const q of questions) {
    if (!isAsked(q, given)) continue;
    const v = given[q.key];
    const empty = v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
    if (empty) {
      if (q.required) return { ok: false, error: `Please answer: ${q.label}` };
      continue;
    }
    if (q.kind === "text") {
      const text = String(v);
      if (text.length < 2 || text.length > MAX_TEXT) return { ok: false, error: `Please check: ${q.label}` };
      qa.push({ q: q.label, a: text });
      byKey[q.key] = text;
      continue;
    }
    const ids = Array.isArray(v) ? v : [v as string];
    if (q.kind === "single" && ids.length !== 1) return { ok: false, error: `Choose one answer for: ${q.label}` };
    const chosen = ids.map((id) => q.options?.find((o) => o.id === id));
    if (chosen.some((c) => !c) || new Set(ids).size !== ids.length) return { ok: false, error: `Please check: ${q.label}` };
    const labels = (chosen as Choice[]).map((c) => c.label);
    qa.push({ q: q.label, a: labels.join(", ") });
    byKey[q.key] = labels.join(", ");
    if (q.key === "services") services = ids;
  }
  return { ok: true, value: { qa, services, byKey } };
}

const REFERENCE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0, 1, I or O: easy to read out over the phone

/** The application reference the applicant is given and quotes on the phone: WTP-YYMM-XXXXX (the month it was made, then five random characters). */
export function makePartnerReference(now: Date, random: () => number = Math.random): string {
  const yy = String(now.getUTCFullYear() % 100).padStart(2, "0");
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  let tail = "";
  for (let i = 0; i < 5; i++) tail += REFERENCE_ALPHABET[Math.floor(random() * REFERENCE_ALPHABET.length)];
  return `WTP-${yy}${mm}-${tail}`;
}
