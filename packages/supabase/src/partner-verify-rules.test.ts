import { describe, expect, it } from "vitest";
import { bankVerdict, digilockerCoversId, digilockerIdentity, digilockerVerdict, errorVerdict, faceMatchVerdict, gstinFill, gstinVerdict, livenessVerdict, nameMatchVerdict, nameSimilarity, normaliseDob, normaliseName, panInGstin, panVerdict, partnerMessage, udyamVerdict } from "./partner-verify-rules";

describe("DigiLocker identity", () => {
  const doc = { status: "SUCCESS", uid: "xxxxxxxx5647", name: "John Doe", dob: "14-06-1988", gender: "M", photo_link: "BASE64PHOTO", split_address: { house: "Plot 42", street: "3rd Main Road", vtc: "Anna Nagar", dist: "Chennai", state: "Tamil Nadu", pincode: "600040", landmark: "", po: "Anna Nagar", subdist: "Chennai" } };
  it("keeps the name, date of birth, gender, address and the last four digits, and nothing else (no number, no photo)", () => {
    const id = digilockerIdentity(doc)!;
    expect(id).toEqual({ name: "John Doe", dob: "1988-06-14", gender: "Male", address: "Plot 42, 3rd Main Road, Anna Nagar, Chennai, Tamil Nadu, 600040", pin: "600040", uid_last4: "5647" });
    expect(JSON.stringify(id)).not.toMatch(/BASE64PHOTO|xxxxxxxx/i);
  });
  it("reads the date and gender in the shapes DigiLocker uses, and gives nothing when there is no name", () => {
    expect(normaliseDob("14/06/1988")).toBe("1988-06-14");
    expect(normaliseDob("1988-06-14")).toBe("1988-06-14");
    expect(normaliseDob("June 1988")).toBe("");
    expect(digilockerIdentity({ ...doc, gender: "F" })?.gender).toBe("Female");
    expect(digilockerIdentity({ ...doc, gender: "T" })?.gender).toBe("Other");
    expect(digilockerIdentity({ ...doc, uid: "12" })?.uid_last4).toBe("");
    expect(digilockerIdentity({ ...doc, name: "  " })).toBeNull();
  });
  it("passes an adult whose typed name matches by Cashfree's Name Match, asks for a look when it differs or was not compared, and fails someone under 18", () => {
    const id = digilockerIdentity(doc)!;
    const now = new Date("2026-11-17T00:00:00Z");
    expect(digilockerVerdict(id, { typedName: "John Doe", nameMatch: { result: "DIRECT_MATCH", score: 1 }, now })).toMatchObject({ status: "passed", code: "ok" });
    expect(digilockerVerdict(id, { typedName: "Raja Kumar", nameMatch: { result: "NO_MATCH", score: 0 }, now })).toMatchObject({ status: "review", code: "name_differs" });
    expect(digilockerVerdict(id, { typedName: "John Doe", nameMatch: null, now })).toMatchObject({ status: "review", code: "name_missing" });
    expect(digilockerVerdict(id, { now })).toMatchObject({ status: "passed", code: "ok" });
    expect(digilockerVerdict({ ...id, dob: "2010-01-01" }, { typedName: "John Doe", nameMatch: { result: "DIRECT_MATCH" }, now })).toMatchObject({ status: "failed", code: "under_age" });
    // the stored detail never carries DigiLocker's date of birth or address, only the name that was typed (kept to notice a later change)
    const detail = digilockerVerdict(id, { typedName: "John Doe", nameMatch: { result: "DIRECT_MATCH" }, now }).detail;
    expect(JSON.stringify(detail)).not.toMatch(/1988|Plot|Anna/);
    expect(detail.typed_name).toBe("JOHN DOE");
  });
  it("lets DigiLocker stand in for a photo ID only while it passed and the name on the form is still the one verified (or DigiLocker's own)", () => {
    const ok = { status: "passed", typedAtVerification: "JOHN DOE", stated: "John Doe", currentTyped: "John Doe" };
    expect(digilockerCoversId(ok)).toBe(true);
    // the typed name was blank when verifying, and the form was filled with DigiLocker's own name
    expect(digilockerCoversId({ ...ok, typedAtVerification: "", currentTyped: "JOHN DOE" })).toBe(true);
    // needs a look or failed: the photo ID is still asked for
    expect(digilockerCoversId({ ...ok, status: "review" })).toBe(false);
    expect(digilockerCoversId({ ...ok, status: "failed" })).toBe(false);
    expect(digilockerCoversId({ ...ok, status: undefined })).toBe(false);
    // verified as one person, then the name on the form changed to another: not covered
    expect(digilockerCoversId({ ...ok, currentTyped: "Raja Kumar" })).toBe(false);
    expect(digilockerCoversId({ ...ok, currentTyped: "" })).toBe(false);
  });
  it("says in plain words what happened, and compares the selfie with DigiLocker's photo in its own words", () => {
    expect(partnerMessage("digilocker", { status: "passed", code: "ok" })).toContain("verified with DigiLocker");
    expect(partnerMessage("digilocker", { status: "review", code: "name_differs" })).toContain("not a close match");
    expect(partnerMessage("digilocker", { status: "failed", code: "under_age" })).toContain("under 18");
    expect(faceMatchVerdict({ face_match_result: "YES", face_match_score: 0.9 }, "DigiLocker photo").summary).toContain("DigiLocker photo");
    expect(faceMatchVerdict({ face_match_result: "NO", face_match_score: 0.1 }, "DigiLocker photo").summary).toContain("photo in DigiLocker");
  });
});

