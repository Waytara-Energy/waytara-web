import { constants, publicEncrypt, randomUUID } from "node:crypto";
import type { FaceMatchAnswer, GstinAnswer, LivenessAnswer, NameMatchAnswer, PanAnswer, BankAnswer } from "./partner-verify-rules";

// The one place that talks to Cashfree Secure ID (its Verification Suite). Server only: the keys are read from the environment and never leave it. Every call sends the
// keys as x-client-id and x-client-secret; and, when a Cashfree "public key" is set up for two-factor authentication, a signature that proves the request is ours (the
// client id and the time, encrypted with that key). Without a public key, Cashfree accepts only the addresses listed in its dashboard.
//
//   CASHFREE_CLIENT_ID, CASHFREE_CLIENT_SECRET   the key pair (sandbox or production: the sandbox pair is refused by production and the other way round)
//   CASHFREE_ENV                                  "production" for the live service; anything else (or nothing) is the sandbox
//   CASHFREE_BASE_URL                             testing only: a stand-in server instead of the sandbox (ignored when CASHFREE_ENV is "production")
//   CASHFREE_PUBLIC_KEY                           optional: the .pem of the public key, either as it is (new lines written as \n) or encoded in base64
//
// What each call returns is what Cashfree answered, typed only as far as the rules need (see partner-verify-rules.ts).

export type CashfreeErrorKind = "config" | "ip" | "auth" | "balance" | "rate" | "upstream" | "input" | "other";

export class CashfreeError extends Error {
  constructor(
    public kind: CashfreeErrorKind,
    message: string,
    public code?: string,
    public status?: number,
  ) {
    super(message);
    this.name = "CashfreeError";
  }
}

interface Config {
  id: string;
  secret: string;
  base: string;
  publicKey: string | null;
}

function config(): Config | null {
  const id = process.env.CASHFREE_CLIENT_ID?.trim();
  const secret = process.env.CASHFREE_CLIENT_SECRET?.trim();
  if (!id || !secret) return null;
  const raw = process.env.CASHFREE_PUBLIC_KEY?.trim();
  const publicKey = raw ? (raw.includes("BEGIN") ? raw.replace(/\\n/g, "\n") : Buffer.from(raw, "base64").toString("utf8")) : null;
  // CASHFREE_BASE_URL points the client at a stand-in server while testing. It is ignored for the live service, so a stray setting can never send live requests elsewhere.
  const live = process.env.CASHFREE_ENV === "production";
  const base = live ? "https://api.cashfree.com/verification" : process.env.CASHFREE_BASE_URL?.trim() || "https://sandbox.cashfree.com/verification";
  return { id, secret, base, publicKey };
}

export const cashfreeConfigured = (): boolean => config() !== null;
/** Which service the keys point at, for the admin's page ("sandbox" shows test data only). */
export const cashfreeEnvironment = (): "production" | "sandbox" => (process.env.CASHFREE_ENV === "production" ? "production" : "sandbox");

