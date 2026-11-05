import { describe, expect, it } from "vitest";
import { buildBlueprint } from "./engine";
import { activeQuestions, initialAnswers, isQuestionComplete } from "./flow";
import { plannerSummary } from "./summary";
import type { Answers } from "./types";

const answers = (a: Partial<Answers>): Answers => ({ goals: [], equipment: [], emsWants: [], chargerNeeds: [], aptFacilities: [], ...a });
const ids = (a: Answers) => activeQuestions(a, { property: a.property }).map((q) => q.id);

describe("which questions are asked", () => {
  it("asks goals first, and only the common screens before a goal is chosen", () => {
    expect(ids(answers({}))).toEqual(["goals", "property", "equipment"]);
  });

  it("asks nothing about roof space, usage or backup for someone who only wants to monitor equipment", () => {
    const a = answers({ goals: ["monitor"], property: "home", equipment: ["inverter"] });
    expect(ids(a)).toEqual(["goals", "equipment", "ems"]);
  });

  it("asks charger questions, and no solar or battery questions, for someone who only manages chargers", () => {
    const a = answers({ goals: ["chargers"], property: "fleet" });
    expect(ids(a)).toEqual(["goals", "equipment", "chargers"]);
  });

  it("asks about solar space and usage when solar is a candidate, and about backup when backup is a goal", () => {
    const a = answers({ goals: ["bill", "backup"], property: "home", equipment: ["nothing"] });
    expect(ids(a)).toEqual(["goals", "equipment", "usage", "backup", "space"]);
  });

  it("does not ask where the property is when it came from the page the visitor was on", () => {
    expect(activeQuestions(answers({ property: "factory" }), { property: "factory" }).map((q) => q.id)).not.toContain("property");
  });

  it("asks the apartment's follow-ups only for apartments, and the facilities only for shared facilities", () => {
    expect(ids(answers({ goals: ["bill"], property: "apartment" }))).toContain("apartment-scope");
    expect(ids(answers({ goals: ["bill"], property: "apartment", aptScope: "own" }))).not.toContain("facilities");
    expect(ids(answers({ goals: ["bill"], property: "apartment", aptScope: "common" }))).toContain("facilities");
  });

  it("treats 'Not sure' as an answer, so nobody is blocked", () => {
    const a = answers({ goals: ["bill"], property: "home", usage: "unsure" });
    const usage = activeQuestions(a, {}).find((q) => q.id === "usage")!;
    expect(isQuestionComplete(usage, a)).toBe(true);
  });

  it("starts with the property filled in when it is known", () => {
    expect(initialAnswers({ property: "campus" }).property).toBe("campus");
  });
});

