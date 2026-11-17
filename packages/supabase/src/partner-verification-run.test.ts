import { generateKeyPairSync, privateDecrypt, constants } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyOnboarding, type OnboardingData } from "./partner-onboarding";
import { cashfreeSignature, cleanName } from "./partner-cashfree";
import { runChecks, panNameFor, type DocRow } from "./partner-verification-run";

// ---- a pretend Cashfree: answers by path, counts the calls ----

type Answer = { status?: number; body: unknown };
let calls: { path: string; headers: Record<string, string>; body: unknown }[] = [];
let answers: Record<string, Answer> = {};

beforeEach(() => {
  calls = [];
  answers = {
    "/pan": { body: { valid: true, pan: "ABCPV1234D", type: "Individual", registered_name: "PRIYA RAMAN", name_provided: "Priya Raman", name_match_result: "DIRECT_MATCH", name_match_score: "100.00", pan_status: "VALID", aadhaar_seeding_status: "Y", reference_id: 161 } },
    "/gstin": { body: { valid: true, legal_name_of_business: "SUN ELECTRICALS PRIVATE LIMITED", trade_name_of_business: "SUN ELECTRICALS", gst_in_status: "Active", reference_id: 19 } },
    "/bank-account/sync": { body: { account_status: "VALID", account_status_code: "ACCOUNT_IS_VALID", name_at_bank: "PRIYA RAMAN", bank_name: "YES BANK", name_match_result: "DIRECT_MATCH", name_match_score: "100.00", reference_id: 34 } },
    "/udyam": { body: { status: "SUCCESS", enterprise_name: "SUN ELECTRICALS", enterprise_type: "Micro", classification_year: "2024-25", reference_id: 8 } },
    "/name-match": { body: { score: 1, reason: "DIRECT_MATCH", reference_id: 5 } },
    "/face-match": { body: { status: "SUCCESS", face_match_result: "YES", face_match_score: 0.95, ref_id: 9 } },
    "/face-liveness": { body: { status: "SUCCESS", liveness: true, liveness_score: 0.98, quality: { blur: false, exposure: "NEUTRAL" }, reference_id: 7 } },
  };
  process.env.CASHFREE_CLIENT_ID = "CF-test-id";
  process.env.CASHFREE_CLIENT_SECRET = "cfsk_test_secret";
  delete process.env.CASHFREE_PUBLIC_KEY;
  delete process.env.CASHFREE_ENV;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: { headers: Record<string, string>; body: unknown }) => {
      const path = new URL(url).pathname.replace("/verification", "");
      calls.push({ path, headers: init.headers, body: typeof init.body === "string" ? JSON.parse(init.body) : init.body });
      const a = answers[path] ?? { status: 404, body: { code: "nope" } };
      return new Response(JSON.stringify(a.body), { status: a.status ?? 200, headers: { "Content-Type": "application/json" } });
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.CASHFREE_CLIENT_ID;
  delete process.env.CASHFREE_CLIENT_SECRET;
});

// ---- a pretend database: one table, the calls the runner makes ----

function fakeDb() {
  const table = new Map<string, Record<string, unknown>>();
  const db = {
    from: (name: string) => {
      if (name !== "partner_verifications") throw new Error(`unexpected table ${name}`);
      return {
        select: () => ({ eq: async () => ({ data: [...table.values()] }) }),
        upsert: async (row: Record<string, unknown>) => {
          table.set(`${row.subject}|${row.kind}`, row);
          return { error: null };
        },
      };
    },
  };
  return { db: db as never, table };
}