/** The proof that a request is ours: "<client id>.<seconds>" encrypted with Cashfree's public key (RSA, OAEP with SHA-1), in base64. It is good for five minutes. */
export function cashfreeSignature(clientId: string, publicKeyPem: string, nowMs: number = Date.now()): string {
  return publicEncrypt({ key: publicKeyPem, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha1" }, Buffer.from(`${clientId}.${Math.floor(nowMs / 1000)}`)).toString("base64");
}

/** A name as Cashfree takes it: letters, digits, space and . - / & only, at most 100 characters. */
export const cleanName = (s: string): string => s.replace(/[^A-Za-z0-9 .\-/&]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 100);

/** A fresh id for a call that needs one (Cashfree refuses an id it has seen): letters and digits, well under its 50-character limit. */
const newId = (): string => `wt${randomUUID().replace(/-/g, "")}`;

interface ApiError {
  type?: string;
  code?: string;
  message?: string;
}

/** What went wrong, in our terms, from Cashfree's status and its error code. */
function classify(status: number, body: ApiError | null): CashfreeError {
  const code = body?.code;
  const message = body?.message ?? "The verification service returned an error.";
  if (status === 403 && code === "ip_validation_failed") return new CashfreeError("ip", message, code, status);
  if (status === 401 || status === 403) return new CashfreeError("auth", message, code, status);
  if (status === 422 && code === "insufficient_balance") return new CashfreeError("balance", message, code, status);
  if (status === 429) return new CashfreeError("rate", message, code, status);
  if (status === 400) return new CashfreeError(code === "x-client-secret_value_invalid" ? "auth" : "input", message, code, status);
  if (status >= 500 || status === 422) return new CashfreeError("upstream", message, code, status);
  return new CashfreeError("other", message, code, status);
}

async function call<T>(path: string, init: { json?: unknown; form?: FormData; version?: string }): Promise<T> {
  const cfg = config();
  if (!cfg) throw new CashfreeError("config", "Automatic checks are not set up on this server.");
  const headers: Record<string, string> = { "x-client-id": cfg.id, "x-client-secret": cfg.secret };
  if (cfg.publicKey) headers["x-cf-signature"] = cashfreeSignature(cfg.id, cfg.publicKey);
  if (init.version) headers["x-api-version"] = init.version;
  if (init.json !== undefined) headers["Content-Type"] = "application/json";
  let res: Response;
  try {
    res = await fetch(`${cfg.base}${path}`, { method: "POST", headers, body: init.form ?? (init.json !== undefined ? JSON.stringify(init.json) : undefined), signal: AbortSignal.timeout(30_000) });
  } catch {
    throw new CashfreeError("upstream", "The verification service could not be reached.");
  }
  const body = (await res.json().catch(() => null)) as (T & ApiError) | null;
  if (!res.ok) throw classify(res.status, body);
  if (!body) throw new CashfreeError("upstream", "The verification service sent an answer we could not read.", undefined, res.status);
  return body;
}

export const verifyPan = (input: { pan: string; name?: string }): Promise<PanAnswer> => call<PanAnswer>("/pan", { json: { pan: input.pan, ...(input.name ? { name: cleanName(input.name) } : {}) }, version: "2022-10-26" });

export const verifyGstin = (input: { gstin: string }): Promise<GstinAnswer> => call<GstinAnswer>("/gstin", { json: { GSTIN: input.gstin } });

/**
 * Asks the bank whether the account exists and in whose name (Cashfree sends a small test credit). A bank that has flagged the account as fraud answers with an error that
 * is a result, not a failure of the service, so it is returned as one.
 */
export async function verifyBank(input: { account: string; ifsc: string; name?: string }): Promise<BankAnswer> {
  try {
    return await call<BankAnswer>("/bank-account/sync", { json: { bank_account: input.account, ifsc: input.ifsc, ...(input.name ? { name: cleanName(input.name) } : {}) } });
  } catch (e) {
    if (e instanceof CashfreeError && e.code === "fraud_account") return { account_status: "INVALID", account_status_code: "FRAUD_ACCOUNT" };
    throw e;
  }
}

export const compareNames = (a: string, b: string): Promise<NameMatchAnswer> =>
  call<{ score?: number; reason?: string }>("/name-match", { json: { verification_id: newId(), name_1: cleanName(a), name_2: cleanName(b) } });

/** Whether two photos show the same face. Each is a JPEG or PNG of at most 5 MB (checked by the caller). */
export function compareFaces(first: { bytes: Buffer; name: string; type: string }, second: { bytes: Buffer; name: string; type: string }): Promise<FaceMatchAnswer> {
  const form = new FormData();
  form.set("verification_id", newId());
  form.set("first_image", new Blob([new Uint8Array(first.bytes)], { type: first.type }), first.name);
  form.set("second_image", new Blob([new Uint8Array(second.bytes)], { type: second.type }), second.name);
  return call<FaceMatchAnswer>("/face-match", { form });
}

/** Whether a photo is a live face, and how good it is. A JPEG or PNG of at most 5 MB (checked by the caller). */
export function checkLiveness(image: { bytes: Buffer; name: string; type: string }): Promise<LivenessAnswer> {
  const form = new FormData();
  form.set("verification_id", newId());
  form.set("image", new Blob([new Uint8Array(image.bytes)], { type: image.type }), image.name);
  return call<LivenessAnswer>("/face-liveness", { form, version: "2024-12-01" });
}
