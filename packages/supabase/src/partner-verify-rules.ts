// What the automatic checks (Cashfree Secure ID) find out about a partner and how each answer is read: passed, needs a person's look, or failed. Pure (no network, no
// database, no framework): the servers of both apps ask the service (see partner-cashfree.ts) and hand its answers here, so the rules are tested and the two apps agree.
//
// The checks are an aid to the admin, never the decision: a passed check is evidence the admin accepts with one click, a "review" is a question for a person, and
// nothing here approves anyone.

export const VERIFICATION_KINDS = ["pan", "gstin", "bank", "name_match", "face_match", "face_liveness"] as const;
export type VerificationKind = (typeof VERIFICATION_KINDS)[number];
export type VerificationStatus = "passed" | "review" | "failed" | "error";

export const isVerificationKind = (v: unknown): v is VerificationKind => (VERIFICATION_KINDS as readonly string[]).includes(v as string);

export const KIND_LABEL: Record<VerificationKind, string> = {
  pan: "PAN",
  gstin: "GST registration",
  bank: "Bank account",
  name_match: "PAN name against the bank account name",
  face_match: "Selfie against the photo ID",
  face_liveness: "Selfie is a live face",
};

export const STATUS_LABEL: Record<VerificationStatus, string> = { passed: "Passed", review: "Needs a look", failed: "Failed", error: "Could not check" };

/** The partner's own check (PAN, GST, bank) may be asked for this many times by the partner: it cannot be used to look up other people's numbers. */
export const PARTNER_CHECK_LIMIT = 3;
/** The checks a partner can ask for themselves, before they send. The others (faces, the cross-check) the team and the system run. */
export const PARTNER_KINDS: readonly VerificationKind[] = ["pan", "gstin", "bank"];

/** What a check found. `code` is a short reason for the page's own wording; `summary` is the admin's line; `detail` is the service's answer with the sensitive parts left out. */
export interface Verdict {
  status: VerificationStatus;
  code: string;
  summary: string;
  detail: Record<string, unknown>;
}

// ---- names ----

const BUSINESS_WORDS = new Set(["PVT", "PRIVATE", "LTD", "LIMITED", "LLP", "CO", "COMPANY", "MS", "M", "S", "AND", "THE", "OF"]);

