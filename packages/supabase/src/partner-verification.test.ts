import { describe, expect, it } from "vitest";
import { DECLINE_OPTIONS, approvalGaps, checklistFor, isCheckKey, isCheckState, isDeclineHandling, requiredChecks } from "./partner-verification";

describe("checklistFor", () => {
  it("gives a contractor every check", () => {
    expect(checklistFor("contractor").map((c) => c.key)).toEqual(["identity", "contact", "licence", "registration", "work"]);
  });
  it("leaves out the business registration for a technician and the licence too for a survey associate", () => {
    expect(checklistFor("technician").map((c) => c.key)).toEqual(["identity", "contact", "licence", "work"]);
    expect(checklistFor("survey").map((c) => c.key)).toEqual(["identity", "contact", "work"]);
  });
});

describe("requiredChecks", () => {
  it("requires the licence only of those who must hold one", () => {
    expect(requiredChecks("contractor")).toEqual(["identity", "contact", "licence"]);
    expect(requiredChecks("technician")).toEqual(["identity", "contact", "licence"]);
    expect(requiredChecks("solar")).toEqual(["identity", "contact"]);
    expect(requiredChecks("survey")).toEqual(["identity", "contact"]);
  });
});

describe("approvalGaps", () => {
  it("is empty once what is required is verified", () => {
    expect(approvalGaps("contractor", { identity: "verified", contact: "verified", licence: "verified" })).toEqual([]);
  });
  it("lists what is not verified, and says when a problem was found", () => {
    expect(approvalGaps("contractor", { identity: "verified", contact: "problem" })).toEqual(["Phone and e-mail: a problem was found", "Licence or certificate: not verified yet"]);
  });
  it("is stopped by a problem on an optional check, but not by one that was never checked", () => {
    const ok = { identity: "verified", contact: "verified" } as const;
    expect(approvalGaps("solar", { ...ok, work: "pending" })).toEqual([]);
    expect(approvalGaps("solar", { ...ok, work: "problem" })).toEqual(["Past work: a problem was found"]);
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
