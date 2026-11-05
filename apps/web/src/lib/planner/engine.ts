import { has, isEpcPath, solarCandidate, wants } from "./flow";
import type { Answers, Blueprint, IncludedItem, NextStep, Property, RouteName } from "./types";

// The recommendation engine: deterministic rules, not a first-match tree. It combines the answers, applies the hard constraints, and returns one
// main recommendation with its reasons. It never returns sizes, prices, savings, payback, CO2 figures or hours of backup: those need an
// assessment of the actual site and are not safe outcomes of these answers.
//
// Hard constraints (from the notes):
//  - If the visitor needs backup, ordinary grid-connected solar is never presented as though it provides backup.
//  - If solar space is unsuitable or unknown, solar is not added automatically.
//  - Equipment the visitor already has is kept where compatible; if compatibility is unknown the result says "check before replacing".

type SolarState = "yes" | "unknown" | "no" | "na";

interface Derived {
  epc: boolean;
  monitor: boolean;
  chargers: boolean;
  solar: SolarState;
  backup: boolean;
  ev: boolean;
  /** An apartment visitor planning for common facilities (rather than their own flat). */
  community: boolean;
}

export function derive(a: Answers): Derived {
  const epc = isEpcPath(a);
  let solar: SolarState = "na";
  if (solarCandidate(a)) {
    solar = a.solarSpace === "roof" || a.solarSpace === "parking" || a.solarSpace === "ground" ? "yes" : a.solarSpace === "none" ? "no" : "unknown";
  }
  const backup = wants(a, "backup") ? a.backup !== "none" : false;
  return {
    epc,
    monitor: wants(a, "monitor"),
    chargers: wants(a, "chargers"),
    solar,
    backup,
    ev: wants(a, "ev_install"),
    community: a.property === "apartment" && (a.aptScope === "common" || a.aptScope === "both"),
  };
}

const PAGE: Record<Property, { href: string; label: string }> = {
  home: { href: "/solutions/home", label: "Homes & Villas" },
  apartment: { href: "/solutions/apartment", label: "Apartments, RWAs & Developers" },
  commercial: { href: "/solutions/commercial", label: "Commercial & Workspaces" },
  factory: { href: "/solutions/factory", label: "Factory & Industrial" },
  campus: { href: "/solutions/it-park", label: "IT Parks & Campuses" },
  fleet: { href: "/solutions/ev-fleet", label: "EV Fleets & Charging" },
  developer: { href: "/solutions/apartment#developers", label: "Apartments, RWAs & Developers" },
};

const ENQUIRY: Record<NextStep, string> = {
  assessment: "Request a site assessment",
  specialist: "Speak with an energy specialist",
  compatibility: "Check my equipment compatibility",
};

const SPACE_LABEL: Record<string, string> = { roof: "your rooftop", parking: "your parking area or canopy", ground: "available ground space" };

function routeLabel(routes: RouteName[]): string {
  return routes.length === 0 ? "Talk to us first" : routes.join(" + ");
}

function existingNotes(a: Answers, d: Derived): string[] {
  const out: string[] = [];
  if (has(a, "inverter")) {
    if (a.keepInverter === "yes") out.push("You would like to keep your inverter. We check its make and model before anything is replaced, and keep it if it is compatible.");
    else if (a.keepInverter === "no") out.push("You would rather replace your inverter. We will explain what that involves once we know the make and model.");
    else out.push("Check compatibility before replacing your inverter: we need its make and model.");
  }
  if (has(a, "battery")) {
    if (a.batteryType === "lead_acid" && (d.backup || wants(a, "upgrade"))) out.push("Your lead-acid battery could be upgraded to lithium, subject to compatibility with your inverter.");
    else if (a.batteryType === "lithium") out.push("Your lithium battery can stay if it is compatible with the rest of the system.");
    else out.push("Check what type of battery you have, and whether it is compatible, before replacing it.");
  }
  if (has(a, "panels")) out.push("Your existing panels can be assessed for reuse. We look at their condition and compatibility first.");
  if (has(a, "ev_charger")) out.push("Your existing charger can join WayTara charging management if it supports OCPP.");
  if (has(a, "dg")) out.push("Your generator can be integrated where it is technically suitable.");
  if (has(a, "meters")) out.push("Your existing meters can be connected for monitoring, subject to compatibility.");
  return out;
}

