import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { digilockerCoveredSubjects, refreshDigilocker, startDigilocker } from "./partner-digilocker";
import { emptyOnboarding, type OnboardingData } from "./partner-onboarding";
import type { DocRow } from "./partner-verification-run";

// ---- a pretend Cashfree: answers by method and path, counts the calls ----

type Answer = { status?: number; body: unknown };
let calls: { method: string; path: string; query: string; body: unknown }[] = [];
let answers: Record<string, Answer> = {};

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9]);
const PHOTO = JPEG.toString("base64");

const doc = (over: Record<string, unknown> = {}) => ({
  status: "SUCCESS",
  uid: "xxxxxxxx5647",
  name: "Priya Raman",
  dob: "14-06-1988",
  gender: "F",
  photo_link: PHOTO,
  split_address: { house: "Plot 42", street: "3rd Main Road", dist: "Chennai", state: "Tamil Nadu", pincode: "600040" },
  ...over,
});

beforeEach(() => {
  calls = [];
  answers = {
    "POST /digilocker": { body: { verification_id: "x", reference_id: 77, url: "https://verification-test.cashfree.com/dgl/abc", status: "PENDING" } },
    "GET /digilocker": { body: { status: "AUTHENTICATED", user_details: { name: "Priya Raman", eaadhaar: "Y" } } },
    "GET /digilocker/document/AADHAAR": { body: doc() },
    "POST /name-match": { body: { score: 1, reason: "DIRECT_MATCH", reference_id: 5 } },
    "POST /face-match": { body: { status: "SUCCESS", face_match_result: "YES", face_match_score: 0.95, ref_id: 9 } },
  };
  process.env.CASHFREE_CLIENT_ID = "CF-test-id";
  process.env.CASHFREE_CLIENT_SECRET = "cfsk_test_secret";
  delete process.env.CASHFREE_PUBLIC_KEY;
  delete process.env.CASHFREE_ENV;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: { method?: string; body?: unknown }) => {
      const u = new URL(url);
      const method = init.method ?? "GET";
      const path = u.pathname.replace("/verification", "");
      calls.push({ method, path, query: u.search, body: typeof init.body === "string" ? JSON.parse(init.body) : init.body });
      const a = answers[`${method} ${path}`] ?? { status: 404, body: { code: "nope" } };
      return new Response(JSON.stringify(a.body), { status: a.status ?? 200, headers: { "Content-Type": "application/json" } });
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.CASHFREE_CLIENT_ID;
  delete process.env.CASHFREE_CLIENT_SECRET;
});

// ---- a pretend database: two tables, the calls these functions make ----

type Row = Record<string, unknown>;
function fakeDb() {
  const tables: Record<string, Row[]> = { partner_digilocker: [], partner_verifications: [] };
  const from = (name: string) => {
    if (!(name in tables)) throw new Error(`unexpected table ${name}`);
    const filters: [string, unknown][] = [];
    let op: "select" | "update" = "select";
    let patch: Row = {};
    const matches = () => tables[name].filter((r) => filters.every(([k, v]) => r[k] === v));
    const run = () => {
      if (op === "update") {
        const hit = matches();
        for (const r of hit) Object.assign(r, patch);
        return { data: hit.map((r) => ({ ...r })), error: null };
      }
      return { data: matches().map((r) => ({ ...r })), error: null };
    };
    const q = {
      select: () => q,
      eq: (k: string, v: unknown) => (filters.push([k, v]), q),
      update: (p: Row) => ((op = "update"), (patch = p), q),
      upsert: async (row: Row, opts: { onConflict: string }) => {
        const keys = opts.onConflict.split(",");
        const t = tables[name];
        const i = t.findIndex((r) => keys.every((k) => r[k] === row[k]));
        if (i >= 0) t[i] = { ...t[i], ...row };
        else t.push({ id: `id${t.length + 1}`, ...row });
        return { error: null };
      },
      maybeSingle: async () => ({ data: run().data[0] ?? null }),
      then: (resolve: (v: unknown) => unknown) => resolve(run()),
    };
    return q;
  };
  return { db: { from } as never, tables };
}

const selfieDoc: DocRow = { id: "s1", kind: "selfie", subject: "partner", file_name: "me.jpg", storage_path: "app/s1-me.jpg", uploaded_at: "2026-11-17T10:00:00Z" };
const input = (f: ReturnType<typeof fakeDb>, over: Record<string, unknown> = {}) => ({ db: f.db, applicationId: "app", subject: "partner", typedName: "Priya Raman", docs: [selfieDoc], download: async () => JPEG, ...over });

