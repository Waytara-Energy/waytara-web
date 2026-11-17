import { describe, expect, it } from "vitest";
import { AGREEMENT_IS_DRAFT, AGREEMENT_TITLE, AGREEMENT_VERSION, agreementSections, agreementText } from "./partner-agreement";

describe("the partner agreement", () => {
  it("has the clauses a partner agreement with indemnity and confidentiality needs", () => {
    const headings = agreementSections("contractor").map((s) => s.heading);
    for (const h of ["Licences, qualifications and the law", "Safety", "Fees and payment", "Insurance", "Indemnity", "Confidentiality", "Term and ending", "Law and disputes"]) expect(headings).toContain(h);
    for (const s of agreementSections("contractor")) expect(s.clauses.length).toBeGreaterThan(0);
  });

  it("names the work of each kind of partner in its first section, and has a fallback", () => {
    const first = (t: string | null) => agreementSections(t)[0].clauses[1];
    expect(first("contractor")).toContain("contractor licence");
    expect(first("solar")).toContain("solar");
    expect(first("ev")).toContain("charging");
    expect(first("technician")).toContain("technician");
    expect(first("survey")).toContain("surveys");
    expect(first(null)).toContain("work that WayTara offers");
  });

  it("is plain text with the title, the version and numbered clauses, and differs by kind only in its scope", () => {
    const a = agreementText("solar");
    expect(a.startsWith(`${AGREEMENT_TITLE}\nVersion ${AGREEMENT_VERSION}`)).toBe(true);
    expect(a).toContain("1.1 ");
    expect(a).not.toBe(agreementText("ev"));
    expect(agreementText("solar")).toBe(a);
  });

  it("is still marked as a draft until a lawyer has approved it (change this test when the final text goes in)", () => {
    expect(AGREEMENT_IS_DRAFT).toBe(true);
    expect(AGREEMENT_VERSION).toContain("draft");
  });
});
