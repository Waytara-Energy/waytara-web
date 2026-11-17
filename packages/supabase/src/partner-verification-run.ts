import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isAccountNumber, isGstin, isIfsc, isPan, isUdyam, memberKey, type OnboardingData } from "./partner-onboarding";
import { CashfreeError, cashfreeConfigured, checkLiveness, compareFaces, compareNames, verifyBank, verifyGstin, verifyPan, verifyUdyam } from "./partner-cashfree";
import {
  PARTNER_CHECK_LIMIT,
  PARTNER_KINDS,
  VERIFICATION_KINDS,
  bankVerdict,
  errorVerdict,
  faceMatchVerdict,
  gstinVerdict,
  livenessVerdict,
  nameMatchVerdict,
  panVerdict,
  udyamVerdict,
  type Verdict,
  type VerificationKind,
  type VerificationStatus,
} from "./partner-verify-rules";

// Runs the automatic checks for one partner and keeps the latest result of each. Used by both apps (the website when the partner asks for a check or sends their onboarding,
// the admin app when someone runs one again), so what is asked, how often and what is stored cannot differ. The caller gives the database client (its own rights apply)
// and a way to read a stored file; this reads what the partner saved, asks Cashfree, applies the rules and writes the result.
//
// A check is not asked twice for the same inputs (it costs money): if what it was asked about has not changed, the stored result stands, unless the admin forces it or it
// could not be answered last time. A PARTNER may ask for each of their own checks only a few times, so the check cannot be used to look up other people's numbers.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

export interface DocRow {
  id: string;
  kind: string;
  subject: string;
  file_name: string;
  storage_path: string;
  uploaded_at: string;
}

export type Actor = { by: "partner" } | { by: "system" } | { by: "admin"; userId: string };

export interface RunInput {
  db: Db;
  applicationId: string;
  partnerType: string | null;
  data: OnboardingData;
  docs: readonly DocRow[];
  /** Reads a stored file (by its path in the bucket), or null when it cannot be read. */
  download: (path: string) => Promise<Buffer | null>;
  actor: Actor;
  /** Ask again even if nothing changed (an admin pressing "Run again"). */
  force?: boolean;
  /** Which checks; all of them by default. A partner's are cut down to the ones they may ask for. */
  kinds?: readonly VerificationKind[];
  /** Whose faces: "partner" and "member:<id>". All by default. */
  subjects?: readonly string[];
}

export interface CheckResult {
  kind: VerificationKind;
  subject: string;
  status: VerificationStatus;
  code: string;
  summary: string;
  detail: Record<string, unknown>;
  /** Whether Cashfree was asked just now. */
  ran: boolean;
  /** Why it was not asked: the stored result stands ("unchanged"), the partner has used their asks ("limit"), or the details are not there yet ("missing"). */
  skipped?: "unchanged" | "limit" | "missing";
}

interface Row {
  subject: string;
  kind: string;
  status: VerificationStatus;
  summary: string;
  detail: Record<string, unknown>;
  input_hash: string;
  partner_attempts: number;
}

const sha = (v: unknown): string => createHash("sha256").update(JSON.stringify(v)).digest("hex");

/**
 * A PAN or bank answer should carry Cashfree's own name match. When it does not (the sandbox leaves it out, and an account without the name-match feature may get none), ask
 * Cashfree's Name Match service to compare the name given with the name it found, and put that answer in. The match always stays Cashfree's, never ours. If that call fails too, the
 * answer is returned as it was and the rules call it "needs a look".
 */
async function withNameMatch<T extends { name_match_result?: string | null; name_match_score?: string | number | null; name_match_via?: "name_match" | null }>(a: T, given: string | undefined, found: string | null | undefined): Promise<T> {
  if (a.name_match_result || !given?.trim() || !found?.trim()) return a;
  try {
    const n = await compareNames(given, found);
    if (!n.reason) return a;
    return { ...a, name_match_result: n.reason, name_match_score: n.score ?? null, name_match_via: "name_match" };
  } catch {
    return a;
  }
}

/** The name a PAN is checked against: the person's own for someone working alone, a proprietor or an individual, the business's for a firm or company. */
export function panNameFor(partnerType: string | null, data: OnboardingData): string {
  const person = partnerType === "technician" || partnerType === "survey" || !["partnership", "llp", "company"].includes(data.business.kind);
  return (person ? data.person.name : data.business.name).trim();
}