describe("starting", () => {
  it("makes the link, remembers the session as pending, and sends an https redirect and only the Aadhaar document", async () => {
    const f = fakeDb();
    const r = await startDigilocker({ db: f.db, applicationId: "app", subject: "partner", redirectUrl: "https://www.example.com/partner/digilocker-done" });
    expect(r.url).toBe("https://verification-test.cashfree.com/dgl/abc");
    expect(calls[0].body).toMatchObject({ document_requested: ["AADHAAR"], redirect_url: "https://www.example.com/partner/digilocker-done" });
    expect(String((calls[0].body as { verification_id: string }).verification_id)).toMatch(/^[A-Za-z0-9._-]{8,50}$/);
    expect(f.tables.partner_digilocker[0]).toMatchObject({ application_id: "app", subject: "partner", status: "pending", identity: {} });
  });
  it("says plainly when the server has no keys, and calls nobody", async () => {
    delete process.env.CASHFREE_CLIENT_ID;
    await expect(startDigilocker({ db: fakeDb().db, applicationId: "app", subject: "partner", redirectUrl: "https://x.example/done" })).rejects.toMatchObject({ kind: "config" });
    expect(calls).toHaveLength(0);
  });
});

describe("waiting, agreeing, declining", () => {
  async function started() {
    const f = fakeDb();
    await startDigilocker({ db: f.db, applicationId: "app", subject: "partner", redirectUrl: "https://x.example/done" });
    calls = [];
    return f;
  }

  it("keeps waiting while the person is still on DigiLocker, and does not fetch the document", async () => {
    const f = await started();
    answers["GET /digilocker"] = { body: { status: "PENDING" } };
    const v = await refreshDigilocker(input(f));
    expect(v.state).toBe("pending");
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual(["GET /digilocker"]);
  });

  it("completes when they have agreed: keeps the small identity only, compares the name and the face with Cashfree, drops the photo, and tells the person", async () => {
    const f = await started();
    const v = await refreshDigilocker(input(f));
    expect(v.state).toBe("authenticated");
    expect(v.verdict).toBe("passed");
    expect(v.identity).toMatchObject({ name: "Priya Raman", dob: "1988-06-14", gender: "Female", uid_last4: "5647" });
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual(["GET /digilocker", "GET /digilocker/document/AADHAAR", "POST /name-match", "POST /face-match"]);

    // what is stored: the identity and the last four digits; never the number or the photo
    const row = f.tables.partner_digilocker[0];
    expect(row).toMatchObject({ status: "authenticated", uid_last4: "5647" });
    expect(JSON.stringify(f.tables)).not.toContain(PHOTO);
    expect(JSON.stringify(f.tables)).not.toContain("xxxxxxxx");

    // the two verdicts, the second marked as made against DigiLocker's photo
    const dl = f.tables.partner_verifications.find((r) => r.kind === "digilocker")!;
    expect(dl).toMatchObject({ status: "passed", subject: "partner" });
    expect(String(dl.summary)).toContain("Aadhaar ending 5647");
    expect(JSON.stringify(dl.detail)).not.toMatch(/1988|Plot/);
    expect((dl.detail as { typed_name: string }).typed_name).toBe("PRIYA RAMAN");
    const face = f.tables.partner_verifications.find((r) => r.kind === "face_match")!;
    expect(face).toMatchObject({ status: "passed" });
    expect(face.detail).toMatchObject({ source: "digilocker", selfie_id: "s1" });
    expect(String(face.summary)).toContain("DigiLocker photo");
  });

  it("does not ask Cashfree again once the session is complete (it costs money), and gives the same view", async () => {
    const f = await started();
    await refreshDigilocker(input(f));
    calls = [];
    const again = await refreshDigilocker(input(f));
    expect(again.state).toBe("authenticated");
    expect(calls).toHaveLength(0);
  });

  it("asks for a look when the typed name differs (Cashfree's Name Match decides), and still keeps the identity", async () => {
    const f = await started();
    answers["POST /name-match"] = { body: { score: 0.1, reason: "NO_MATCH" } };
    const v = await refreshDigilocker(input(f, { typedName: "Raja Kumar" }));
    expect(v.state).toBe("authenticated");
    expect(v.verdict).toBe("review");
    expect(v.message).toContain("not a close match");
  });

  it("does the face match only when there is a selfie, and carries on without it", async () => {
    const f = await started();
    const v = await refreshDigilocker(input(f, { docs: [] }));
    expect(v.verdict).toBe("passed");
    expect(calls.some((c) => c.path === "/face-match")).toBe(false);
    expect(f.tables.partner_verifications.some((r) => r.kind === "face_match")).toBe(false);
  });

  it("goes on when the face service cannot answer: the identity stands, no face result is made up", async () => {
    const f = await started();
    answers["POST /face-match"] = { status: 500, body: { code: "verification_failed" } };
    const v = await refreshDigilocker(input(f));
    expect(v.state).toBe("authenticated");
    expect(f.tables.partner_verifications.some((r) => r.kind === "face_match")).toBe(false);
  });

  it("says what happened when they decline, when the link runs out, or DigiLocker has no Aadhaar for them", async () => {
    for (const [status, state, extra] of [["CONSENT_DENIED", "consent_denied", {}], ["EXPIRED", "expired", {}], ["AUTHENTICATED", "failed", { user_details: { eaadhaar: "N" } }]] as const) {
      const f = await started();
      answers["GET /digilocker"] = { body: { status, ...extra } };
      const v = await refreshDigilocker(input(f));
      expect(v.state).toBe(state);
      expect(v.message.length).toBeGreaterThan(10);
      expect(f.tables.partner_digilocker[0]).toMatchObject({ status: state });
      expect(f.tables.partner_verifications).toHaveLength(0);
    }
  });

  it("treats a document DigiLocker is still preparing as still waiting, and a document without a name as a failure", async () => {
    const f = await started();
    answers["GET /digilocker/document/AADHAAR"] = { status: 202, body: { code: "validation_pending" } };
    expect((await refreshDigilocker(input(f))).state).toBe("pending");
    answers["GET /digilocker/document/AADHAAR"] = { body: doc({ status: "AADHAAR_NOT_LINKED", name: null }) };
    expect((await refreshDigilocker(input(f))).state).toBe("failed");
  });

  it("fails someone whose date of birth makes them under 18", async () => {
    const f = await started();
    answers["GET /digilocker/document/AADHAAR"] = { body: doc({ dob: "01-01-2015" }) };
    const v = await refreshDigilocker(input(f));
    expect(v.verdict).toBe("failed");
    expect(v.message).toContain("under 18");
  });

  it("stays pending, and decides nothing, when Cashfree cannot be reached just now", async () => {
    const f = await started();
    answers["GET /digilocker"] = { status: 502, body: { code: "verification_failed" } };
    const v = await refreshDigilocker(input(f));
    expect(v.state).toBe("pending");
    expect(f.tables.partner_digilocker[0]).toMatchObject({ status: "pending" });
  });

  it("shows nothing for a person who never started", async () => {
    const v = await refreshDigilocker(input(fakeDb()));
    expect(v).toEqual({ state: "none", message: "" });
    expect(calls).toHaveLength(0);
  });
});