describe("Udyam", () => {
  const ok = { status: "SUCCESS", enterprise_name: "SUN ELECTRICALS", enterprise_type: "Micro", classification_year: "2024-25", date_of_udyam_registration: "2021-03-04", split_address: { district: "KANPUR NAGAR", state: "UTTAR PRADESH", pincode: "208001" } };
  it("passes a registration found, in the business's name, and keeps only the useful parts", () => {
    const v = udyamVerdict(ok, { businessName: "Sun Electricals" });
    expect(v).toMatchObject({ status: "passed", code: "ok" });
    expect(v.summary).toContain("Micro");
    expect(v.detail).toMatchObject({ enterprise_name: "SUN ELECTRICALS", district: "KANPUR NAGAR", registered_on: "2021-03-04" });
    expect(JSON.stringify(v.detail)).not.toMatch(/mobile|email/i);
  });
  it("asks for a look when the enterprise name is not the business name, fails one that is not found or cancelled", () => {
    expect(udyamVerdict(ok, { businessName: "Green Roofs" })).toMatchObject({ status: "review", code: "name_differs" });
    expect(udyamVerdict(ok, {}).status).toBe("passed");
    expect(udyamVerdict({ status: "UDYAM_NOT_FOUND" }, {})).toMatchObject({ status: "failed", code: "not_found" });
    expect(udyamVerdict({ status: "UDYAM_IS_CANCELLED" }, {})).toMatchObject({ status: "failed", code: "cancelled" });
    expect(udyamVerdict({}, {}).status).toBe("failed");
  });
  it("tells the partner in plain words, showing the enterprise name (the register is public)", () => {
    expect(partnerMessage("udyam", { status: "passed", code: "ok", detail: { enterprise_name: "SUN ELECTRICALS" } })).toContain("SUN ELECTRICALS");
    expect(partnerMessage("udyam", { status: "failed", code: "cancelled" })).toContain("cancelled");
    expect(partnerMessage("udyam", { status: "failed", code: "not_found" })).toContain("No Udyam registration");
  });
});