function whyLines(a: Answers, d: Derived): string[] {
  const out: string[] = [];
  if (wants(a, "bill")) out.push("You want to use less electricity from the grid.");
  if (d.backup) out.push("You need selected loads to keep running when the grid is down.");
  if (d.ev) out.push("You want EV charging as part of the plan.");
  if (wants(a, "upgrade")) out.push("You already have equipment and want to build on it, not start over.");
  if (d.monitor) out.push("You want to see and manage equipment you already have.");
  if (d.chargers) out.push("You want to manage more than one charger from one place.");
  if (d.solar === "yes" && d.backup) out.push("Solar and storage can be designed as one system.");
  return out.slice(0, 4);
}

function uncertainLines(a: Answers, d: Derived): string[] {
  const out: string[] = [];
  if (d.solar === "unknown") out.push("Whether you have suitable space for solar.");
  if (a.usage === "unsure") out.push("How much electricity you use. A recent bill would settle it.");
  if (a.equipment.includes("unsure")) out.push("What equipment you already have.");
  if (has(a, "inverter") || has(a, "ev_charger") || has(a, "meters") || has(a, "battery")) out.push("Compatibility of your existing equipment. We need its make and model.");
  if (d.chargers && a.chargerCount === "unsure") out.push("How many chargers are involved.");
  if (d.ev && (a.evHome === "unsure" || a.evCount === "unsure")) out.push("How much EV charging you will need.");
  return out;
}

/** The recommendation for a set of answers. */
export function buildBlueprint(a: Answers): Blueprint {
  const d = derive(a);
  const page = a.property ? PAGE[a.property] : PAGE.home;

  // No goal that leads anywhere yet: a conversation first.
  if (!d.epc && !d.monitor && !d.chargers) {
    return finish(a, d, {
      routes: [],
      headline: "A short conversation first",
      summary: "You are not sure where to start, which is a perfectly good place to begin. An energy specialist can talk through your property and what you want to achieve.",
      includes: [{ title: "A conversation with a specialist", detail: "We ask about your property and what you want to improve, and suggest where to begin." }],
      notIncluded: ["No equipment is recommended yet: we would rather understand your situation first."],
      pageHref: a.property ? page.href : "/solutions",
      pageLabel: a.property ? page.label : "Solutions",
      step: "specialist",
    });
  }

  // Existing equipment and chargers only: EMS and/or CPMS, no solar sizing questions asked.
  if (!d.epc) {
    const routes: RouteName[] = [...(d.monitor ? (["EMS"] as const) : []), ...(d.chargers ? (["CPMS"] as const) : [])];
    const both = d.monitor && d.chargers;
    const includes: IncludedItem[] = [];
    if (d.monitor) {
      includes.push({ title: "Energy monitoring", detail: "See generation, usage and the status of compatible inverters, batteries and meters in the WayTara dashboard." });
      if (a.emsWants.includes("control")) includes.push({ title: "Supported controls", detail: "Change selected, tested inverter settings from the dashboard, where your equipment is supported." });
      if (a.emsWants.includes("ev") || a.emsWants.includes("several")) includes.push({ title: "One dashboard", detail: "Bring several pieces of equipment, including chargers, into one place." });
    }
    if (d.chargers) {
      includes.push({ title: "Charger management", detail: "Connect compatible OCPP chargers to WayTara CPMS: status, sessions and supported remote controls." });
    }
    return finish(a, d, {
      routes,
      headline: both ? "One platform for your equipment and your chargers" : d.monitor ? "Connect and manage your existing system" : "Manage your charging infrastructure",
      summary: both
        ? "Bring compatible energy equipment and OCPP chargers into WayTara, so you can see and manage them together. You do not need to buy a new installation to start."
        : d.monitor
          ? "Bring supported inverters, batteries and meters into WayTara EMS. View energy performance and use the controls available for your equipment."
          : "Connect supported OCPP chargers to WayTara CPMS to manage your chargers and see their sessions, without replacing what you have.",
      includes,
      notIncluded: [
        "No new solar, battery or charger is recommended: you asked about equipment you already have.",
        ...(d.chargers && (a.chargerNeeds.includes("billing") || a.chargerNeeds.includes("access"))
          ? ["Access management and billing are discussed per project: we confirm what applies to your chargers before promising it."]
          : []),
      ],
      pageHref: both || d.monitor ? "/technology#compatibility" : "/solutions/ev-fleet#cpms",
      pageLabel: both || d.monitor ? "Platform" : "EV Fleets & Charging",
      step: "compatibility",
    });
  }

  // New or upgraded infrastructure: EPC, with EMS or CPMS added where the answers call for them.
  const parts: string[] = [];
  const includes: IncludedItem[] = [];
  const notIncluded: string[] = [];

  if (d.solar === "yes") {
    parts.push("solar");
    includes.push({ title: "Solar generation", detail: `Designed for ${SPACE_LABEL[a.solarSpace as string] ?? "your site"}. Panel capacity is set after a site assessment.` });
  } else if (d.solar === "unknown") {
    notIncluded.push("Solar is not added yet: we need to check whether your site can take it first.");
  } else if (d.solar === "no") {
    notIncluded.push("Solar is not included: you do not have suitable space that you know of.");
  }

  if (d.backup) {
    parts.push("battery backup");
    includes.push({ title: "Battery backup", detail: "Sized around the loads you want to keep running, not around your bill." });
  } else if (wants(a, "bill")) {
    notIncluded.push("A battery is not included: you did not ask for backup. We can still assess one later.");
  }

  if (d.ev) {
    parts.push("EV charging");
    const home = a.property === "home" || (a.property === "apartment" && a.aptScope === "own");
    includes.push({ title: "EV charging", detail: home ? "A dedicated charger, planned alongside your home's electricity demand." : "Charging infrastructure sized from how many vehicles charge at once and how long they stay." });
  }

  const routes: RouteName[] = ["EPC"];
  if (d.ev && d.solar === "yes") routes.push("EMS");
  if (a.property === "factory" || a.property === "campus") routes.push("EMS");
  if (a.property === "fleet" || (d.ev && (a.property === "apartment" || a.property === "commercial") && !(a.property === "apartment" && a.aptScope === "own"))) routes.push("CPMS");
  if (d.monitor) routes.push("EMS");
  if (d.chargers) routes.push("CPMS");

  includes.push({ title: "Energy monitoring", detail: "View your connected equipment in the WayTara dashboard, with controls for supported equipment and settings." });

  // The headline: what is actually being recommended.
  let headline: string;
  if (parts.length > 0) {
    headline = parts.length === 1 && parts[0] === "solar" ? "Grid-connected solar" : capitalise(parts.join(" + "));
  } else if (d.solar === "unknown") {
    headline = "Solar, once your site is checked";
  } else if (wants(a, "upgrade")) {
    headline = "Upgrade or expand your existing system";
  } else {
    headline = "An energy assessment before any equipment";
  }

  // Property overlays: the bigger families get an assessment-led headline, not a package.
  if (a.property === "apartment" && d.community) headline = d.ev ? "Community solar, backup and managed charging assessment" : "Community solar and backup assessment";
  else if (a.property === "commercial") headline = "Commercial solar and storage assessment";
  else if (a.property === "factory") headline = a.backup === "critical" || d.backup ? "Industrial energy system and battery assessment" : "Industrial energy system assessment";
  else if (a.property === "campus") headline = "Integrated site energy assessment";
  else if (a.property === "fleet") headline = "Managed EV charging infrastructure";
  else if (a.property === "developer") headline = "Energy-ready design discussion";

  const unique = Array.from(new Set(routes));
  return finish(a, d, {
    routes: unique,
    headline,
    summary: summaryFor(a, d, headline),
    includes,
    notIncluded,
    pageHref: page.href,
    pageLabel: page.label,
    step: "assessment",
  });
}