const filled = (): OnboardingData => {
  const d = emptyOnboarding();
  d.person.name = "Priya Raman";
  d.business = { ...d.business, name: "Sun Electricals Pvt Ltd", kind: "proprietorship", pan: "ABCPV1234D", gstin: "33ABCPV1234D1Z5" };
  d.bank = { holder: "Priya Raman", bankName: "", branch: "", ifsc: "YESB0000262", accountType: "", accountNumber: "026291800001191" };
  return d;
};
const doc = (id: string, kind: string, subject: string, name: string, at = "2026-11-17T10:00:00Z"): DocRow => ({ id, kind, subject, file_name: name, storage_path: `app/${id}-${name}`, uploaded_at: at });
const base = (over: Record<string, unknown> = {}) => {
  const f = fakeDb();
  return { f, input: { db: f.db, applicationId: "app", partnerType: "contractor", data: filled(), docs: [] as DocRow[], download: async () => Buffer.from("img"), actor: { by: "system" as const }, ...over } };
};

describe("the key and the signature", () => {
  it("sends the keys, and a signature only when a public key is set; the signature opens to the client id and the time", async () => {
    const { input } = base();
    await runChecks({ ...input, kinds: ["pan"] });
    expect(calls[0].headers["x-client-id"]).toBe("CF-test-id");
    expect(calls[0].headers["x-cf-signature"]).toBeUndefined();

    const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048, publicKeyEncoding: { type: "spki", format: "pem" }, privateKeyEncoding: { type: "pkcs8", format: "pem" } });
    process.env.CASHFREE_PUBLIC_KEY = publicKey.replace(/\n/g, "\\n");
    const again = base();
    await runChecks({ ...again.input, kinds: ["gstin"] });
    const sig = calls[1].headers["x-cf-signature"];
    const opened = privateDecrypt({ key: privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha1" }, Buffer.from(sig, "base64")).toString();
    expect(opened).toMatch(/^CF-test-id\.\d{10}$/);
    expect(cashfreeSignature("x", publicKey, 1_700_000_000_000)).not.toBe(cashfreeSignature("x", publicKey, 1_700_000_001_000));
  });

  it("cleans a name to what Cashfree takes", () => {
    expect(cleanName("  R. Kumar (Sr) & Sons, #1 ")).toBe("R. Kumar Sr & Sons 1");
    expect(cleanName("x".repeat(150))).toHaveLength(100);
  });

  it("says plainly when the server has no keys, and does not call anyone", async () => {
    delete process.env.CASHFREE_CLIENT_ID;
    const { input, f } = base();
    const r = await runChecks({ ...input, kinds: ["pan"] });
    expect(r[0]).toMatchObject({ status: "error", code: "config", ran: false });
    expect(calls).toHaveLength(0);
    expect(f.table.size).toBe(0);
  });
});