describe("gstinFill", () => {
  it("takes the registered name, address, PIN code and year from a found GST registration, and nothing from a poor one", () => {
    expect(gstinFill({ legal_name: "SUN ELECTRICALS PRIVATE LIMITED", trade_name: "SUN ELECTRICALS", address: "12 Test Street, Ambattur, Chennai, Tamil Nadu, 600058", registered_on: "2017-09-30" })).toEqual({ name: "SUN ELECTRICALS PRIVATE LIMITED", address: "12 Test Street, Ambattur, Chennai, Tamil Nadu, 600058", started: "2017", pin: "600058" });
    expect(gstinFill({ trade_name: "SUN", registered_on: "30/09/2019" })).toEqual({ name: "SUN", address: "", started: "2019", pin: "" });
    expect(gstinFill({})).toBeNull();
    expect(gstinFill(undefined)).toBeNull();
  });
});

describe("names", () => {
  it("normalises case, punctuation and spacing", () => {
    expect(normaliseName("  M/s. Sun  Electricals & Co. ")).toBe("M S SUN ELECTRICALS AND CO");
  });
  it("scores equal names 1 and unrelated names 0, whatever the order", () => {
    expect(nameSimilarity("Ravi Kumar", "KUMAR RAVI")).toBe(1);
    expect(nameSimilarity("Ravi Kumar", "Priya Raman")).toBe(0);
    expect(nameSimilarity("", "Ravi")).toBe(0);
  });
  it("lets an initial stand for a name, and leaves company words out", () => {
    expect(nameSimilarity("R Kumar", "Ravi Kumar")).toBe(1);
    expect(nameSimilarity("Sun Electricals Pvt Ltd", "SUN ELECTRICALS PRIVATE LIMITED")).toBe(1);
    expect(nameSimilarity("Sun Electricals", "Sun Solar Works")).toBeCloseTo(1 / 3);
  });
});

describe("panVerdict", () => {
  const ok = { valid: true, pan: "ABCPV1234D", type: "Individual", registered_name: "JOHN DOE", name_provided: "JOHN DOE", name_match_result: "DIRECT_MATCH", name_match_score: "100.00", pan_status: "VALID", aadhaar_seeding_status: "Y" };
  it("passes a valid PAN whose name matches", () => {
    const v = panVerdict(ok);
    expect(v.status).toBe("passed");
    expect(v.summary).toContain("JOHN DOE");
  });
  it("fails a PAN the department does not know, and one that is deleted or deactivated", () => {
    expect(panVerdict({ valid: false, message: "Invalid PAN", name_match_result: "-" }).code).toBe("invalid");
    expect(panVerdict({ ...ok, pan_status: "DEACTIVATED" })).toMatchObject({ status: "failed", code: "inactive" });
  });
  it("asks for a look at a partial name match, fails a different name, and notes a PAN not linked to Aadhaar", () => {
    expect(panVerdict({ ...ok, name_match_result: "MODERATE_PARTIAL_MATCH", name_match_score: "60.00" })).toMatchObject({ status: "review", code: "name_partial" });
    expect(panVerdict({ ...ok, name_match_result: "NO_MATCH", name_match_score: "0" })).toMatchObject({ status: "failed", code: "name_mismatch" });
    expect(panVerdict({ ...ok, aadhaar_seeding_status: "R" })).toMatchObject({ status: "review", code: "unlinked" });
    expect(panVerdict({ ...ok, type: "Company", name_provided: undefined, name_match_result: undefined, aadhaar_seeding_status: "NA" })).toMatchObject({ status: "review", code: "name_missing" });
  });
  it("never compares names itself: with no match words from Cashfree it asks for a look, and a match that came from Cashfree's Name Match service says so", () => {
    const bare = { ...ok, name_match_result: undefined, name_match_score: undefined };
    expect(panVerdict(bare)).toMatchObject({ status: "review", code: "name_missing" });
    const viaService = panVerdict({ ...bare, name_match_result: "DIRECT_MATCH", name_match_score: 1, name_match_via: "name_match" });
    expect(viaService).toMatchObject({ status: "passed", code: "ok" });
    expect(viaService.summary).toContain("by Cashfree Name Match");
    expect(viaService.detail).toMatchObject({ name_match_source: "name_match_service" });
    expect(panVerdict(ok).detail).toMatchObject({ name_match_source: "service" });
  });
});