function summaryFor(a: Answers, d: Derived, headline: string): string {
  if (a.property === "developer") return "The best time to plan energy infrastructure is before the electrical design is frozen. A design discussion covers solar, EV charging, backup and connected operations for your project.";
  if (d.backup && d.solar !== "yes") return "A battery system designed around the loads you want to keep running. Solar can be added once your site has been checked.";
  if (d.backup) return "A solar and battery system is a suitable starting point: it lowers your grid use while keeping the loads you chose running in a power cut.";
  if (d.solar === "yes") return "Solar is a suitable starting point for lowering your grid electricity use. It does not provide backup on its own: standard grid-connected solar switches off when the grid fails.";
  return `${headline} is where we would start. The next step is an assessment of your site and electrical set-up.`;
}

interface Core {
  routes: RouteName[];
  headline: string;
  summary: string;
  includes: IncludedItem[];
  notIncluded: string[];
  pageHref: string;
  pageLabel: string;
  step: NextStep;
}

function finish(a: Answers, d: Derived, c: Core): Blueprint {
  return {
    routes: c.routes,
    routeLabel: routeLabel(c.routes),
    headline: c.headline,
    summary: c.summary,
    includes: c.includes,
    why: whyLines(a, d),
    notIncluded: c.notIncluded,
    existing: existingNotes(a, d),
    uncertain: uncertainLines(a, d),
    next: { pageHref: c.pageHref, pageLabel: c.pageLabel, enquiryLabel: ENQUIRY[c.step], defaultNextStep: c.step },
  };
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export { ENQUIRY as ENQUIRY_LABELS };
