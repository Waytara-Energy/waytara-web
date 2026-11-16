import { describe, expect, it } from "vitest";
import { documentMime, documentProblem, documentRequirements, documentSubjectProblem, emptyOnboarding, fileTypeLabel, isDocumentPathOf, isGstin, isIfsc, isIsoDate, isPan, maskAccount, newDocumentPath, onboardingGaps, readOnboarding, safeFileName } from "./partner-onboarding";

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

describe("numbers", () => {
  it("knows the shape of a PAN, a GST number and an IFSC", () => {
    expect(isPan("ABCDE1234F")).toBe(true);
    expect(isPan("ABCDE12345")).toBe(false);
    expect(isGstin("33ABCDE1234F1Z5")).toBe(true);
    expect(isGstin("33ABCDE1234F1X5")).toBe(false);
    expect(isIfsc("SBIN0001234")).toBe(true);
    expect(isIfsc("SBIN1001234")).toBe(false);
  });
  it("hides all but the last four digits of an account number", () => {
    expect(maskAccount("123456789012")).toBe("\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u20229012");
    expect(maskAccount("12")).toBe("12");
  });
  it("says whether a file is a PDF or an image", () => {
    expect(fileTypeLabel("Licence.PDF")).toEqual({ type: "pdf", label: "PDF" });
    expect(fileTypeLabel("roof.jpeg")).toEqual({ type: "image", label: "Image \u00b7 JPG" });
  });
});

const docs = (...kinds: string[]) => kinds.map((kind) => ({ kind, subject: "partner" }));

/** Everything a contractor must enter, with nothing uploaded. */
const filled = () => {
  const d = emptyOnboarding();
  d.person.name = "Priya Raman";
  d.business = { ...d.business, name: "Sun Co", kind: "proprietorship", address: "12 Main Road", city: "Chennai", pin: "600001", pan: "ABCDE1234F" };
  d.areas.districts = ["Chennai"];
  d.licences = [{ type: "contractor", grade: "EA", number: "EA/123", validUntil: "2027-03-31" }];
  d.bank = { holder: "Sun Co", bankName: "State Bank of India", branch: "", ifsc: "SBIN0001234", accountType: "current", accountNumber: "123456789012" };
  return d;
};

describe("documentRequirements", () => {
  const required = (type: string, d = filled()) => documentRequirements(type, d).filter((r) => r.need === "required").map((r) => r.kind);

  it("asks everyone for a photo ID, a PAN card and a bank proof", () => {
    for (const type of ["contractor", "solar", "ev", "technician", "survey"]) expect(required(type)).toEqual(expect.arrayContaining(["identity", "pan", "bank_proof"]));
  });
  it("asks a contractor for the contractor licence, and lets a solar or EV partner send a tie-up instead", () => {
    expect(required("contractor")).toContain("licence");
    const solar = documentRequirements("solar", filled()).find((r) => r.kind === "licence");
    expect(solar?.anyOf).toEqual(["licence", "contractor_tieup"]);
    expect(documentRequirements("solar", filled()).some((r) => r.kind === "discom_registration" && r.need === "conditional")).toBe(true);
  });
  it("asks a technician for a competency or trade certificate, and a survey associate for no licence", () => {
    expect(documentRequirements("technician", filled()).find((r) => r.kind === "certificate")?.anyOf).toEqual(["certificate", "trade_certificate"]);
    expect(required("survey")).toEqual(["identity", "pan", "bank_proof"]);
  });
  it("makes the GST certificate required once a GST number is given, and the registration for a firm or company", () => {
    const d = filled();
    expect(required("contractor", d)).not.toContain("gst_certificate");
    d.business.gstin = "33ABCDE1234F1Z5";
    d.business.kind = "company";
    expect(required("contractor", d)).toEqual(expect.arrayContaining(["gst_certificate", "registration"]));
  });
  it("gives every requirement the reason it is asked", () => {
    for (const type of ["contractor", "solar", "ev", "technician", "survey"]) for (const r of documentRequirements(type, filled())) expect(r.basis.length).toBeGreaterThan(20);
  });
});