describe("PAN, GST and bank", () => {
  it("asks about the right details, keeps each result, and passes what matches", async () => {
    const { input, f } = base();
    const r = await runChecks({ ...input, kinds: ["pan", "gstin", "bank"] });
    expect(r.map((x) => [x.kind, x.status])).toEqual([["pan", "passed"], ["gstin", "passed"], ["bank", "passed"]]);
    expect(calls.find((c) => c.path === "/pan")?.body).toEqual({ pan: "ABCPV1234D", name: "Priya Raman" });
    expect(calls.find((c) => c.path === "/gstin")?.body).toEqual({ GSTIN: "33ABCPV1234D1Z5" });
    expect(calls.find((c) => c.path === "/bank-account/sync")?.body).toEqual({ bank_account: "026291800001191", ifsc: "YESB0000262", name: "Priya Raman" });
    expect(f.table.get("partner|pan")).toMatchObject({ status: "passed", provider_ref: "161", partner_attempts: 0 });
  });

  it("checks a firm's PAN against the business name, and a proprietor's against the person", () => {
    const d = filled();
    expect(panNameFor("contractor", d)).toBe("Priya Raman");
    d.business.kind = "company";
    expect(panNameFor("contractor", d)).toBe("Sun Electricals Pvt Ltd");
    expect(panNameFor("technician", d)).toBe("Priya Raman");
  });

  it("does not ask when the details are not there, and says what is missing", async () => {
    const d = emptyOnboarding();
    const { input } = base({ data: d });
    const r = await runChecks({ ...input, kinds: ["pan", "gstin", "bank"] });
    expect(r.map((x) => x.skipped)).toEqual(["missing", "missing", "missing"]);
    expect(calls).toHaveLength(0);
  });

  it("does not ask again for the same details (it costs money), but does when they changed, when forced, or when it could not be answered", async () => {
    const { input, f } = base();
    await runChecks({ ...input, kinds: ["pan"] });
    const second = await runChecks({ ...input, kinds: ["pan"] });
    expect(second[0]).toMatchObject({ skipped: "unchanged", ran: false });
    expect(calls).toHaveLength(1);

    await runChecks({ ...input, kinds: ["pan"], force: true });
    expect(calls).toHaveLength(2);

    const changed = { ...input, data: { ...filled(), business: { ...filled().business, pan: "XYZPP4321W" } } };
    await runChecks({ ...changed, kinds: ["pan"] });
    expect(calls).toHaveLength(3);

    // new details and the service cannot answer: the failure is what is stored, and the next ask tries again by itself
    const newer = { ...input, data: { ...filled(), business: { ...filled().business, pan: "AZJPG7110R" } } };
    answers["/pan"] = { status: 502, body: { type: "internal_error", code: "verification_failed", message: "Authorised source is temporarily unavailable" } };
    const failed = await runChecks({ ...newer, kinds: ["pan"] });
    expect(failed[0]).toMatchObject({ status: "error", code: "upstream" });
    expect(f.table.get("partner|pan")?.status).toBe("error");
    answers["/pan"] = { body: { valid: true, registered_name: "X", name_match_result: "DIRECT_MATCH", pan_status: "VALID" } };
    expect((await runChecks({ ...newer, kinds: ["pan"] }))[0].ran).toBe(true);
    expect(f.table.get("partner|pan")?.status).toBe("passed");
  });

  it("keeps a good answer for the same details when the service cannot answer a second time", async () => {
    const { input, f } = base();
    await runChecks({ ...input, kinds: ["pan"] });
    answers["/pan"] = { status: 502, body: { code: "verification_failed", message: "down" } };
    const again = await runChecks({ ...input, kinds: ["pan"], force: true });
    expect(again[0]).toMatchObject({ status: "error", ran: true });
    expect(f.table.get("partner|pan")?.status).toBe("passed");
  });

  it("lets a partner ask only a few times, counts only answered askings, and gives a partner only PAN, GST and bank", async () => {
    const { input, f } = base({ actor: { by: "partner" } });
    for (let i = 0; i < 3; i++) {
      input.data = { ...filled(), business: { ...filled().business, pan: ["ABCPV1234D", "XYZPP4321W", "AZJPG7110R"][i] } };
      await runChecks({ ...input, kinds: ["pan"] });
    }
    expect(f.table.get("partner|pan")?.partner_attempts).toBe(3);
    input.data = { ...filled(), business: { ...filled().business, pan: "ABCCD8000T" } };
    const fourth = await runChecks({ ...input, kinds: ["pan"] });
    expect(fourth[0].skipped).toBe("limit");
    expect(calls.filter((c) => c.path === "/pan")).toHaveLength(3);

    const mixed = await runChecks({ ...input, kinds: ["pan", "face_match", "name_match"] });
    expect(mixed.map((x) => x.kind)).toEqual(["pan"]);

    const errs = base({ actor: { by: "partner" } });
    answers["/gstin"] = { status: 502, body: { code: "verification_failed", message: "down" } };
    await runChecks({ ...errs.input, kinds: ["gstin"] });
    expect(errs.f.table.get("partner|gstin")).toMatchObject({ status: "error", partner_attempts: 0 });
  });

  it("reads the service's own failures: no balance, a blocked address, bad keys, a fraud account", async () => {
    const run = async (a: Answer, kind: "pan" | "bank") => (await runChecks({ ...base().input, kinds: [kind], force: true }))[0];
    answers["/pan"] = { status: 403, body: { type: "authentication_error", code: "ip_validation_failed", message: "IP not whitelisted" } };
    expect(await run(answers["/pan"], "pan")).toMatchObject({ status: "error", code: "ip" });
    answers["/pan"] = { status: 401, body: { code: "authentication_failed" } };
    expect((await run(answers["/pan"], "pan")).code).toBe("auth");
    answers["/pan"] = { status: 422, body: { code: "insufficient_balance" } };
    expect((await run(answers["/pan"], "pan")).code).toBe("balance");
    answers["/pan"] = { status: 429, body: { code: "too_many_requests_per_ip" } };
    expect((await run(answers["/pan"], "pan")).code).toBe("rate");
    answers["/bank-account/sync"] = { status: 422, body: { type: "validation_error", code: "fraud_account", message: "fraud" } };
    expect(await run(answers["/bank-account/sync"], "bank")).toMatchObject({ status: "failed", summary: expect.stringContaining("fraud") });
  });

  it("checks a Udyam number, only when it is a Udyam number, and does not ask again for the same one", async () => {
    const none = base();
    expect((await runChecks({ ...none.input, kinds: ["udyam"] }))[0]).toMatchObject({ status: "error", skipped: "missing" });
    expect(calls).toHaveLength(0);

    const data = filled();
    data.business.udyam = "UDYAM-UP-43-1234567";
    const first = base({ data });
    const a = await runChecks({ ...first.input, kinds: ["udyam"] });
    expect(a[0]).toMatchObject({ status: "passed", ran: true });
    expect(calls.map((c) => c.path)).toEqual(["/udyam"]);
    expect(calls[0].body).toMatchObject({ udyam: "UDYAM-UP-43-1234567" });
    expect(first.f.table.get("partner|udyam")).toMatchObject({ status: "passed" });
    // the same number again costs nothing
    const again = await runChecks({ ...first.input, kinds: ["udyam"] });
    expect(again[0].skipped).toBe("unchanged");
    expect(calls).toHaveLength(1);
    // a partner may ask for it too
    expect((await runChecks({ ...base({ data }).input, kinds: ["udyam"], actor: { by: "partner" } }))[0].kind).toBe("udyam");
  });

  it("asks Cashfree's Name Match when a PAN or bank answer carries no match of its own (the sandbox), and does nothing of the kind when it does", async () => {
    // with the match words in the answer: no extra call
    const withWords = base();
    await runChecks({ ...withWords.input, kinds: ["pan", "bank"] });
    expect(calls.map((c) => c.path)).toEqual(["/pan", "/bank-account/sync"]);

    // without them: one Name Match call each, with the name given and the name found, and its answer is used and labelled
    calls = [];
    answers["/pan"] = { body: { valid: true, pan: "ABCPV1234D", registered_name: "PRIYA RAMAN", name_provided: "Priya Raman", pan_status: "VALID", aadhaar_seeding_status: "Y", reference_id: 1 } };
    answers["/bank-account/sync"] = { body: { account_status: "VALID", account_status_code: "ACCOUNT_IS_VALID", name_at_bank: "PRIYA RAMAN", bank_name: "YES BANK", name_match_result: null, name_match_score: null, reference_id: 2 } };
    answers["/name-match"] = { body: { score: 0.93, reason: "GOOD_PARTIAL_MATCH", reference_id: 5 } };
    const bare = base();
    const out = await runChecks({ ...bare.input, kinds: ["pan", "bank"] });
    expect(calls.map((c) => c.path)).toEqual(["/pan", "/name-match", "/bank-account/sync", "/name-match"]);
    expect(calls[1].body).toMatchObject({ name_1: "Priya Raman", name_2: "PRIYA RAMAN" });
    expect(out.map((r) => r.status)).toEqual(["passed", "passed"]);
    expect(out[0].summary).toContain("by Cashfree Name Match");
    expect(bare.f.table.get("partner|bank")?.detail).toMatchObject({ name_match_result: "GOOD_PARTIAL_MATCH", name_match_source: "name_match_service" });

    // an invalid PAN is not compared; a failing Name Match leaves the result as "needs a look"
    calls = [];
    answers["/pan"] = { body: { valid: false, message: "Invalid PAN", reference_id: 3 } };
    expect((await runChecks({ ...base().input, kinds: ["pan"], force: true }))[0].status).toBe("failed");
    expect(calls.map((c) => c.path)).toEqual(["/pan"]);
    answers["/pan"] = { body: { valid: true, pan: "ABCPV1234D", registered_name: "PRIYA RAMAN", name_provided: "Priya Raman", pan_status: "VALID", aadhaar_seeding_status: "Y", reference_id: 1 } };
    answers["/name-match"] = { status: 500, body: { code: "internal" } };
    expect((await runChecks({ ...base().input, kinds: ["pan"], force: true }))[0]).toMatchObject({ status: "review", code: "name_missing" });
  });
});

