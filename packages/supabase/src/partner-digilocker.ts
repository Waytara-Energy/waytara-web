import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CashfreeError, cashfreeConfigured, compareFaces, compareNames, createDigilockerUrl, digilockerAadhaar, digilockerStatus, newVerificationId } from "./partner-cashfree";
import { imageType, newest, type DocRow } from "./partner-verification-run";
import { digilockerIdentity, digilockerVerdict, errorVerdict, faceMatchVerdict, partnerMessage, type DigilockerIdentity, type Verdict, type VerificationKind, type VerificationStatus } from "./partner-verify-rules";

// Identity through DigiLocker (Cashfree Secure ID): the person opens a link, agrees on DigiLocker's own page, and we receive what DigiLocker states about them. Used by both
// apps. What is kept is deliberately small: the stated name, date of birth, gender and address, the last four digits of the Aadhaar number, and the verdicts. The full number
// is never stored (Cashfree sends it masked anyway) and the portrait is used once, to compare with the selfie, and then dropped. Nothing here is logged.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

export type DigilockerState = "none" | "pending" | "authenticated" | "expired" | "consent_denied" | "failed";

/** What the PERSON is shown: where it stands, a plain line, and (once they have agreed) their own details, which they may use to fill in the form. */
export interface DigilockerView {
  state: DigilockerState;
  message: string;
  identity?: { name: string; dob: string; gender: string; address: string; pin: string; uid_last4: string };
  /** Whether the verdict on the identity was good; only set once they have agreed. */
  verdict?: VerificationStatus;
}

const sha = (v: unknown): string => createHash("sha256").update(JSON.stringify(v)).digest("hex");
const FIVE_MB = 5 * 1024 * 1024;

const WORDS: Record<Exclude<DigilockerState, "none" | "authenticated">, string> = {
  pending: "Waiting for you to finish on the DigiLocker page. You can come back to this page when you are done.",
  expired: "The DigiLocker link ran out of time. Please start again.",
  consent_denied: "You chose not to share your details on DigiLocker. If that was a mistake you can try again, or fill the details in yourself and send your documents instead.",
  failed: "DigiLocker could not give us your details. Please try again, or fill the details in yourself and send your documents instead.",
};

/** What a team member is told: they did not type the name or fill in a form, and they are not the one who applied. */
function memberMessage(verdict: VerificationStatus, code: string): string {
  if (verdict === "passed") return "You are verified with DigiLocker. Thank you.";
  if (code === "name_differs" || code === "name_missing") return "You are verified with DigiLocker, but the name on it is not a close match to the name given for you. Our team will look at it.";
  if (code === "under_age") return "DigiLocker shows a date of birth that makes you under 18. Please contact the person who listed you, or us.";
  return "We could not verify you with DigiLocker. Please try again, or add your documents below instead.";
}

interface Session {
  id: string;
  verification_id: string;
  status: string;
  identity: Record<string, unknown> | null;
  uid_last4: string | null;
}