/**
 * What a PAN, GST or bank check was (or would be) asked about, as a fingerprint: the same number means the same question, so the stored answer still stands. Null when the
 * details are not all there yet. The page uses it to tell a partner whether the result they see is for what is saved now.
 */
export function checkInputHash(kind: "pan" | "gstin" | "udyam" | "bank", partnerType: string | null, data: OnboardingData): string | null {
  if (kind === "udyam") return isUdyam(data.business.udyam) ? sha({ udyam: data.business.udyam, name: data.business.name }) : null;
  if (kind === "pan") return isPan(data.business.pan) ? sha({ pan: data.business.pan, name: panNameFor(partnerType, data) }) : null;
  if (kind === "gstin") return isGstin(data.business.gstin) ? sha({ gstin: data.business.gstin, pan: data.business.pan, name: data.business.name }) : null;
  const b = data.bank;
  return isAccountNumber(b.accountNumber) && isIfsc(b.ifsc) && b.holder.trim() ? sha({ account: b.accountNumber, ifsc: b.ifsc, holder: b.holder }) : null;
}

const IMAGE_TYPES: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png" };
/** A file Cashfree's face services take: a JPEG or PNG, at most 5 MB. */
const imageType = (name: string): string | null => IMAGE_TYPES[name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? ""] ?? null;
const FIVE_MB = 5 * 1024 * 1024;

const newest = (docs: readonly DocRow[], subject: string, kind: string, onlyImages = false): DocRow | null =>
  docs
    .filter((d) => d.subject === subject && d.kind === kind && (!onlyImages || imageType(d.file_name)))
    .sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at))[0] ?? null;