/** Capitals, letters and digits only, one space between words. */
export const normaliseName = (s: string): string =>
  s
    .toUpperCase()
    .replace(/&/g, " AND ")
    .replace(/[^A-Z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const tokens = (s: string): string[] => normaliseName(s).split(" ").filter((t) => t && !BUSINESS_WORDS.has(t));

/**
 * How alike two names are, 0 to 1: the share of words they have in common, where a single letter stands for a name that starts with it ("R KUMAR" and "RAVI KUMAR") and
 * the order does not matter. Company words (PVT, LTD, LLP...) are left out. Used where the service gives no match of its own (a business name against the GST names).
 */
export function nameSimilarity(a: string, b: string): number {
  const x = tokens(a);
  const y = tokens(b);
  if (x.length === 0 || y.length === 0) return 0;
  const pool = [...y];
  let hits = 0;
  for (const t of x) {
    const at = pool.findIndex((u) => u === t || (t.length === 1 && u.startsWith(t)) || (u.length === 1 && t.startsWith(u)));
    if (at >= 0) {
      hits += 1;
      pool.splice(at, 1);
    }
  }
  return hits / Math.max(x.length, y.length);
}

// ---- the service's own name-match words ----

export type MatchResult = "DIRECT_MATCH" | "GOOD_PARTIAL_MATCH" | "MODERATE_PARTIAL_MATCH" | "POOR_PARTIAL_MATCH" | "NO_MATCH" | string;

const MATCH_WORDS: Record<string, string> = {
  DIRECT_MATCH: "an exact match",
  GOOD_PARTIAL_MATCH: "a good partial match",
  MODERATE_PARTIAL_MATCH: "a moderate partial match",
  POOR_PARTIAL_MATCH: "a poor partial match",
  NO_MATCH: "no match",
};
const matchWords = (r: unknown): string => (typeof r === "string" ? (MATCH_WORDS[r] ?? r.toLowerCase().replace(/_/g, " ")) : "not compared");
/** Direct and good matches pass; moderate and poor need a look; no match, or none given, is decided by the caller. */
const strongMatch = (r: unknown) => r === "DIRECT_MATCH" || r === "GOOD_PARTIAL_MATCH";
const weakMatch = (r: unknown) => r === "MODERATE_PARTIAL_MATCH" || r === "POOR_PARTIAL_MATCH";
const pct = (n: unknown): string => {
  const v = typeof n === "string" ? Number(n) : typeof n === "number" ? n : NaN;
  return Number.isFinite(v) ? `${Math.round(v <= 1 ? v * 100 : v)}%` : "no score";
};

// ---- PAN ----

export interface PanAnswer {
  /** Cashfree's reference for the call (kept so a question to Cashfree can quote it). */
  reference_id?: number | string;
  valid?: boolean;
  pan?: string;
  type?: string;
  registered_name?: string | null;
  name_provided?: string | null;
  name_match_result?: MatchResult | null;
  name_match_score?: string | number | null;
  pan_status?: string | null;
  aadhaar_seeding_status?: string | null;
  message?: string;
}

export function panVerdict(a: PanAnswer): Verdict {
  const detail = { type: a.type ?? null, registered_name: a.registered_name ?? null, name_provided: a.name_provided ?? null, name_match_result: a.name_match_result ?? null, name_match_score: a.name_match_score ?? null, pan_status: a.pan_status ?? null, aadhaar_seeding_status: a.aadhaar_seeding_status ?? null };
  if (a.valid !== true) return { status: "failed", code: "invalid", summary: "The Income Tax Department has no valid PAN with this number.", detail };
  if (a.pan_status && a.pan_status !== "VALID") return { status: "failed", code: "inactive", summary: `The PAN exists but its status is ${a.pan_status.toLowerCase()}.`, detail };
  const unlinked = a.aadhaar_seeding_status === "R" ? " It is not linked to Aadhaar, so it may be inoperative and tax may be deducted at a higher rate." : "";
  const r = a.name_match_result;
  if (strongMatch(r)) return { status: unlinked ? "review" : "passed", code: unlinked ? "unlinked" : "ok", summary: `PAN is valid and the name matches (${matchWords(r)}, ${pct(a.name_match_score)}). Registered as ${a.registered_name ?? "unknown"}.${unlinked}`, detail };
  if (weakMatch(r)) return { status: "review", code: "name_partial", summary: `PAN is valid, but the name is only ${matchWords(r)} (${pct(a.name_match_score)}). Registered as ${a.registered_name ?? "unknown"}; given ${a.name_provided ?? "none"}.${unlinked}`, detail };
  if (r === "NO_MATCH") return { status: "failed", code: "name_mismatch", summary: `PAN is valid but registered to a different name: ${a.registered_name ?? "unknown"}; given ${a.name_provided ?? "none"}.`, detail };
  return { status: "review", code: "name_missing", summary: `PAN is valid. No name was compared. Registered as ${a.registered_name ?? "unknown"}.${unlinked}`, detail };
}

// ---- GST ----

export interface GstinAnswer {
  /** Cashfree's reference for the call (kept so a question to Cashfree can quote it). */
  reference_id?: number | string;
  valid?: boolean;
  message?: string;
  GSTIN?: string;
  legal_name_of_business?: string | null;
  trade_name_of_business?: string | null;
  gst_in_status?: string | null;
  constitution_of_business?: string | null;
  taxpayer_type?: string | null;
  date_of_registration?: string | null;
  principal_place_address?: string | null;
  nature_of_business_activities?: string[] | null;
}

/** The PAN a GSTIN is built on: characters 3 to 12. */
export const panInGstin = (gstin: string): string => gstin.slice(2, 12);

export function gstinVerdict(a: GstinAnswer, ctx: { gstin: string; pan?: string; businessName?: string }): Verdict {
  const detail = { legal_name: a.legal_name_of_business ?? null, trade_name: a.trade_name_of_business ?? null, status: a.gst_in_status ?? null, constitution: a.constitution_of_business ?? null, taxpayer_type: a.taxpayer_type ?? null, registered_on: a.date_of_registration ?? null, address: a.principal_place_address ?? null, activities: a.nature_of_business_activities ?? null };
  if (a.valid !== true) return { status: "failed", code: "not_found", summary: "No GST registration was found for this number.", detail };
  if (a.gst_in_status && a.gst_in_status.toLowerCase() !== "active") return { status: "failed", code: "inactive", summary: `The GST registration exists but is ${a.gst_in_status.toLowerCase()}.`, detail };
  if (ctx.pan && panInGstin(ctx.gstin) !== ctx.pan) return { status: "failed", code: "pan_mismatch", summary: `The GST number is built on PAN ${panInGstin(ctx.gstin)}, not the PAN given (${ctx.pan}).`, detail };
  const legal = a.legal_name_of_business ?? "";
  const trade = a.trade_name_of_business ?? "";
  if (ctx.businessName) {
    const best = Math.max(nameSimilarity(ctx.businessName, legal), nameSimilarity(ctx.businessName, trade));
    if (best < 0.5) return { status: "review", code: "name_differs", summary: `Active GST registration, but the business name given (${ctx.businessName}) differs from the registered names: ${legal || "none"}${trade && trade !== legal ? `, trading as ${trade}` : ""}.`, detail };
  }
  return { status: "passed", code: "ok", summary: `Active GST registration: ${legal || trade || "name not shown"}${trade && trade !== legal ? `, trading as ${trade}` : ""}.`, detail };
}

// ---- bank account ----

export interface BankAnswer {
  /** Cashfree's reference for the call (kept so a question to Cashfree can quote it). */
  reference_id?: number | string;
  account_status?: string | null;
  account_status_code?: string | null;
  name_at_bank?: string | null;
  bank_name?: string | null;
  branch?: string | null;
  name_match_result?: MatchResult | null;
  name_match_score?: string | number | null;
}

const BANK_REASON: Record<string, string> = {
  INVALID_ACCOUNT_FAIL: "The account number is not valid at this bank.",
  ACCOUNT_BLOCKED: "The account is blocked or closed.",
  INVALID_IFSC_FAIL: "The IFSC code is not valid.",
  NRE_ACCOUNT_FAIL: "This is an NRE account, which cannot receive these payments.",
  FRAUD_ACCOUNT: "The bank has flagged this account as a fraud account.",
};

export function bankVerdict(a: BankAnswer, ctx: { holder?: string }): Verdict {
  const detail = { name_at_bank: a.name_at_bank ?? null, bank_name: a.bank_name ?? null, branch: a.branch ?? null, name_match_result: a.name_match_result ?? null, name_match_score: a.name_match_score ?? null, account_status_code: a.account_status_code ?? null };
  if (a.account_status !== "VALID") return { status: "failed", code: "invalid", summary: BANK_REASON[a.account_status_code ?? ""] ?? "The bank could not confirm this account.", detail };
  const r = a.name_match_result;
  const at = a.name_at_bank ?? "unknown";
  if (strongMatch(r)) return { status: "passed", code: "ok", summary: `Account found at ${a.bank_name ?? "the bank"} and the holder name matches (${matchWords(r)}, ${pct(a.name_match_score)}). Name at bank: ${at}.`, detail };
  if (weakMatch(r)) return { status: "review", code: "name_partial", summary: `Account found, but the holder name is only ${matchWords(r)} (${pct(a.name_match_score)}). Name at bank: ${at}; given ${ctx.holder ?? "none"}.`, detail };
  if (r === "NO_MATCH") return { status: "failed", code: "name_mismatch", summary: `Account found, but it is in a different name: ${at}; given ${ctx.holder ?? "none"}.`, detail };
  return { status: "review", code: "name_missing", summary: `Account found at ${a.bank_name ?? "the bank"}. No name was compared. Name at bank: ${at}.`, detail };
}

// ---- the PAN holder against the bank account holder ----

export interface NameMatchAnswer {
  /** Cashfree's reference for the call (kept so a question to Cashfree can quote it). */
  reference_id?: number | string;
  reason?: MatchResult | null;
  score?: number | null;
}

/** Never "failed": an account in the firm's name against an owner's PAN is common, so a difference is a question for the admin, not a verdict. */
export function nameMatchVerdict(a: NameMatchAnswer, names: { pan: string; bank: string }): Verdict {
  const detail = { pan_name: names.pan, bank_name: names.bank, result: a.reason ?? null, score: a.score ?? null };
  if (strongMatch(a.reason)) return { status: "passed", code: "ok", summary: `The name on the PAN (${names.pan}) and the name on the bank account (${names.bank}) match (${matchWords(a.reason)}).`, detail };
  return { status: "review", code: "differs", summary: `The name on the PAN (${names.pan}) and the name on the bank account (${names.bank}) are ${matchWords(a.reason)}. Check the account belongs to the person or business we pay.`, detail };
}

// ---- faces ----

export interface FaceMatchAnswer {
  /** Cashfree's reference for the call (kept so a question to Cashfree can quote it). */
  reference_id?: number | string;
  ref_id?: number | string;
  status?: string;
  face_match_result?: string | null;
  face_match_score?: number | null;
}

export function faceMatchVerdict(a: FaceMatchAnswer): Verdict {
  const detail = { status: a.status ?? null, result: a.face_match_result ?? null, score: a.face_match_score ?? null };
  if (a.status === "MULTIPLE_FACE_DETECTED") return { status: "review", code: "multiple", summary: "More than one face was found in a photo, so the faces could not be compared. Compare them by eye.", detail };
  if (a.face_match_result === "YES") return { status: "passed", code: "ok", summary: `The selfie and the photo ID show the same face (${pct(a.face_match_score)}).`, detail };
  if (typeof a.face_match_score === "number" && a.face_match_score >= 0.5) return { status: "review", code: "close", summary: `The selfie and the photo ID may show the same face, but not clearly enough (${pct(a.face_match_score)}). Compare them by eye.`, detail };
  return { status: "failed", code: "no_match", summary: `The selfie does not look like the photo on the ID (${pct(a.face_match_score)}).`, detail };
}

export interface LivenessAnswer {
  /** Cashfree's reference for the call (kept so a question to Cashfree can quote it). */
  reference_id?: number | string;
  status?: string;
  liveness?: boolean;
  liveness_score?: number | null;
  quality?: { blur?: boolean; bright?: boolean; exposure?: string } | null;
  face_occluded?: { value?: boolean } | null;
  pose?: { head_turned?: boolean } | null;
}

export function livenessVerdict(a: LivenessAnswer): Verdict {
  const detail = { status: a.status ?? null, liveness: a.liveness ?? null, score: a.liveness_score ?? null, blur: a.quality?.blur ?? null, exposure: a.quality?.exposure ?? null, face_occluded: a.face_occluded?.value ?? null, head_turned: a.pose?.head_turned ?? null };
  if (a.status === "MULTIPLE_FACES_DETECTED") return { status: "review", code: "multiple", summary: "More than one face is in the selfie. Ask for a new one.", detail };
  if (a.status === "FACE_NOT_DETECTED") return { status: "failed", code: "no_face", summary: "No face was found in the selfie. Ask for a new one.", detail };
  if (a.status === "REAL_FACE_NOT_DETECTED" || a.liveness !== true) return { status: "failed", code: "not_live", summary: "The selfie does not look like a live face (it may be a photo of a photo or a screen). Ask for a new one.", detail };
  const problems = [a.quality?.blur ? "blurred" : null, a.face_occluded?.value ? "partly covered" : null, a.pose?.head_turned ? "head turned away" : null, a.quality?.exposure && a.quality.exposure !== "NEUTRAL" ? a.quality.exposure.toLowerCase().replace(/_/g, " ") : null].filter(Boolean);
  if (problems.length > 0) return { status: "review", code: "poor_quality", summary: `A live face, but the photo is ${problems.join(", ")} (${pct(a.liveness_score)}). Ask for a clearer selfie if the ID cannot be matched.`, detail };
  return { status: "passed", code: "ok", summary: `A live face (${pct(a.liveness_score)}).`, detail };
}

// ---- what the service could not answer ----

/** When the service itself could not answer, nothing has been decided: the words say why and who can fix it. */
export function errorVerdict(kind: "config" | "ip" | "auth" | "balance" | "rate" | "upstream" | "input" | "other", message?: string): Verdict {
  const words: Record<typeof kind, string> = {
    config: "Automatic checks are not set up on this server.",
    ip: "The verification service did not accept this server's address. The address must be allowed in the Cashfree dashboard.",
    auth: "The verification service did not accept our keys.",
    balance: "The verification account has no balance left.",
    rate: "The verification service is busy. Ask again in a minute.",
    upstream: "The source (the bank or the government service) could not answer just now. Ask again later.",
    input: message ?? "The details could not be sent for checking.",
    other: "The check could not be completed. Ask again later.",
  };
  return { status: "error", code: kind, summary: words[kind], detail: {} };
}

// ---- what the partner is told ----

/**
 * The plain line the PARTNER sees after asking for a check. It never gives away what the sources hold about the person (the name registered to a PAN, the name at the
 * bank): only whether it matched what they typed, and what to do. The GST registration is public, so its registered name is shown.
 */
export function partnerMessage(kind: VerificationKind, v: Pick<Verdict, "status" | "code"> & { detail?: Record<string, unknown> }): string {
  if (v.status === "error") return v.code === "input" ? "Please fill in the details above first." : "We couldn't check this just now. Our team will check it when you send your application.";
  const legal = typeof v.detail?.legal_name === "string" ? v.detail.legal_name : "";
  switch (kind) {
    case "pan":
      if (v.status === "passed") return "Your PAN is valid and matches your name.";
      if (v.code === "name_partial" || v.code === "name_missing" || v.code === "unlinked") return v.code === "unlinked" ? "Your PAN is valid, but it does not seem to be linked to Aadhaar, which can lead to tax being deducted at a higher rate. Please link it on the income tax portal. Our team will look at this." : "Your PAN is valid, but the name on it is not a close match to the name you gave. Please check both. Our team will also look at it.";
      if (v.code === "name_mismatch") return "That PAN belongs to a different name from the one you gave. Please check the PAN and the name.";
      if (v.code === "inactive") return "That PAN is not active. Please check it, or contact us.";
      return "That PAN could not be verified. Please check the number.";
    case "gstin":
      if (v.status === "passed") return `Active GST registration found${legal ? `: ${legal}` : ""}.`;
      if (v.code === "name_differs") return `Active GST registration found${legal ? ` for ${legal}` : ""}, but it does not look like your business name. Please check. Our team will also look at it.`;
      if (v.code === "pan_mismatch") return "This GST number belongs to a different PAN from the one you gave. Please check both.";
      if (v.code === "inactive") return "That GST registration is not active. Please check it, or contact us.";
      return "No GST registration was found for that number. Please check it, or leave it empty if you are not registered.";
    case "bank":
      if (v.status === "passed") return "Your bank account was found and the name matches.";
      if (v.code === "name_partial" || v.code === "name_missing") return "Your bank account was found, but the name on it is not a close match to the name you gave. Please check the name. Our team will also look at it.";
      if (v.code === "name_mismatch") return "That account is in a different name from the one you gave. Please check the account and the name.";
      return "The bank could not confirm that account. Please check the account number and the IFSC.";
    default:
      return "";
  }
}