describe("a team member", () => {
  const memberSelfie: DocRow = { ...selfieDoc, id: "ms1", subject: "member:r1", storage_path: "app/ms1-r.jpg" };
  async function memberStarted() {
    const f = fakeDb();
    await startDigilocker({ db: f.db, applicationId: "app", subject: "member:r1", redirectUrl: "https://x.example/done" });
    calls = [];
    return f;
  }

  it("has their own session, kept apart from the partner's, with the verdicts filed under their own subject", async () => {
    const f = await memberStarted();
    await startDigilocker({ db: f.db, applicationId: "app", subject: "partner", redirectUrl: "https://x.example/done" });
    expect(f.tables.partner_digilocker.map((r) => r.subject).sort()).toEqual(["member:r1", "partner"]);
    calls = [];
    const v = await refreshDigilocker({ ...input(f, { subject: "member:r1", typedName: "Priya Raman", docs: [memberSelfie] }) });
    expect(v.state).toBe("authenticated");
    expect(f.tables.partner_digilocker.find((r) => r.subject === "member:r1")).toMatchObject({ status: "authenticated", uid_last4: "5647" });
    expect(f.tables.partner_digilocker.find((r) => r.subject === "partner")).toMatchObject({ status: "pending" });
    expect(f.tables.partner_verifications.filter((r) => r.subject === "member:r1").map((r) => r.kind).sort()).toEqual(["digilocker", "face_match"]);
    expect(f.tables.partner_verifications.filter((r) => r.subject === "partner")).toHaveLength(0);
  });

  it("is told in their own words, not the partner's (they typed nothing and filled in no form)", async () => {
    const f = await memberStarted();
    const ok = await refreshDigilocker(input(f, { subject: "member:r1", docs: [memberSelfie] }));
    expect(ok.message).toBe("You are verified with DigiLocker, so you do not need to send a photo ID. Thank you.");
    expect(ok.message).not.toMatch(/filled in|you typed/i);

    const g = await memberStarted();
    answers["POST /name-match"] = { body: { score: 0.1, reason: "NO_MATCH" } };
    const diff = await refreshDigilocker(input(g, { subject: "member:r1", typedName: "Raja Kumar", docs: [memberSelfie] }));
    expect(diff.verdict).toBe("review");
    expect(diff.message).toContain("name given for you");
    expect(diff.message).not.toContain("you typed");
  });

  it("compares only their own selfie, never the partner's", async () => {
    const f = await memberStarted();
    // only the partner has a selfie: nothing to compare the member's DigiLocker photo with
    await refreshDigilocker(input(f, { subject: "member:r1", docs: [selfieDoc] }));
    expect(calls.some((c) => c.path === "/face-match")).toBe(false);
  });
});

