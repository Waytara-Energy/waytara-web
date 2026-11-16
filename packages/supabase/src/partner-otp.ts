// The e-mail code an applicant types to prove the address is theirs. Pure helpers (no database), shared and tested. The code is 6 digits, made from the system's random
// source without bias, kept only as a salted hash, and compared in constant time.

import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

export const CODE_TTL_MS = 10 * 60 * 1000;
export const PROOF_TTL_MS = 15 * 60 * 1000;
export const MAX_ATTEMPTS = 5;
/** The least time between two codes for one application. */
export const RESEND_GAP_MS = 45 * 1000;

/** A 6-digit code, every value equally likely (zero-padded). */
export const newCode = (): string => String(randomInt(0, 1_000_000)).padStart(6, "0");

export const isPlausibleCode = (s: unknown): s is string => typeof s === "string" && /^\d{6}$/.test(s);

/** A one-time proof the server hands back when the code was right (43 characters, base64url). */
export const newProof = (): string => randomBytes(32).toString("base64url");
export const isPlausibleProof = (s: unknown): s is string => typeof s === "string" && /^[A-Za-z0-9_-]{43}$/.test(s);

/** SHA-256 (hex) of a secret, salted with the application's id so equal codes of two applications never look alike. */
export const hashSecret = (applicationId: string, secret: string): string => createHash("sha256").update(`${applicationId}:${secret}`).digest("hex");

/** Constant-time comparison of two hex strings of the same length. */
export function sameHash(a: string, b: string): boolean {
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
}