/** An image's type from its first bytes (JPEG or PNG), or null: Cashfree's face service takes only those. */
function sniff(bytes: Buffer): { type: string; name: string } | null {
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { type: "image/jpeg", name: "digilocker.jpg" };
  if (bytes.length > 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return { type: "image/png", name: "digilocker.png" };
  return null;
}

/** DigiLocker's portrait as bytes: base64 (possibly with a data: prefix) or, if it is a link, fetched. Null when there is none we can read. */
async function portraitBytes(raw: string | null | undefined): Promise<Buffer | null> {
  const s = (raw ?? "").trim();
  if (!s) return null;
  try {
    if (/^https:\/\//i.test(s)) {
      const res = await fetch(s, { signal: AbortSignal.timeout(15_000) });
      return res.ok ? Buffer.from(await res.arrayBuffer()) : null;
    }
    return Buffer.from(s.replace(/^data:[^,]*,/, ""), "base64");
  } catch {
    return null;
  }
}

async function saveCheck(db: Db, applicationId: string, subject: string, kind: VerificationKind, v: Verdict, hash: string, extra: Record<string, unknown> = {}): Promise<void> {
  const { error } = await db.from("partner_verifications").upsert(
    {
      application_id: applicationId,
      subject,
      kind,
      status: v.status,
      summary: v.summary.slice(0, 400),
      detail: { ...v.detail, ...extra, code: v.code },
      provider: "cashfree",
      input_hash: hash,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "application_id,subject,kind" },
  );
  if (error) console.error("partner_verifications upsert error:", error.message);
}

/**
 * Starts a DigiLocker session for a person and returns the link they open (it works for ten minutes). A new session replaces the old one. `redirectUrl` must be https.
 */
export async function startDigilocker(input: { db: Db; applicationId: string; subject: string; redirectUrl: string }): Promise<{ url: string }> {
  if (!cashfreeConfigured()) throw new CashfreeError("config", "Automatic checks are not set up on this server.");
  const verificationId = newVerificationId();
  const a = await createDigilockerUrl({ verificationId, redirectUrl: input.redirectUrl });
  if (!a.url) throw new CashfreeError("upstream", "DigiLocker did not give a link.");
  const now = new Date();
  const { error } = await input.db.from("partner_digilocker").upsert(
    {
      application_id: input.applicationId,
      subject: input.subject,
      verification_id: verificationId,
      reference_id: a.reference_id != null ? String(a.reference_id).slice(0, 40) : null,
      status: "pending",
      identity: {},
      uid_last4: null,
      created_at: now.toISOString(),
      expires_at: new Date(now.getTime() + 10 * 60_000).toISOString(),
      completed_at: null,
    },
    { onConflict: "application_id,subject" },
  );
  if (error) throw new Error(`partner_digilocker upsert: ${error.message}`);
  return { url: a.url };
}

async function viewOf(db: Db, applicationId: string, subject: string): Promise<DigilockerView> {
  const { data } = await db.from("partner_digilocker").select("id, verification_id, status, identity, uid_last4").eq("application_id", applicationId).eq("subject", subject).maybeSingle();
  const row = data as Session | null;
  if (!row) return { state: "none", message: "" };
  if (row.status !== "authenticated") {
    const state = (row.status in WORDS ? row.status : "failed") as keyof typeof WORDS;
    return { state, message: WORDS[state] };
  }
  const { data: v } = await db.from("partner_verifications").select("status, detail").eq("application_id", applicationId).eq("subject", subject).eq("kind", "digilocker").maybeSingle();
  const verdict = (v?.status ?? "review") as VerificationStatus;
  const code = String((v?.detail as { code?: unknown } | undefined)?.code ?? "");
  const i = (row.identity ?? {}) as Partial<DigilockerIdentity>;
  return {
    state: "authenticated",
    message: subject === "partner" ? partnerMessage("digilocker", { status: verdict, code }) : memberMessage(verdict, code),
    verdict,
    identity: { name: i.name ?? "", dob: i.dob ?? "", gender: i.gender ?? "", address: i.address ?? "", pin: i.pin ?? "", uid_last4: row.uid_last4 ?? "" },
  };
}

/**
 * Where the person's DigiLocker session stands. While it is pending this asks Cashfree; once they have agreed it reads what DigiLocker states, keeps the small identity, compares
 * the typed name (Cashfree's Name Match) and the selfie with DigiLocker's portrait (Cashfree's Face Match), records the verdicts, and drops the portrait. Safe to call from
 * several places at once: only one of them completes the session.
 */
export async function refreshDigilocker(input: {
  db: Db;
  applicationId: string;
  subject: string;
  /** The name they typed as their own, to compare with DigiLocker's. */
  typedName?: string;
  docs: readonly DocRow[];
  download: (path: string) => Promise<Buffer | null>;
}): Promise<DigilockerView> {
  const { db, applicationId, subject } = input;
  const { data } = await db.from("partner_digilocker").select("id, verification_id, status, identity, uid_last4").eq("application_id", applicationId).eq("subject", subject).maybeSingle();
  const row = data as Session | null;
  if (!row || row.status !== "pending") return viewOf(db, applicationId, subject);

  const mark = async (status: "expired" | "consent_denied" | "failed") => {
    await db.from("partner_digilocker").update({ status, completed_at: new Date().toISOString() }).eq("id", row.id).eq("status", "pending");
    return viewOf(db, applicationId, subject);
  };

  let st;
  try {
    st = await digilockerStatus(row.verification_id);
  } catch (e) {
    // the service is out of reach just now: nothing is decided, they are still waiting
    if (e instanceof CashfreeError && e.kind === "config") throw e;
    return { state: "pending", message: WORDS.pending };
  }
  if (st.status === "EXPIRED") return mark("expired");
  if (st.status === "CONSENT_DENIED") return mark("consent_denied");
  if (st.status !== "AUTHENTICATED") return { state: "pending", message: WORDS.pending };
  if (st.user_details?.eaadhaar === "N") return mark("failed");

  let doc;
  try {
    doc = await digilockerAadhaar(row.verification_id);
  } catch (e) {
    if (e instanceof CashfreeError && e.kind === "input" && ["url_expired", "session_expired"].includes(e.code ?? "")) return mark("expired");
    if (e instanceof CashfreeError && e.kind === "input" && e.code === "consent_not_granted") return mark("consent_denied");
    if (e instanceof CashfreeError && (e.kind === "upstream" || e.kind === "rate")) return { state: "pending", message: WORDS.pending };
    return mark("failed");
  }
  if (doc.code === "validation_pending") return { state: "pending", message: WORDS.pending };
  const identity = doc.status === "SUCCESS" ? digilockerIdentity(doc) : null;
  if (!identity) return mark("failed");

  // only one caller completes the session
  const { data: claimed } = await db
    .from("partner_digilocker")
    .update({ status: "authenticated", identity, uid_last4: identity.uid_last4 || null, completed_at: new Date().toISOString() })
    .eq("id", row.id)
    .eq("status", "pending")
    .select("id");
  if (!claimed || claimed.length === 0) return viewOf(db, applicationId, subject);

  // the typed name against the stated name: Cashfree's Name Match decides
  let nameMatch: { result?: string | null; score?: number | null } | null = null;
  if (input.typedName?.trim()) {
    try {
      const n = await compareNames(input.typedName, identity.name);
      nameMatch = { result: n.reason ?? null, score: n.score ?? null };
    } catch {
      nameMatch = null;
    }
  }
  await saveCheck(db, applicationId, subject, "digilocker", digilockerVerdict(identity, { typedName: input.typedName, nameMatch }), sha({ digilocker: row.verification_id }));

  // the selfie against DigiLocker's own portrait; the portrait is dropped as soon as this is done
  let portrait = await portraitBytes(doc.photo_link);
  const selfie = newest(input.docs, subject, "selfie", true);
  const shape = portrait ? sniff(portrait) : null;
  if (selfie && portrait && shape && portrait.length <= FIVE_MB) {
    try {
      const selfieBytes = await input.download(selfie.storage_path);
      const selfieType = imageType(selfie.file_name);
      if (selfieBytes && selfieType && selfieBytes.length <= FIVE_MB) {
        const a = await compareFaces({ bytes: selfieBytes, name: selfie.file_name, type: selfieType }, { bytes: portrait, name: shape.name, type: shape.type });
        const v = faceMatchVerdict(a, "DigiLocker photo");
        await saveCheck(db, applicationId, subject, "face_match", v, sha({ selfie: selfie.id, digilocker: row.verification_id }), { source: "digilocker", selfie_id: selfie.id });
      }
    } catch (e) {
      // the face service could not answer: nothing is decided, and the usual selfie-against-ID check can still run
      const v = e instanceof CashfreeError ? errorVerdict(e.kind, e.message) : errorVerdict("other");
      if (v.status === "error") console.error("DigiLocker face match not answered:", v.code);
    }
  }
  portrait = null;

  return viewOf(db, applicationId, subject);
}

/** Reads the stored view without asking anyone (for showing the page). */
export const digilockerView = (db: Db, applicationId: string, subject: string): Promise<DigilockerView> => viewOf(db, applicationId, subject);