describe("the recommendation", () => {
  it("recommends grid-connected solar for lower bills when there is space and no backup is needed, and says it is not backup", () => {
    const b = buildBlueprint(answers({ goals: ["bill"], property: "home", equipment: ["nothing"], usage: "2k_5k", solarSpace: "roof" }));
    expect(b.headline).toBe("Grid-connected solar");
    expect(b.routeLabel).toBe("EPC");
    expect(b.summary).toMatch(/does not provide backup/);
    expect(b.notIncluded.join(" ")).toMatch(/battery is not included/i);
  });

  it("never presents plain solar as backup: solar plus backup becomes solar plus battery backup", () => {
    const b = buildBlueprint(answers({ goals: ["bill", "backup"], property: "home", equipment: ["nothing"], usage: "5k_10k", backup: "essential", solarSpace: "roof" }));
    expect(b.headline).toBe("Solar + battery backup");
    expect(b.includes.map((i) => i.title)).toContain("Battery backup");
  });

  it("recommends battery backup alone when there is no suitable solar space, and explains why solar is left out", () => {
    const b = buildBlueprint(answers({ goals: ["bill", "backup"], property: "home", equipment: ["nothing"], usage: "5k_10k", backup: "essential", solarSpace: "none" }));
    expect(b.headline).toBe("Battery backup");
    expect(b.notIncluded.join(" ")).toMatch(/Solar is not included/);
  });

  it("does not add solar automatically when space is unknown", () => {
    const b = buildBlueprint(answers({ goals: ["bill"], property: "home", equipment: ["nothing"], usage: "unsure", solarSpace: "unsure" }));
    expect(b.headline).toBe("Solar, once your site is checked");
    expect(b.includes.map((i) => i.title)).not.toContain("Solar generation");
    expect(b.uncertain.join(" ")).toMatch(/suitable space for solar/);
  });

  it("keeps a compatible inverter and says to check before replacing when unsure", () => {
    const keep = buildBlueprint(answers({ goals: ["upgrade"], property: "home", equipment: ["inverter"], keepInverter: "yes" }));
    expect(keep.existing.join(" ")).toMatch(/keep it if it is compatible/);
    const unsure = buildBlueprint(answers({ goals: ["upgrade"], property: "home", equipment: ["inverter"], keepInverter: "unsure" }));
    expect(unsure.existing.join(" ")).toMatch(/Check compatibility before replacing/);
  });

  it("offers a lithium upgrade, subject to compatibility, for lead-acid backup", () => {
    const b = buildBlueprint(answers({ goals: ["backup"], property: "home", equipment: ["battery", "inverter"], batteryType: "lead_acid", keepInverter: "yes", backup: "essential" }));
    expect(b.existing.join(" ")).toMatch(/lead-acid battery could be upgraded to lithium, subject to compatibility/);
  });

  it("routes existing equipment to EMS and the platform page, with no new equipment recommended", () => {
    const b = buildBlueprint(answers({ goals: ["monitor"], property: "home", equipment: ["inverter", "battery"], emsWants: ["view", "control"] }));
    expect(b.routes).toEqual(["EMS"]);
    expect(b.next.pageHref).toBe("/technology#compatibility");
    expect(b.next.defaultNextStep).toBe("compatibility");
    expect(b.notIncluded.join(" ")).toMatch(/No new solar, battery or charger/);
  });

  it("routes existing chargers to CPMS and the EV Fleets page", () => {
    const b = buildBlueprint(answers({ goals: ["chargers"], property: "fleet", equipment: ["ev_charger"], chargerCount: "six_to_twenty", chargerUse: "fleet", chargerNeeds: ["records"] }));
    expect(b.routes).toEqual(["CPMS"]);
    expect(b.next.pageHref).toBe("/solutions/ev-fleet#cpms");
  });

  it("combines equipment and chargers into EMS + CPMS", () => {
    const b = buildBlueprint(answers({ goals: ["monitor", "chargers"], property: "commercial", equipment: ["inverter", "ev_charger"], emsWants: ["several"], chargerCount: "two_to_five", chargerUse: "shared" }));
    expect(b.routeLabel).toBe("EMS + CPMS");
  });

  it("gives an assessment, not a package, for the larger property types", () => {
    const base = { goals: ["bill" as const], equipment: ["nothing" as const], usage: "2l_10l", solarSpace: "roof" as const };
    expect(buildBlueprint(answers({ ...base, property: "commercial", operation: "day" })).headline).toBe("Commercial solar and storage assessment");
    expect(buildBlueprint(answers({ ...base, property: "factory", operation: "shifts", backup: "none" })).routes).toEqual(["EPC", "EMS"]);
    expect(buildBlueprint(answers({ ...base, property: "campus", siteSize: "buildings" })).headline).toBe("Integrated site energy assessment");
  });

  it("sends a new fleet charging site to EPC + CPMS", () => {
    const b = buildBlueprint(answers({ goals: ["ev_install"], property: "fleet", equipment: ["nothing"], evCount: "six_to_twenty", evSimultaneous: "two_to_five", evDwell: "overnight" }));
    expect(b.routeLabel).toBe("EPC + CPMS");
    expect(b.headline).toBe("Managed EV charging infrastructure");
  });

  it("sends a developer to the design discussion on the apartments page", () => {
    const b = buildBlueprint(answers({ goals: ["bill", "ev_install"], property: "developer", devStage: "design", solarSpace: "roof" }));
    expect(b.headline).toBe("Energy-ready design discussion");
    expect(b.next.pageHref).toBe("/solutions/apartment#developers");
  });

  it("suggests a conversation first when the visitor is not sure", () => {
    const b = buildBlueprint(answers({ goals: ["unsure"], property: "home", equipment: ["unsure"] }));
    expect(b.routes).toEqual([]);
    expect(b.routeLabel).toBe("Talk to us first");
    expect(b.next.defaultNextStep).toBe("specialist");
  });

  it("never returns money, savings, payback, CO2 or hours of backup", () => {
    const b = buildBlueprint(answers({ goals: ["bill", "backup", "ev_install"], property: "home", equipment: ["nothing"], usage: "over_10k", backup: "most", solarSpace: "roof", evHome: "one" }));
    const text = JSON.stringify(b);
    expect(text).not.toMatch(/₹\s?\d|payback|savings|CO2|CO₂|\d+\s?hours|\bkW\b|\bkWh\b/i);
  });
});

describe("the enquiry summary", () => {
  it("lists what the visitor chose in words, then the recommendation, route and page", () => {
    const a = answers({ goals: ["bill", "backup"], property: "home", equipment: ["nothing"], usage: "5k_10k", backup: "essential", solarSpace: "roof" });
    const text = plannerSummary(a, buildBlueprint(a), {}, "landing page");
    expect(text).toContain("What would you like WayTara to help with?: Reduce my electricity bills with solar; Add battery backup");
    expect(text).toContain("Where will this be used?: Home or villa");
    expect(text).toContain("Planner recommendation: Solar + battery backup");
    expect(text).toContain("Route: EPC");
    expect(text).toContain("Page: /solutions/home");
    expect(text).toContain("Arrived via: landing page");
  });

  it("adds the property when it came from the page the visitor was on", () => {
    const a = answers({ goals: ["monitor"], property: "factory", equipment: ["inverter"], emsWants: ["view"] });
    expect(plannerSummary(a, buildBlueprint(a), { property: "factory" })).toContain("Property: factory");
  });

  it("stays within the enquiry's length limit", () => {
    const a = answers({ goals: ["bill"], property: "home", equipment: ["nothing"], usage: "unsure", solarSpace: "unsure" });
    expect(plannerSummary(a, buildBlueprint(a)).length).toBeLessThanOrEqual(3000);
  });
});