describe("gstinVerdict", () => {
  const ok = { valid: true, legal_name_of_business: "SUN ELECTRICALS PRIVATE LIMITED", trade_name_of_business: "SUN ELECTRICALS", gst_in_status: "Active" };
  const ctx = { gstin: "33ABCDE1234F1Z5", pan: "ABCDE1234F", businessName: "Sun Electricals Pvt Ltd" };
  it("finds the PAN inside a GSTIN", () => {
    expect(panInGstin("33ABCDE1234F1Z5")).toBe("ABCDE1234F");
  });
  it("passes an active registration built on the PAN given, in the business's name", () => {
    expect(gstinVerdict(ok, ctx).status).toBe("passed");
  });
  it("fails a number that does not exist, one that is not active, and one built on another PAN", () => {
    expect(gstinVerdict({ valid: undefined, message: "GSTIN Doesn't Exist" }, ctx).code).toBe("not_found");
    expect(gstinVerdict({ ...ok, gst_in_status: "Cancelled" }, ctx).code).toBe("inactive");
    expect(gstinVerdict(ok, { ...ctx, pan: "ZZZZZ9999Z" }).code).toBe("pan_mismatch");
  });
  it("asks for a look when the registered names are not the business name given, and does not insist on a name or PAN that was not given", () => {
    expect(gstinVerdict(ok, { ...ctx, businessName: "Green Roofs" })).toMatchObject({ status: "review", code: "name_differs" });
    expect(gstinVerdict(ok, { gstin: ctx.gstin }).status).toBe("passed");
  });
});

describe("bankVerdict", () => {
  const ok = { account_status: "VALID", account_status_code: "ACCOUNT_IS_VALID", name_at_bank: "BHARATHTEST GKUMARUT", bank_name: "YES BANK", branch: "SANTACRUZ, MUMBAI", name_match_result: "GOOD_PARTIAL_MATCH", name_match_score: "90.00" };
  it("passes a valid account whose holder matches", () => {
    expect(bankVerdict(ok, { holder: "Bharath Kumar" }).status).toBe("passed");
  });
  it("fails an invalid account with the reason in words", () => {
    expect(bankVerdict({ account_status: "INVALID", account_status_code: "INVALID_IFSC_FAIL" }, {}).summary).toContain("IFSC");
    expect(bankVerdict({ account_status: "INVALID", account_status_code: "ACCOUNT_BLOCKED" }, {}).summary).toContain("blocked");
    expect(bankVerdict({ account_status: "INVALID", account_status_code: "SOMETHING_ELSE" }, {}).summary).toContain("could not confirm");
  });
  it("asks for a look at a partial holder match and fails a different holder", () => {
    expect(bankVerdict({ ...ok, name_match_result: "POOR_PARTIAL_MATCH", name_match_score: "38.00" }, {}).status).toBe("review");
    expect(bankVerdict({ ...ok, name_match_result: "NO_MATCH" }, {})).toMatchObject({ status: "failed", code: "name_mismatch" });
  });
  it("never compares the holder itself: with no match words it asks for a look, and a match from Cashfree's Name Match service says so", () => {
    const bare = { account_status: "VALID", account_status_code: "ACCOUNT_IS_VALID", name_at_bank: "JOHN DOE", bank_name: "YES BANK", name_match_result: null, name_match_score: null };
    expect(bankVerdict(bare, { holder: "John Doe" })).toMatchObject({ status: "review", code: "name_missing" });
    const viaService = bankVerdict({ ...bare, name_match_result: "NO_MATCH", name_match_score: 0, name_match_via: "name_match" }, { holder: "Raja Kumar" });
    expect(viaService).toMatchObject({ status: "failed", code: "name_mismatch" });
    expect(viaService.detail).toMatchObject({ name_match_source: "name_match_service" });
  });
});

