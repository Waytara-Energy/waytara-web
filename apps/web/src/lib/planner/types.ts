// The Energy Planner (v3): what a visitor can answer. The planner asks goal-first, only what changes the result, and never asks for a location
// before it has shown a blueprint (docs/WEBSITE_PLAN.md section 8).

export const GOALS = ["bill", "backup", "ev_install", "upgrade", "monitor", "chargers", "unsure"] as const;
export type Goal = (typeof GOALS)[number];

export const PROPERTIES = ["home", "apartment", "commercial", "factory", "campus", "fleet", "developer"] as const;
export type Property = (typeof PROPERTIES)[number];

export const EQUIPMENT = ["panels", "inverter", "battery", "ev_charger", "dg", "meters", "nothing", "unsure"] as const;
export type Equipment = (typeof EQUIPMENT)[number];

export type YesNoUnsure = "yes" | "no" | "unsure";
export type BatteryType = "lithium" | "lead_acid" | "unsure";
export type AptScope = "own" | "common" | "both";
export type DevStage = "concept" | "design" | "construction" | "nearly_done";
export type EmsWant = "view" | "battery" | "control" | "ev" | "several";
export type ChargerCount = "one" | "two_to_five" | "six_to_twenty" | "twenty_plus" | "unsure";
export type ChargerUse = "personal" | "shared" | "fleet" | "public";
export type ChargerNeed = "access" | "records" | "billing";
export type BackupNeed = "essential" | "selected" | "most" | "critical" | "none";
export type SolarSpace = "roof" | "parking" | "ground" | "none" | "unsure";
export type EvHome = "one" | "multiple" | "planning" | "unsure";
export type EvDwell = "short" | "few_hours" | "overnight" | "unsure";
export type Operation = "day" | "shifts" | "twenty_four" | "variable";
export type SiteSize = "one" | "buildings" | "locations";
export type AptFacility = "lifts" | "pumps" | "lighting" | "clubhouse" | "ev" | "backup";

/** Every answer, all optional until asked. Arrays start empty. */
export interface Answers {
  goals: Goal[];
  property?: Property;
  aptScope?: AptScope;
  devStage?: DevStage;
  equipment: Equipment[];
  batteryType?: BatteryType;
  keepInverter?: YesNoUnsure;
  /** The usage band the visitor picked (its id), or "unsure". */
  usage?: string;
  emsWants: EmsWant[];
  chargerCount?: ChargerCount;
  chargerUse?: ChargerUse;
  chargerNeeds: ChargerNeed[];
  backup?: BackupNeed;
  solarSpace?: SolarSpace;
  evHome?: EvHome;
  evCount?: ChargerCount;
  evSimultaneous?: ChargerCount;
  evDwell?: EvDwell;
  operation?: Operation;
  siteSize?: SiteSize;
  aptFacilities: AptFacility[];
}

export const EMPTY_ANSWERS: Answers = { goals: [], equipment: [], emsWants: [], chargerNeeds: [], aptFacilities: [] };

/** How the visitor arrived: the landing page's three doors and the segment pages pass these in the address (`?start=` and `?for=`). */
export interface PlannerContext {
  start?: "build" | "charge" | "manage";
  /** A property already known from the page the visitor came from. */
  property?: Property;
}

export type RouteName = "EPC" | "EMS" | "CPMS";
export type NextStep = "assessment" | "specialist" | "compatibility";

export interface IncludedItem {
  title: string;
  detail: string;
}

/** What the planner returns. No sizes, prices, savings, payback or backup hours: those need an assessment of the actual site. */
export interface Blueprint {
  /** The routes involved: a visitor may need more than one. Empty means "talk to us first". */
  routes: RouteName[];
  routeLabel: string;
  headline: string;
  summary: string;
  includes: IncludedItem[];
  why: string[];
  notIncluded: string[];
  existing: string[];
  uncertain: string[];
  next: {
    pageHref: string;
    pageLabel: string;
    enquiryLabel: string;
    defaultNextStep: NextStep;
  };
}
