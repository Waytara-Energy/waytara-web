import { describe, expect, it } from "vitest";
import { DECLINE_OPTIONS, approvalGaps, checklistFor, isCheckKey, isCheckState, isDeclineHandling, isScreeningKey, isSubject, memberChecklist, memberStatus, requiredChecks, screeningChecklist, screeningGaps } from "./partner-verification";

/** Every required screening item ticked, for a kind of partner. */
const screened = (type: string) => Object.fromEntries(screeningChecklist(type).filter((i) => i.required).map((i) => [i.key, "verified" as const]));

describe("screening", () => {
  it("always confirms the phone number and the e-mail address first, and that the documents were explained last", () => {
    for (const type of ["contractor", "solar", "ev", "technician", "survey"]) {
      const keys = screeningChecklist(type).map((i) => i.key);
      expect(keys.slice(0, 2)).toEqual(["s_phone", "s_email"]);
      expect(keys.at(-1)).toBe("s_documents");
    }
  });
  it("asks about the licence of every kind that does electrical work, and about tools of a survey associate", () => {
    for (const type of ["contractor", "solar", "ev", "technician"]) expect(screeningChecklist(type).find((i) => i.key === "s_licence")?.required).toBe(true);
    expect(screeningChecklist("survey").some((i) => i.key === "s_licence")).toBe(false);
    expect(screeningChecklist("survey").some((i) => i.key === "s_tools")).toBe(true);
  });
  it("is done only when every required item is ticked; an optional one never holds it up", () => {
    expect(screeningGaps("solar", {})).toContain("Phone number");
    expect(screeningGaps("solar", screened("solar"))).toEqual([]);
    expect(screeningGaps("solar", { ...screened("solar"), s_phone: "pending" })).toEqual(["Phone number"]);
    expect(isScreeningKey("solar", "s_subsidy")).toBe(true);
    expect(isScreeningKey("survey", "s_subsidy")).toBe(false);
  });
});

describe("checklistFor", () => {
  it("gives a contractor every check (the phone and e-mail check is the screening call's now)", () => {
    expect(checklistFor("contractor").map((c) => c.key)).toEqual(["identity", "licence", "registration", "kyc", "bank", "work"]);
  });
  it("leaves out the business registration for a technician and the licence too for a survey associate", () => {
    expect(checklistFor("technician").map((c) => c.key)).toEqual(["identity", "licence", "kyc", "bank", "work"]);
    expect(checklistFor("survey").map((c) => c.key)).toEqual(["identity", "kyc", "bank", "work"]);
  });
});

describe("requiredChecks", () => {
  it("requires identity, PAN and bank of everyone, the licence of those who do electrical work, and the registration of a business", () => {
    expect(requiredChecks("contractor")).toEqual(["identity", "licence", "registration", "kyc", "bank"]);
    expect(requiredChecks("solar")).toEqual(["identity", "licence", "registration", "kyc", "bank"]);
    expect(requiredChecks("technician")).toEqual(["identity", "licence", "kyc", "bank"]);
    expect(requiredChecks("survey")).toEqual(["identity", "kyc", "bank"]);
  });
});

const all = (type: string) => Object.fromEntries(requiredChecks(type).map((k) => [k, "verified" as const]));

describe("approvalGaps", () => {
  it("is empty once the screening is done and what is required is verified", () => {
    expect(approvalGaps("contractor", all("contractor"), [], {}, screened("contractor"))).toEqual([]);
  });
  it("takes the older phone and e-mail check in place of the screening checklist", () => {
    expect(approvalGaps("contractor", { ...all("contractor"), contact: "verified" })).toEqual([]);
    expect(approvalGaps("contractor", all("contractor"))).toEqual(["Screening call: not complete"]);
  });
  it("lists what is not verified, and says when a problem was found", () => {
    expect(approvalGaps("survey", { identity: "verified", kyc: "problem" }, [], {}, screened("survey"))).toEqual(["PAN and KYC: a problem was found", "Bank account: not verified yet"]);
  });
  it("is stopped by a problem on an optional check, but not by one that was never checked", () => {
    const ok = all("solar");
    expect(approvalGaps("solar", { ...ok, work: "pending" }, [], {}, screened("solar"))).toEqual([]);
    expect(approvalGaps("solar", { ...ok, work: "problem" }, [], {}, screened("solar"))).toEqual(["Past work: a problem was found"]);
  });
});

describe("decline options", () => {
  it("has the three the owner chose, each with what the applicant is told", () => {
    expect(DECLINE_OPTIONS.map((o) => o.id)).toEqual(["delete_all", "delete_documents", "keep"]);
    for (const o of DECLINE_OPTIONS) expect(o.mail.length).toBeGreaterThan(40);
  });
  it("tells the applicant truthfully what is kept", () => {
    const by = Object.fromEntries(DECLINE_OPTIONS.map((o) => [o.id, o.mail]));
    expect(by.delete_all).toContain("deleted everything");
    expect(by.delete_documents).toContain("kept only your name, phone number, e-mail address");
    expect(by.keep).toContain("ask us at any time to delete");
  });
  it("recognises only its own values", () => {
    expect(isDeclineHandling("keep")).toBe(true);
    expect(isDeclineHandling("delete")).toBe(false);
    expect(isCheckKey("licence")).toBe(true);
    expect(isCheckKey("x")).toBe(false);
    expect(isCheckState("verified")).toBe(true);
    expect(isCheckState("ok")).toBe(false);
  });
});

describe("team members", () => {
  const lic = { key: "m1", name: "Ravi", needsLicence: true };
  const helper = { key: "m2", name: "Kumar", needsLicence: false };
  const ok = { ...all("solar"), contact: "verified" } as const;

  it("checks a member on identity, and on their licence only when their work needs one", () => {
    expect(memberChecklist(true).map((c) => c.key)).toEqual(["member_identity", "member_licence"]);
    expect(memberChecklist(false).map((c) => c.key)).toEqual(["member_identity"]);
  });
  it("is verified only when everything they are checked on is, and a problem on any one shows", () => {
    expect(memberStatus(lic, {})).toBe("pending");
    expect(memberStatus(lic, { m1: { member_identity: "verified" } })).toBe("pending");
    expect(memberStatus(lic, { m1: { member_identity: "verified", member_licence: "verified" } })).toBe("verified");
    expect(memberStatus(lic, { m1: { member_identity: "verified", member_licence: "problem" } })).toBe("problem");
    expect(memberStatus(helper, { m2: { member_identity: "verified" } })).toBe("verified");
  });
  it("owes nothing for a team when there is none, and blocks approval until every member is verified", () => {
    expect(approvalGaps("solar", ok)).toEqual([]);
    expect(approvalGaps("solar", ok, [lic, helper], {})).toEqual(["Ravi: not verified yet", "Kumar: not verified yet"]);
    expect(approvalGaps("solar", ok, [lic, helper], { m1: { member_identity: "verified", member_licence: "verified" }, m2: { member_identity: "verified" } })).toEqual([]);
    expect(approvalGaps("solar", ok, [lic], { m1: { member_identity: "verified", member_licence: "problem" } })).toEqual(["Ravi: a problem was found"]);
  });
  it("recognises a partner, screening or member subject only", () => {
    expect(isSubject("partner")).toBe(true);
    expect(isSubject("screening")).toBe(true);
    expect(isSubject("member:abc-123")).toBe(true);
    expect(isSubject("member:")).toBe(false);
    expect(isSubject("category:x")).toBe(false);
  });
});
