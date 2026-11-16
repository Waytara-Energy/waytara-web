import { describe, expect, it } from "vitest";
import { documentMime, documentProblem, emptyOnboarding, isDocumentPathOf, isIsoDate, newDocumentPath, onboardingGaps, readOnboarding, safeFileName } from "./partner-onboarding";

const APP = "11111111-2222-3333-4444-555555555555";

describe("documents", () => {
  it("takes PDF and pictures, and nothing else", () => {
    expect(documentMime("Licence.PDF")).toBe("application/pdf");
    expect(documentMime("a.jpeg")).toBe("image/jpeg");
    expect(documentMime("a.exe")).toBeNull();
    expect(documentMime("noextension")).toBeNull();
  });

  it("explains why a file is refused", () => {
    expect(documentProblem("a.pdf", 1000)).toBeNull();
    expect(documentProblem("a.docx", 1000)).toMatch(/PDF, JPG, PNG or WebP/);
    expect(documentProblem("a.pdf", 0)).toMatch(/empty/);
    expect(documentProblem("a.pdf", 10 * 1024 * 1024 + 1)).toMatch(/10 MB/);
  });

  it("makes a safe name and keeps the extension", () => {
    expect(safeFileName("My licence (final) ../x.PDF")).toBe("My-licence-final-..-x.pdf");
    expect(safeFileName("a/b\\c.pdf")).not.toMatch(/[\\/]/);
    expect(safeFileName("....pdf")).toBe("file.pdf");
    expect(safeFileName("x".repeat(200) + ".png").length).toBeLessThanOrEqual(80);
  });

  it("puts a file in its application's folder and recognises only its own paths", () => {
    const path = newDocumentPath(APP, "Licence.pdf", "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
    expect(path).toBe(`${APP}/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee-Licence.pdf`);
    expect(isDocumentPathOf(APP, path)).toBe(true);
    expect(isDocumentPathOf("99999999-2222-3333-4444-555555555555", path)).toBe(false);
    expect(isDocumentPathOf(APP, `${APP}/../other/file.pdf`)).toBe(false);
    expect(isDocumentPathOf(APP, `${APP}/nothex-file.pdf`)).toBe(false);
  });
});

describe("readOnboarding", () => {
  it("gives an empty, well-formed value for anything odd", () => {
    expect(readOnboarding(null)).toEqual(emptyOnboarding());
    expect(readOnboarding("x")).toEqual(emptyOnboarding());
    expect(readOnboarding({ business: 5, licences: "no", team: [], areas: null })).toEqual(emptyOnboarding());
  });

  it("trims and cuts text, drops unknown fields, keeps lists short and districts unique", () => {
    const d = readOnboarding({
      business: { name: "  Sun Co  ", pin: "6000010000", extra: "x" },
      licences: Array.from({ length: 30 }, () => ({ type: "contractor", number: "A1" })),
      areas: { districts: ["Chennai", "Chennai", "", 7, "Vellore"] },
    });
    expect(d.business.name).toBe("Sun Co");
    expect(d.business.pin).toBe("600001");
    expect(d.business).not.toHaveProperty("extra");
    expect(d.licences).toHaveLength(10);
    expect(d.areas.districts).toEqual(["Chennai", "Vellore"]);
  });
});

describe("isIsoDate", () => {
  it("accepts a real date only", () => {
    expect(isIsoDate("2027-03-31")).toBe(true);
    expect(isIsoDate("2027-02-30")).toBe(false);
    expect(isIsoDate("31-03-2027")).toBe(false);
  });
});

describe("onboardingGaps", () => {
  const ok = () => {
    const d = emptyOnboarding();
    d.business.name = "Sun Co";
    d.business.city = "Chennai";
    d.areas.districts = ["Chennai"];
    d.licences = [{ type: "contractor", grade: "EA", number: "EA/123", validUntil: "2027-03-31" }];
    return d;
  };

  it("has no gaps for a complete contractor", () => {
    expect(onboardingGaps("contractor", ok(), ["licence", "identity"])).toEqual([]);
  });

  it("lists what a contractor still owes, with the section to open", () => {
    const gaps = onboardingGaps("contractor", emptyOnboarding(), []);
    expect(gaps.map((g) => g.section)).toEqual(["business", "business", "licences", "documents", "areas", "documents"]);
    expect(gaps.some((g) => g.text.includes("licence or certificate"))).toBe(true);
  });

  it("does not ask a survey associate for a licence, but still for an identity document", () => {
    const d = ok();
    d.licences = [];
    expect(onboardingGaps("survey", d, [])).toEqual([{ section: "documents", text: "An identity document for the person we deal with" }]);
  });

  it("asks a technician for their name as on the certificate", () => {
    expect(onboardingGaps("technician", emptyOnboarding(), []).some((g) => g.text.startsWith("Your name as on your certificate"))).toBe(true);
  });

  it("flags a licence without a number, and a bad date", () => {
    const d = ok();
    d.licences = [{ type: "contractor", grade: "", number: "", validUntil: "2027-13-01" }];
    const texts = onboardingGaps("contractor", d, ["licence", "identity"]).map((g) => g.text);
    expect(texts).toEqual(["Licence 1: the kind and the number", "Licence 1: a valid date"]);
  });
});