describe("nameMatchVerdict", () => {
  const names = { pan: "JOHN DOE", bank: "JOHN DE" };
  it("passes a good match and only ever asks for a look otherwise, never fails", () => {
    expect(nameMatchVerdict({ reason: "GOOD_PARTIAL_MATCH", score: 0.93 }, names).status).toBe("passed");
    expect(nameMatchVerdict({ reason: "NO_MATCH", score: 0 }, names).status).toBe("review");
    expect(nameMatchVerdict({ reason: "POOR_PARTIAL_MATCH", score: 0.53 }, names).status).toBe("review");
  });
});

describe("faces", () => {
  it("passes a match, asks for a look at a close one or several faces, fails a clear mismatch", () => {
    expect(faceMatchVerdict({ status: "SUCCESS", face_match_result: "YES", face_match_score: 0.95 }).status).toBe("passed");
    expect(faceMatchVerdict({ status: "SUCCESS", face_match_result: "NO", face_match_score: 0.6 }).status).toBe("review");
    expect(faceMatchVerdict({ status: "MULTIPLE_FACE_DETECTED", face_match_result: "NO", face_match_score: 0 }).status).toBe("review");
    expect(faceMatchVerdict({ status: "SUCCESS", face_match_result: "NO", face_match_score: 0.1 }).status).toBe("failed");
  });
  it("passes a live face, notes poor quality, fails no face or a face that is not live", () => {
    expect(livenessVerdict({ status: "SUCCESS", liveness: true, liveness_score: 0.98, quality: { blur: false, exposure: "NEUTRAL" }, face_occluded: { value: false }, pose: { head_turned: false } }).status).toBe("passed");
    expect(livenessVerdict({ status: "SUCCESS", liveness: true, liveness_score: 0.9, quality: { blur: true, exposure: "UNDER_EXPOSED" } })).toMatchObject({ status: "review", code: "poor_quality" });
    expect(livenessVerdict({ status: "FACE_NOT_DETECTED", liveness: false }).code).toBe("no_face");
    expect(livenessVerdict({ status: "REAL_FACE_NOT_DETECTED", liveness: false }).code).toBe("not_live");
    expect(livenessVerdict({ status: "MULTIPLE_FACES_DETECTED", liveness: false }).status).toBe("review");
  });
});

describe("what the partner is told", () => {
  it("never repeats a name held by the PAN or the bank, only whether it matched", () => {
    const pan = panVerdict({ valid: true, registered_name: "SECRET HOLDER NAME", name_provided: "Someone", name_match_result: "NO_MATCH", name_match_score: "0", pan_status: "VALID" });
    const bank = bankVerdict({ account_status: "VALID", name_at_bank: "SECRET HOLDER NAME", name_match_result: "NO_MATCH" }, { holder: "Someone" });
    for (const [kind, v] of [["pan", pan], ["bank", bank]] as const) expect(partnerMessage(kind, v)).not.toContain("SECRET");
    expect(partnerMessage("pan", pan)).toContain("different name");
  });
  it("shows the GST registration's own name, which is public", () => {
    const v = gstinVerdict({ valid: true, legal_name_of_business: "SUN ELECTRICALS", gst_in_status: "Active" }, { gstin: "33ABCDE1234F1Z5" });
    expect(partnerMessage("gstin", v)).toContain("SUN ELECTRICALS");
  });
  it("says a check that could not run will be done by the team, and is quiet for kinds the partner cannot ask for", () => {
    expect(partnerMessage("bank", errorVerdict("upstream"))).toContain("Our team will check it");
    expect(partnerMessage("face_match", { status: "passed", code: "ok" })).toBe("");
  });
});

describe("errorVerdict", () => {
  it("says who can fix each problem", () => {
    expect(errorVerdict("ip").summary).toContain("Cashfree dashboard");
    expect(errorVerdict("balance").summary).toContain("balance");
    expect(errorVerdict("config").status).toBe("error");
  });
});
