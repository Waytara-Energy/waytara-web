import { describe, expect, it } from "vitest";
import { documentMime, documentProblem, documentRequirements, documentSubjectProblem, emptyOnboarding, fileTypeLabel, isDocumentPathOf, isGstin, isIfsc, isIsoDate, isPan, maskAccount, memberRequirements, newDocumentPath, onboardingGaps, readOnboarding, safeFileName } from "./partner-onboarding";

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

const member = { id: "", name: "", role: "", siteRole: "", phone: "", email: "", certificate: "", validUntil: "", needsLicence: true, addedAt: "" };
const docs = (...kinds: string[]) => kinds.map((kind) => ({ kind, subject: "partner" }));

const NOW = new Date("2026-11-17T06:00:00Z");

/** Everything a contractor must enter, with nothing uploaded. */
const filled = () => {
  const d = emptyOnboarding();
  d.person = { ...d.person, name: "Priya Raman", emergencyName: "Raman", emergencyPhone: "9876543210" };
  d.business = { ...d.business, name: "Sun Co", kind: "proprietorship", address: "12 Main Road", city: "Chennai", pin: "600001", pan: "ABCDE1234F", capabilities: ["lt_wiring"] };
  d.areas.districts = ["Chennai"];
  d.licences = [
    { type: "contractor", grade: "EA", number: "EA/123", issuedOn: "2024-04-01", validUntil: "2099-03-31" },
    { type: "supervisor", grade: "", number: "S/55", issuedOn: "", validUntil: "2099-03-31" },
  ];
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
    expect(required("survey")).toEqual(["identity", "police_verification", "pan", "bank_proof"]);
  });
  it("makes the GST certificate required once a GST number is given, and the registration for a firm or company", () => {
    const d = filled();
    expect(required("contractor", d)).not.toContain("gst_certificate");
    d.business.gstin = "33ABCDE1234F1Z5";
    d.business.kind = "company";
    expect(required("contractor", d)).toEqual(expect.arrayContaining(["gst_certificate", "registration"]));
  });
  it("asks a contractor for the supervisor's permit and the office address proof, and lets a tie-up cover a solar or EV partner's supervisor", () => {
    expect(required("contractor")).toEqual(expect.arrayContaining(["supervisor_permit", "address_proof"]));
    expect(documentRequirements("ev", filled()).find((r) => r.kind === "supervisor_permit")?.anyOf).toEqual(["supervisor_permit", "contractor_tieup"]);
    const alone = filled();
    alone.business.kind = "individual";
    expect(required("contractor", alone)).not.toContain("address_proof");
  });
  it("asks a technician and a survey associate for the police verification, and no one else", () => {
    for (const type of ["technician", "survey"]) expect(required(type)).toContain("police_verification");
    for (const type of ["contractor", "solar", "ev"]) expect(documentRequirements(type, filled()).some((r) => r.kind === "police_verification")).toBe(false);
  });
  it("asks a company for an authorisation letter if the person is not the only owner", () => {
    const d = filled();
    d.business.kind = "company";
    expect(documentRequirements("contractor", d).find((r) => r.kind === "authorisation_letter")?.need).toBe("conditional");
    expect(documentRequirements("contractor", filled()).some((r) => r.kind === "authorisation_letter")).toBe(false);
  });
  it("gives every requirement the reason it is asked", () => {
    for (const type of ["contractor", "solar", "ev", "technician", "survey"]) for (const r of documentRequirements(type, filled())) expect(r.basis.length).toBeGreaterThan(20);
  });
});