describe("the names against each other", () => {
  it("compares the name registered to the PAN with the name at the bank, once both are known", async () => {
    const { input } = base();
    const r = await runChecks({ ...input, kinds: ["pan", "bank", "name_match"] });
    expect(r.map((x) => x.kind)).toEqual(["pan", "bank", "name_match"]);
    expect(calls.find((c) => c.path === "/name-match")?.body).toMatchObject({ name_1: "PRIYA RAMAN", name_2: "PRIYA RAMAN" });
    expect(r[2].status).toBe("passed");
  });
  it("waits when the PAN or the bank has not been checked", async () => {
    const { input } = base();
    const r = await runChecks({ ...input, kinds: ["name_match"] });
    expect(r[0].skipped).toBe("missing");
  });
});

describe("faces", () => {
  const docs = [doc("s1", "selfie", "partner", "me.jpg"), doc("i1", "identity", "partner", "id.png"), doc("s2", "selfie", "member:r1", "r.jpg"), doc("i2", "identity", "member:r1", "id.pdf")];
  const withTeam = () => {
    const d = filled();
    d.team.members = [{ id: "r1", name: "Ravi", role: "", siteRole: "", phone: "", email: "", certificate: "", validUntil: "", needsLicence: true, addedAt: "" }];
    return d;
  };

  it("compares the selfie with the photo ID, and checks the selfie is live, for the partner and each team member", async () => {
    const { input, f } = base({ docs, data: withTeam() });
    const r = await runChecks({ ...input, kinds: ["face_match", "face_liveness"] });
    expect(r.map((x) => `${x.subject}|${x.kind}|${x.status}`)).toEqual(["partner|face_match|passed", "member:r1|face_match|review", "partner|face_liveness|passed", "member:r1|face_liveness|passed"]);
    expect(f.table.get("member:r1|face_match")?.summary).toContain("PDF");
    expect(calls.filter((c) => c.path === "/face-match")).toHaveLength(1);
    expect(calls.filter((c) => c.path === "/face-liveness")).toHaveLength(2);
  });

  it("uses the newest selfie, asks again for a new one, and can be limited to one person", async () => {
    const { input } = base({ docs, data: withTeam() });
    await runChecks({ ...input, kinds: ["face_liveness"], subjects: ["partner"] });
    expect(calls).toHaveLength(1);
    const newer = [...docs, doc("s3", "selfie", "partner", "me2.jpg", "2026-11-17T12:00:00Z")];
    await runChecks({ ...input, docs: newer, kinds: ["face_liveness"], subjects: ["partner"] });
    expect(calls).toHaveLength(2);
  });

  it("says what is missing, hands a photo over 5 MB to a person, and turns a failed download into a retry", async () => {
    const none = await runChecks({ ...base().input, kinds: ["face_match"] });
    expect(none[0]).toMatchObject({ skipped: "missing" });
    const big = await runChecks({ ...base({ docs }).input, kinds: ["face_match"], subjects: ["partner"], download: async () => Buffer.alloc(5 * 1024 * 1024 + 1) });
    expect(big[0]).toMatchObject({ status: "review", code: "large" });
    const down = await runChecks({ ...base({ docs }).input, kinds: ["face_match"], subjects: ["partner"], download: async () => null });
    expect(down[0].status).toBe("error");
  });
});
