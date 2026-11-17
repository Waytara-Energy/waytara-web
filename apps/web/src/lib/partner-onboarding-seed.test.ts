import { describe, expect, it } from "vitest";
import { emptyOnboarding } from "@waytara/supabase/partner-onboarding";
import { PARTNER_QUESTIONS } from "./partner-network";
import { seedOnboarding, type SeedSource } from "./partner-onboarding-seed";

const label = (type: "contractor" | "solar", key: string) => PARTNER_QUESTIONS[type].find((q) => q.key === key)!.label;
const source = (over: Partial<SeedSource> = {}): SeedSource => ({
  partnerType: "contractor",
  contactName: "Priya Raman",
  companyName: "Sun Electricals",
  cities: "Chennai; also Madurai, Salem",
  answers: [
    { q: label("contractor", "entity"), a: "Private limited company" },
    { q: label("contractor", "role"), a: "Director" },
  ],
  ...over,
});

describe("seedOnboarding", () => {
  it("carries the name, the kind of business, the business name, the role and the districts across", () => {
    const d = seedOnboarding(emptyOnboarding(), source());
    expect(d.person.name).toBe("Priya Raman");
    expect(d.person.designation).toBe("Director");
    expect(d.business.kind).toBe("company");
    expect(d.business.name).toBe("Sun Electricals");
    expect(d.areas.districts).toEqual(["Chennai", "Madurai", "Salem"]);
  });

  it("maps each kind of business the apply form offers to one the onboarding has", () => {
    for (const [a, kind] of [["Individual (no registered business)", "individual"], ["Proprietorship", "proprietorship"], ["Partnership", "partnership"], ["LLP", "llp"], ["Private limited company", "company"]]) {
      expect(seedOnboarding(emptyOnboarding(), source({ answers: [{ q: label("contractor", "entity"), a }] })).business.kind).toBe(kind);
    }
  });

  it("never overwrites what is already there", () => {
    const saved = emptyOnboarding();
    saved.business = { ...saved.business, name: "Typed Name", kind: "llp" };
    saved.person = { ...saved.person, name: "P. Raman", designation: "Owner" };
    saved.areas.districts = ["Erode"];
    const d = seedOnboarding(saved, source());
    expect([d.business.name, d.business.kind, d.person.name, d.person.designation, d.areas.districts]).toEqual(["Typed Name", "llp", "P. Raman", "Owner", ["Erode"]]);
  });

  it("does not offer a technician's own name as a business name, nor a role they were never asked", () => {
    const d = seedOnboarding(emptyOnboarding(), source({ partnerType: "technician", companyName: "Priya Raman", answers: [], cities: "Coimbatore" }));
    expect(d.business.name).toBe("");
    expect(d.person.designation).toBe("");
    expect(d.areas.districts).toEqual(["Coimbatore"]);
  });

  it("leaves out a place that is not a district of the list, and copes with answers it does not know", () => {
    const d = seedOnboarding(emptyOnboarding(), source({ cities: "Atlantis; also Salem", answers: [{ q: "A question from an older form", a: "Yes" }] }));
    expect(d.areas.districts).toEqual(["Salem"]);
    expect(d.business.kind).toBe("");
  });
});
