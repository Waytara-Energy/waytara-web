import { describe, expect, it } from "vitest";
import { PARTNER_PRECHECK, PARTNER_QUESTIONS, PARTNER_REGIONS, PARTNER_SERVICE_LABEL, PARTNER_TYPES, TN_DISTRICTS, checkPartnerAnswers, makePartnerReference } from "./partner-network";

const contractor = { entity: "private_limited", business: "Sun Electricals", role: "director", tnelb: "yes", tnelb_grade: "ea", experience: "5_10", services: ["electrical_contracting", "solar_epc"], team: "6_15", radius: "150km" };
const technician = { services: "ev_technician", qualification: "iti", experience: "2_5", certificate: "neither", available: "yes", radius: "city" };

describe("the questions", () => {
  it("has a set for every kind of partner, each with at least one required question", () => {
    for (const t of PARTNER_TYPES) expect(PARTNER_QUESTIONS[t.id].some((q) => q.required)).toBe(true);
  });

  it("gives every choice a unique id within its question", () => {
    for (const qs of Object.values(PARTNER_QUESTIONS))
      for (const q of qs) {
        const ids = (q.options ?? []).map((o) => o.id);
        expect(new Set(ids).size).toBe(ids.length);
      }
  });

  it("names every id kept in services, and keeps the names of the form that came before", () => {
    for (const qs of Object.values(PARTNER_QUESTIONS)) for (const o of qs.find((q) => q.key === "services")?.options ?? []) expect(PARTNER_SERVICE_LABEL[o.id]).toBe(o.label);
    expect(PARTNER_SERVICE_LABEL.ems_integration).toBe("Monitoring and integration");
  });

  it("has a pre-check sentence for every kind, and every kind asks how far the partner travels", () => {
    for (const t of PARTNER_TYPES) {
      expect(PARTNER_PRECHECK[t.id].length).toBeGreaterThan(40);
      expect(PARTNER_QUESTIONS[t.id].some((q) => q.key === "radius" && q.required)).toBe(true);
    }
  });

  it("asks the three business kinds what kind of business, their role and their team, and the two people-kinds none of those", () => {
    for (const t of ["contractor", "solar", "ev"] as const) for (const k of ["entity", "role", "team", "business"]) expect(PARTNER_QUESTIONS[t].some((q) => q.key === k)).toBe(true);
    for (const t of ["technician", "survey"] as const) for (const k of ["entity", "role", "team", "business"]) expect(PARTNER_QUESTIONS[t].some((q) => q.key === k)).toBe(false);
  });

  it("lists only places that can be chosen in the form's district list", () => {
    for (const r of PARTNER_REGIONS) for (const p of r.places) expect(TN_DISTRICTS).toContain(p);
  });
});

describe("checkPartnerAnswers", () => {
  it("accepts a complete contractor application and returns the questions with their answers in order", () => {
    const r = checkPartnerAnswers("contractor", contractor);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.services).toEqual(["electrical_contracting", "solar_epc"]);
    expect(r.value.byKey.tnelb_grade).toBe("EA");
    expect(r.value.qa.map((x) => x.a)).toEqual(["Private limited company", "Sun Electricals", "Director", "Yes", "EA", "5 to 10 years", "Electrical contracting, Solar EPC", "6 to 15", "Up to 150 km"]);
  });

  it("does not ask an individual for a business name or a team size, and drops them if they were sent", () => {
    const r = checkPartnerAnswers("contractor", { ...contractor, entity: "individual", role: "freelancer", business: undefined, team: undefined });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.byKey.business).toBeUndefined();
    expect(r.value.qa.some((x) => x.q === "How many people work with you?")).toBe(false);
    const stale = checkPartnerAnswers("contractor", { ...contractor, entity: "individual", business: "Left over", team: "2_5" });
    expect(stale.ok && stale.value.qa.some((x) => x.a === "Left over")).toBe(false);
  });

  it("asks a registered business for its name and its team", () => {
    expect(checkPartnerAnswers("contractor", { ...contractor, business: undefined }).ok).toBe(false);
    expect(checkPartnerAnswers("contractor", { ...contractor, team: undefined }).ok).toBe(false);
    expect(checkPartnerAnswers("contractor", { ...contractor, entity: undefined }).ok).toBe(false);
  });

  it("asks the licence grade only of someone who has a licence, and drops a grade sent for someone who has not", () => {
    const none = checkPartnerAnswers("contractor", { ...contractor, tnelb: "no", tnelb_grade: undefined });
    expect(none.ok).toBe(true);
    const stale = checkPartnerAnswers("contractor", { ...contractor, tnelb: "no", tnelb_grade: "ea" });
    expect(stale.ok && stale.value.qa.some((x) => x.q === "If yes, which grade?")).toBe(false);
    const missing = checkPartnerAnswers("contractor", { ...contractor, tnelb_grade: undefined });
    expect(missing.ok).toBe(false);
  });

  it("names the question that is missing", () => {
    const r = checkPartnerAnswers("solar", { entity: "proprietorship", business: "Team", role: "proprietor", services: ["hybrid_systems"] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("Years of experience");
  });

  it("refuses a choice that is not one of the options, a repeated one, and several answers to a single-choice question", () => {
    expect(checkPartnerAnswers("contractor", { ...contractor, tnelb: "maybe" }).ok).toBe(false);
    expect(checkPartnerAnswers("contractor", { ...contractor, services: ["solar_epc", "solar_epc"] }).ok).toBe(false);
    expect(checkPartnerAnswers("contractor", { ...contractor, experience: ["under_2", "2_5"] }).ok).toBe(false);
    expect(checkPartnerAnswers("contractor", { ...contractor, services: [] }).ok).toBe(false);
  });

  it("keeps a technician's trade as the one id in services, and ignores answers to questions of another kind", () => {
    const r = checkPartnerAnswers("technician", { ...technician, tnelb: "yes", business: "Not asked" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.services).toEqual(["ev_technician"]);
    expect(r.value.qa.some((x) => x.a === "Not asked")).toBe(false);
  });

  it("limits a typed answer's length and refuses a one-letter name", () => {
    expect(checkPartnerAnswers("contractor", { ...contractor, business: "x" }).ok).toBe(false);
    expect(checkPartnerAnswers("contractor", { ...contractor, business: "x".repeat(201) }).ok).toBe(false);
  });
});

describe("makePartnerReference", () => {
  it("is WTP, the year and month, then five easy-to-read characters", () => {
    const ref = makePartnerReference(new Date(Date.UTC(2026, 10, 16)), () => 0.5);
    expect(ref).toMatch(/^WTP-2611-[A-HJ-NP-Z2-9]{5}$/);
  });

  it("changes with the random numbers and never uses 0, 1, I or O", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const ref = makePartnerReference(new Date(Date.UTC(2027, 0, 5)), Math.random);
      expect(ref).toMatch(/^WTP-2701-[A-HJ-NP-Z2-9]{5}$/);
      seen.add(ref);
    }
    expect(seen.size).toBeGreaterThan(190);
  });
});
