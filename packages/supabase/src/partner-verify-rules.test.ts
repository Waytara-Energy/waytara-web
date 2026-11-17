import { describe, expect, it } from "vitest";
import { bankVerdict, errorVerdict, faceMatchVerdict, gstinVerdict, livenessVerdict, nameMatchVerdict, nameSimilarity, normaliseName, panInGstin, panVerdict, partnerMessage } from "./partner-verify-rules";

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
    expect(panVerdict({ ...ok, type: "Company", name_match_result: undefined, aadhaar_seeding_status: "NA" })).toMatchObject({ status: "review", code: "name_missing" });
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