export async function runChecks(input: RunInput): Promise<CheckResult[]> {
  const { db, applicationId, data, docs, actor } = input;
  const asked = (input.kinds ?? VERIFICATION_KINDS).filter((k) => (actor.by === "partner" ? PARTNER_KINDS.includes(k) : true));
  const order = VERIFICATION_KINDS.filter((k) => asked.includes(k));
  const members = data.team.members.map((m, i) => `member:${memberKey(m, i)}`);
  const subjectsAll = ["partner", ...members];
  const subjects = input.subjects ? subjectsAll.filter((s) => input.subjects!.includes(s)) : subjectsAll;

  const { data: stored } = await db.from("partner_verifications").select("subject, kind, status, summary, detail, input_hash, partner_attempts").eq("application_id", applicationId);
  const rows = new Map<string, Row>(((stored ?? []) as Row[]).map((r) => [`${r.subject}|${r.kind}`, r]));
  const results: CheckResult[] = [];
  const keyOf = (subject: string, kind: string) => `${subject}|${kind}`;

  /** One check: skip it if it is not ready, unchanged or used up; otherwise ask, apply the rules, keep the result. */
  async function one(kind: VerificationKind, subject: string, prepared: { why: string } | { hash: string; ask: () => Promise<Verdict & { ref?: string }> }) {
    const existing = rows.get(keyOf(subject, kind));
    const asStored = (skipped: CheckResult["skipped"]): CheckResult | null =>
      existing ? { kind, subject, status: existing.status, code: String((existing.detail as { code?: unknown })?.code ?? ""), summary: existing.summary, detail: existing.detail, ran: false, skipped } : null;
    if ("why" in prepared) {
      results.push(asStored("missing") ?? { kind, subject, ...errorVerdict("input", prepared.why), ran: false, skipped: "missing" });
      return;
    }
    if (existing && existing.input_hash === prepared.hash && existing.status !== "error" && !input.force) {
      results.push(asStored("unchanged")!);
      return;
    }
    if (actor.by === "partner" && existing && existing.partner_attempts >= PARTNER_CHECK_LIMIT) {
      results.push(asStored("limit")!);
      return;
    }
    if (!cashfreeConfigured()) {
      results.push({ kind, subject, ...errorVerdict("config"), ran: false });
      return;
    }
    let verdict: Verdict & { ref?: string };
    try {
      verdict = await prepared.ask();
    } catch (e) {
      verdict = e instanceof CashfreeError ? errorVerdict(e.kind, e.message) : errorVerdict("other");
      if (e instanceof CashfreeError && e.kind === "config") {
        results.push({ kind, subject, ...verdict, ran: false });
        return;
      }
    }
    // The service could not answer: an answer we already hold for these same details is better evidence than "could not check", so it stays. (For other details the
    // old answer is about something else, and the failure is what is stored.)
    if (verdict.status === "error" && existing && existing.input_hash === prepared.hash && existing.status !== "error") {
      results.push({ kind, subject, status: verdict.status, code: verdict.code, summary: verdict.summary, detail: {}, ran: true });
      return;
    }
    // an asking only counts against the partner when the service answered
    const attempts = (existing?.partner_attempts ?? 0) + (actor.by === "partner" && verdict.status !== "error" ? 1 : 0);
    const row = {
      application_id: applicationId,
      subject,
      kind,
      status: verdict.status,
      summary: verdict.summary.slice(0, 400),
      detail: { ...verdict.detail, code: verdict.code },
      provider: "cashfree",
      provider_ref: verdict.ref ? String(verdict.ref).slice(0, 80) : null,
      input_hash: prepared.hash,
      partner_attempts: attempts,
      run_by: actor.by === "admin" ? actor.userId : null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await db.from("partner_verifications").upsert(row, { onConflict: "application_id,subject,kind" });
    if (error) console.error("partner_verifications upsert error:", error.message);
    rows.set(keyOf(subject, kind), { subject, kind, status: row.status as VerificationStatus, summary: row.summary, detail: row.detail, input_hash: row.input_hash, partner_attempts: attempts });
    results.push({ kind, subject, status: verdict.status, code: verdict.code, summary: verdict.summary, detail: row.detail, ran: true });
  }

  const ref = (a: { reference_id?: number | string; ref_id?: number | string }) => (a.reference_id ?? a.ref_id)?.toString();

  for (const kind of order) {
    if (kind === "pan") {
      const pan = data.business.pan;
      const name = panNameFor(input.partnerType, data);
      if (!isPan(pan)) await one("pan", "partner", { why: "Enter your PAN first." });
      else
        await one("pan", "partner", {
          hash: checkInputHash("pan", input.partnerType, data)!,
          ask: async () => {
            const got = await verifyPan({ pan, name: name || undefined });
            const a = got.valid === true ? await withNameMatch(got, name, got.registered_name) : got;
            return { ...panVerdict(a), ref: ref(a) };
          },
        });
    } else if (kind === "gstin") {
      const gstin = data.business.gstin;
      if (!isGstin(gstin)) await one("gstin", "partner", { why: "Enter your GST number first." });
      else
        await one("gstin", "partner", {
          hash: checkInputHash("gstin", input.partnerType, data)!,
          ask: async () => {
            const a = await verifyGstin({ gstin });
            return { ...gstinVerdict(a, { gstin, pan: isPan(data.business.pan) ? data.business.pan : undefined, businessName: data.business.name || undefined }), ref: ref(a) };
          },
        });
    } else if (kind === "udyam") {
      const udyam = data.business.udyam;
      if (!isUdyam(udyam)) await one("udyam", "partner", { why: "Enter your Udyam number first, like UDYAM-TN-02-0048192." });
      else
        await one("udyam", "partner", {
          hash: checkInputHash("udyam", input.partnerType, data)!,
          ask: async () => {
            const a = await verifyUdyam({ udyam });
            return { ...udyamVerdict(a, { businessName: data.business.name || undefined }), ref: ref(a) };
          },
        });
    } else if (kind === "bank") {
      const b = data.bank;
      if (!isAccountNumber(b.accountNumber) || !isIfsc(b.ifsc) || !b.holder.trim()) await one("bank", "partner", { why: "Fill in the account number, the IFSC and the name on the account first." });
      else
        await one("bank", "partner", {
          hash: checkInputHash("bank", input.partnerType, data)!,
          ask: async () => {
            const got = await verifyBank({ account: b.accountNumber, ifsc: b.ifsc, name: b.holder });
            const a = got.account_status === "VALID" ? await withNameMatch(got, b.holder, got.name_at_bank) : got;
            return { ...bankVerdict(a, { holder: b.holder }), ref: ref(a) };
          },
        });
    } else if (kind === "name_match") {
      const panName = rows.get(keyOf("partner", "pan"))?.detail?.registered_name;
      const bankName = rows.get(keyOf("partner", "bank"))?.detail?.name_at_bank;
      if (typeof panName !== "string" || typeof bankName !== "string" || !panName || !bankName) await one("name_match", "partner", { why: "The PAN and the bank account must both be checked first." });
      else
        await one("name_match", "partner", {
          hash: sha({ panName, bankName }),
          ask: async () => {
            const a = await compareNames(panName, bankName);
            return { ...nameMatchVerdict({ reason: a.reason ?? (a as { reason?: string }).reason, score: a.score }, { pan: panName, bank: bankName }), ref: ref(a) };
          },
        });
    } else if (kind === "face_match") {
      for (const subject of subjects) {
        const selfie = newest(docs, subject, "selfie");
        const id = newest(docs, subject, "identity", true);
        const anyId = newest(docs, subject, "identity");
        if (!selfie) await one("face_match", subject, { why: "A selfie is needed first." });
        else if (!anyId) await one("face_match", subject, { why: "A photo ID is needed first." });
        else {
          const hash = sha({ selfie: selfie.id, id: (id ?? anyId).id });
          if (!id) await one("face_match", subject, { hash, ask: async () => ({ status: "review", code: "pdf", summary: "The photo ID is not a JPEG or PNG picture (it may be a PDF), so the face could not be compared. Compare them by eye.", detail: {} }) });
          else await one("face_match", subject, { hash, ask: () => faceCheck(input.download, selfie, id) });
        }
      }
    } else if (kind === "face_liveness") {
      for (const subject of subjects) {
        const selfie = newest(docs, subject, "selfie");
        if (!selfie) await one("face_liveness", subject, { why: "A selfie is needed first." });
        else if (!imageType(selfie.file_name)) await one("face_liveness", subject, { hash: sha({ selfie: selfie.id }), ask: async () => ({ status: "review", code: "format", summary: "The selfie is not a JPEG or PNG picture, so it could not be checked. Ask for a new one.", detail: {} }) });
        else
          await one("face_liveness", subject, {
            hash: sha({ selfie: selfie.id }),
            ask: async () => {
              const bytes = await input.download(selfie.storage_path);
              if (!bytes) return errorVerdict("other");
              if (bytes.length > FIVE_MB) return { status: "review" as const, code: "large", summary: "The selfie is over 5 MB, so it could not be checked. Ask for a smaller one.", detail: {} };
              const a = await checkLiveness({ bytes, name: selfie.file_name, type: imageType(selfie.file_name)! });
              return { ...livenessVerdict(a), ref: ref(a) };
            },
          });
      }
    }
  }
  return results;
}

/** Downloads the selfie and the ID and asks whether the faces are the same. Too large a file is a question for a person, not an error. */
async function faceCheck(download: RunInput["download"], selfie: DocRow, id: DocRow): Promise<Verdict & { ref?: string }> {
  const [a, b] = await Promise.all([download(selfie.storage_path), download(id.storage_path)]);
  if (!a || !b) return errorVerdict("other");
  if (a.length > FIVE_MB || b.length > FIVE_MB) return { status: "review", code: "large", summary: "A photo is over 5 MB, so the faces could not be compared. Compare them by eye.", detail: {} };
  const answer = await compareFaces({ bytes: a, name: selfie.file_name, type: imageType(selfie.file_name)! }, { bytes: b, name: id.file_name, type: imageType(id.file_name)! });
  return { ...faceMatchVerdict(answer), ref: (answer.ref_id ?? answer.reference_id)?.toString() };
}

/** The stored results of an application, newest first, keyed "subject|kind". */
export async function loadResults(db: Db, applicationId: string): Promise<Record<string, { status: VerificationStatus; summary: string; code: string; partner_attempts: number; updated_at: string; input_hash: string; detail: Record<string, unknown> }>> {
  const { data } = await db.from("partner_verifications").select("subject, kind, status, summary, detail, partner_attempts, updated_at, input_hash").eq("application_id", applicationId);
  const out: Record<string, { status: VerificationStatus; summary: string; code: string; partner_attempts: number; updated_at: string; input_hash: string; detail: Record<string, unknown> }> = {};
  for (const r of (data ?? []) as { subject: string; kind: string; status: VerificationStatus; summary: string; detail: Record<string, unknown>; partner_attempts: number; updated_at: string; input_hash: string }[]) {
    out[`${r.subject}|${r.kind}`] = { status: r.status, summary: r.summary, code: String((r.detail as { code?: unknown })?.code ?? ""), partner_attempts: r.partner_attempts, updated_at: r.updated_at, input_hash: r.input_hash, detail: r.detail };
  }
  return out;
}