describe("onboardingGaps", () => {
  it("has no gaps for a complete contractor", () => {
    expect(onboardingGaps("contractor", filled(), docs("identity", "licence", "pan", "bank_proof"))).toEqual([]);
  });

  it("lists what an empty onboarding still owes, part by part in the order of the pages", () => {
    const gaps = onboardingGaps("contractor", emptyOnboarding(), []);
    const sections = gaps.map((g) => g.section);
    expect([...new Set(sections)]).toEqual(["personal", "business", "licences", "areas", "bank"]);
    expect(gaps.some((g) => g.text.includes("Electrical contractor licence"))).toBe(true);
    expect(gaps.some((g) => g.text === "Your PAN")).toBe(true);
  });

  it("takes a tie-up with a licensed contractor in place of a solar partner's own licence", () => {
    const d = filled();
    d.licences = [];
    expect(onboardingGaps("solar", d, docs("identity", "pan", "bank_proof")).map((g) => g.section)).toEqual(["licences"]);
    expect(onboardingGaps("solar", d, docs("identity", "pan", "bank_proof", "contractor_tieup"))).toEqual([]);
  });

  it("does not ask a survey associate for a licence or a kind of business", () => {
    const d = filled();
    d.licences = [];
    d.business.kind = "";
    expect(onboardingGaps("survey", d, docs("identity", "pan", "bank_proof"))).toEqual([]);
  });

  it("flags a licence without a number, a bad date, and numbers of the wrong shape", () => {
    const d = filled();
    d.licences = [{ type: "contractor", grade: "", number: "", validUntil: "2027-13-01" }];
    d.business.gstin = "33ABC";
    d.business.pan = "ABC";
    d.bank.ifsc = "SBIN";
    const texts = onboardingGaps("contractor", d, docs("identity", "licence", "pan", "bank_proof", "gst_certificate")).map((g) => g.text);
    expect(texts).toEqual(["The GST number does not look right (15 characters)", "Licence 1: the kind and the number", "Licence 1: a valid date", "The PAN does not look right (10 characters, like ABCDE1234F)", "The IFSC does not look right (11 characters, like SBIN0001234)"]);
  });

  it("asks for each team member's photo ID, and their certificate when their work needs one", () => {
    const d = filled();
    d.team.members = [
      { id: "r1", name: "Ravi", role: "Supervisor", phone: "", certificate: "", needsLicence: true, addedAt: "" },
      { id: "k1", name: "Kumar", role: "Helper", phone: "", certificate: "", needsLicence: false, addedAt: "" },
    ];
    const own = docs("identity", "licence", "pan", "bank_proof");
    expect(onboardingGaps("contractor", d, own).map((g) => g.text)).toEqual(["Ravi: the licence or certificate number", "Ravi: a photo ID", "Ravi: a copy of the licence or certificate", "Kumar: a photo ID"]);
    d.team.members[0].certificate = "C-1";
    const all = [...own, { kind: "identity", subject: "member:r1" }, { kind: "certificate", subject: "member:r1" }, { kind: "identity", subject: "member:k1" }];
    expect(onboardingGaps("contractor", d, all)).toEqual([]);
  });
});

describe("documentSubjectProblem", () => {
  const d = filled();
  d.team.members = [{ id: "r1", name: "Ravi", role: "", phone: "", certificate: "", needsLicence: true, addedAt: "" }];

  it("files a document under the partner, a saved team member or one of this partner's kinds of work only", () => {
    expect(documentSubjectProblem("solar", d, "partner", "pan")).toBeNull();
    expect(documentSubjectProblem("solar", d, "member:r1", "identity")).toBeNull();
    expect(documentSubjectProblem("solar", d, "member:nobody", "identity")).toMatch(/Save this person first/);
    expect(documentSubjectProblem("solar", d, "category:residential", "work_photo")).toBeNull();
    expect(documentSubjectProblem("solar", d, "category:dc_charger", "work_photo")).not.toBeNull();
    expect(documentSubjectProblem("solar", d, "somewhere", "pan")).not.toBeNull();
  });
  it("takes only the kinds that make sense for a person or for past work", () => {
    expect(documentSubjectProblem("solar", d, "member:r1", "bank_proof")).not.toBeNull();
    expect(documentSubjectProblem("solar", d, "category:residential", "pan")).not.toBeNull();
    expect(documentSubjectProblem("solar", d, "partner", "nonsense")).not.toBeNull();
  });
});