describe("onboardingGaps", () => {
  it("has no gaps for a complete contractor", () => {
    expect(onboardingGaps("contractor", filled(), docs("identity", "licence", "supervisor_permit", "address_proof", "pan", "bank_proof"), NOW)).toEqual([]);
  });

  it("lists what an empty onboarding still owes, part by part in the order of the pages", () => {
    const gaps = onboardingGaps("contractor", emptyOnboarding(), [], NOW);
    const sections = gaps.map((g) => g.section);
    expect([...new Set(sections)]).toEqual(["personal", "business", "licences", "areas", "bank"]);
    expect(gaps.some((g) => g.text.includes("Electrical contractor licence"))).toBe(true);
    expect(gaps.some((g) => g.text === "Your PAN")).toBe(true);
  });

  it("takes a tie-up with a licensed contractor in place of a solar partner's own licence", () => {
    const d = filled();
    d.licences = [];
    const base = ["identity", "address_proof", "pan", "bank_proof"];
    expect(onboardingGaps("solar", d, docs(...base), NOW).map((g) => g.section)).toEqual(["licences", "licences"]);
    expect(onboardingGaps("solar", d, docs(...base, "contractor_tieup"), NOW)).toEqual([]);
    expect(onboardingGaps("solar", d, docs(...base, "licence", "supervisor_permit"), NOW)).toEqual([]);
  });

  it("asks a survey associate for the police verification, but for no licence or kind of business", () => {
    const d = filled();
    d.licences = [];
    d.business.kind = "";
    const own = docs("identity", "police_verification", "pan", "bank_proof");
    expect(onboardingGaps("survey", d, own, NOW).map((g) => g.text)).toEqual(["Your police verification certificate, with its reference number and date"]);
    d.licences = [{ type: "pvc", grade: "", number: "PV/778", issuedOn: "2026-05-02", validUntil: "" }];
    expect(onboardingGaps("survey", d, own, NOW)).toEqual([]);
    d.licences[0].issuedOn = "";
    expect(onboardingGaps("survey", d, own, NOW).map((g) => g.text)).toEqual(["Licence 1: the date it was issued"]);
  });

  it("flags a licence without a number, a bad date, and numbers of the wrong shape", () => {
    const d = filled();
    d.licences = [
      { type: "contractor", grade: "", number: "", issuedOn: "", validUntil: "2027-13-01" },
      { type: "supervisor", grade: "", number: "S/55", issuedOn: "", validUntil: "2099-01-01" },
    ];
    d.business.gstin = "33ABC";
    d.business.pan = "ABC";
    d.bank.ifsc = "SBIN";
    const texts = onboardingGaps("contractor", d, docs("identity", "licence", "supervisor_permit", "address_proof", "pan", "bank_proof", "gst_certificate"), NOW).map((g) => g.text);
    expect(texts).toEqual(["The GST number does not look right (15 characters)", "Licence 1: the kind and the number", "Licence 1: a valid date", "The PAN does not look right (10 characters, like ABCDE1234F)", "The IFSC does not look right (11 characters, like SBIN0001234)"]);
  });

  it("asks for each team member's photo ID, and their certificate when their work needs one", () => {
    const d = filled();
    d.team.members = [
      { ...member, id: "r1", name: "Ravi", role: "Supervisor", needsLicence: true },
      { ...member, id: "k1", name: "Kumar", role: "Helper", needsLicence: false },
    ];
    const own = docs("identity", "licence", "supervisor_permit", "address_proof", "pan", "bank_proof");
    expect(onboardingGaps("contractor", d, own, NOW).map((g) => g.text)).toEqual(["Ravi: the licence or certificate number", "Ravi: a photo ID", "Ravi: a copy of the licence or certificate", "Kumar: a photo ID"]);
    d.team.members[0].certificate = "C-1";
    const all = [...own, { kind: "identity", subject: "member:r1" }, { kind: "certificate", subject: "member:r1" }, { kind: "identity", subject: "member:k1" }];
    expect(onboardingGaps("contractor", d, all, NOW)).toEqual([]);
  });

  it("asks what each role on site needs: a supervisor's permit and its date, an installer's training, nothing but an ID of a helper", () => {
    const d = filled();
    d.team.members = [
      { ...member, id: "r1", name: "Ravi", siteRole: "supervisor", needsLicence: true, certificate: "S-9" },
      { ...member, id: "s1", name: "Sita", siteRole: "solar_installer", needsLicence: true, certificate: "ITI-4" },
      { ...member, id: "k1", name: "Kumar", siteRole: "helper", needsLicence: false },
    ];
    const own = docs("identity", "licence", "supervisor_permit", "address_proof", "pan", "bank_proof");
    const texts = onboardingGaps("contractor", d, own, NOW).map((g) => g.text);
    expect(texts).toEqual(expect.arrayContaining(["Ravi: the date their permit is valid until", "Ravi: a photo ID", "Sita: a photo ID", "Sita: a copy of the licence or certificate", "Kumar: a photo ID"]));
    expect(texts.some((x) => x.startsWith("Kumar") && x.includes("certificate"))).toBe(false);
    expect(memberRequirements(true, "helper").map((r) => r.kind)).toEqual(["identity", "police_verification"]);
    expect(memberRequirements(true, "solar_installer").find((r) => r.need === "required" && r.kind !== "identity")?.anyOf).toContain("trade_certificate");
    expect(memberRequirements(true, "").map((r) => r.kind)).toEqual(["identity", "certificate", "training_certificate"]);
  });

  it("flags a licence that has run out, and one that needs a date and has none", () => {
    const d = filled();
    d.licences[0].validUntil = "2026-11-16";
    d.licences[1].validUntil = "";
    const texts = onboardingGaps("contractor", d, docs("identity", "licence", "supervisor_permit", "address_proof", "pan", "bank_proof"), NOW).map((g) => g.text);
    expect(texts).toEqual(["Licence 1: it ran out on 2026-11-16. Send the renewed one, or its receipt if the renewal is under way", "Licence 2: the date it is valid until"]);
    d.licences[0].validUntil = "2026-11-17";
    expect(onboardingGaps("contractor", d, docs("identity", "licence", "supervisor_permit", "address_proof", "pan", "bank_proof"), NOW).map((g) => g.text)).toEqual(["Licence 2: the date it is valid until"]);
  });

  it("asks for an emergency contact, a business's capabilities, and a current address only when it is not the same", () => {
    const d = filled();
    d.person.emergencyName = "";
    d.person.emergencyPhone = "12";
    d.business.capabilities = [];
    d.person.currentSame = false;
    const all = docs("identity", "licence", "supervisor_permit", "address_proof", "pan", "bank_proof");
    const texts = onboardingGaps("contractor", d, all, NOW).map((g) => g.text);
    expect(texts).toEqual(["The name of someone we can call in an emergency", "Their phone number (10 digits)", "Your current address", "The town or city of your current address", "The PIN code of your current address (six digits)", "At least one thing your business does"]);
    // a technician or surveyor is not a business: no capabilities
    expect(onboardingGaps("technician", { ...d, person: { ...d.person, currentSame: true } }, docs("identity", "certificate", "police_verification", "pan", "bank_proof"), NOW).some((g) => g.text.includes("your business does"))).toBe(false);
  });
});

describe("documentSubjectProblem", () => {
  const d = filled();
  d.team.members = [{ ...member, id: "r1", name: "Ravi" }];

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