describe("who no longer needs to send a photo ID", () => {
  const form = (partnerName: string, memberName = "Priya Raman"): OnboardingData => {
    const d = emptyOnboarding();
    d.person.name = partnerName;
    d.team.members = [{ id: "r1", name: memberName, role: "", siteRole: "", phone: "", email: "", certificate: "", validUntil: "", needsLicence: false, addedAt: "" } as never];
    return d;
  };
  const memberSelfie: DocRow = { ...selfieDoc, id: "ms1", subject: "member:r1", storage_path: "app/ms1-r.jpg" };
  async function verified() {
    const f = fakeDb();
    for (const subject of ["partner", "member:r1"]) {
      await startDigilocker({ db: f.db, applicationId: "app", subject, redirectUrl: "https://x.example/done" });
      await refreshDigilocker(input(f, { subject, typedName: "Priya Raman", docs: [subject === "partner" ? selfieDoc : memberSelfie] }));
    }
    return f;
  }

  it("covers the partner and a member whose DigiLocker check passed and whose name on the form is unchanged", async () => {
    const f = await verified();
    expect([...(await digilockerCoveredSubjects(f.db, "app", form("Priya Raman")))].sort()).toEqual(["member:r1", "partner"]);
  });

  it("stops covering someone once the name on the form is changed to another (verify as one person, then rename)", async () => {
    const f = await verified();
    expect([...(await digilockerCoveredSubjects(f.db, "app", form("Raja Kumar", "Priya Raman")))]).toEqual(["member:r1"]);
    expect([...(await digilockerCoveredSubjects(f.db, "app", form("Priya Raman", "Raja Kumar")))]).toEqual(["partner"]);
    // the same name in another order is still the same name
    expect((await digilockerCoveredSubjects(f.db, "app", form("RAMAN PRIYA"))).has("partner")).toBe(false);
  });

  it("covers nobody whose check needed a look (the name differed), nobody who declined, and nobody who never started", async () => {
    const f = fakeDb();
    await startDigilocker({ db: f.db, applicationId: "app", subject: "partner", redirectUrl: "https://x.example/done" });
    answers["POST /name-match"] = { body: { score: 0.1, reason: "NO_MATCH" } };
    await refreshDigilocker(input(f, { typedName: "Raja Kumar" }));
    expect((await digilockerCoveredSubjects(f.db, "app", form("Raja Kumar"))).size).toBe(0);

    const g = fakeDb();
    await startDigilocker({ db: g.db, applicationId: "app", subject: "partner", redirectUrl: "https://x.example/done" });
    answers["GET /digilocker"] = { body: { status: "CONSENT_DENIED" } };
    await refreshDigilocker(input(g));
    expect((await digilockerCoveredSubjects(g.db, "app", form("Priya Raman"))).size).toBe(0);
    expect((await digilockerCoveredSubjects(fakeDb().db, "app", form("Priya Raman"))).size).toBe(0);
  });

  it("covers someone who typed no name before verifying, once the form carries DigiLocker's own name", async () => {
    const f = fakeDb();
    await startDigilocker({ db: f.db, applicationId: "app", subject: "partner", redirectUrl: "https://x.example/done" });
    await refreshDigilocker(input(f, { typedName: "" }));
    expect((await digilockerCoveredSubjects(f.db, "app", form("Priya Raman"))).has("partner")).toBe(true);
    expect((await digilockerCoveredSubjects(f.db, "app", form(""))).has("partner")).toBe(false);
  });
});
