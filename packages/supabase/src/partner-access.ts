import { createHash, randomBytes } from "node:crypto";

// The tracking link of a partner application. The link carries a long random code; only its SHA-256 hash is stored, so a database leak does not give anyone a
// working link, and a link can be replaced by storing a new hash. Used by the public site (to make the first link and to open it) and by the admin app (to send
// a new one), so both hash the same way.

/** How long a tracking link works, from the day it is made. */
export const ACCESS_DAYS = 180;

/** 32 random bytes as base64url: 43 characters, 256 bits. */
export function newAccessToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashAccessToken(token) };
}

export function hashAccessToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** A code that could be one of ours: the right length and alphabet. Anything else is refused before the database is asked. */
export function isPlausibleAccessToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

export function accessExpiry(now: Date = new Date()): string {
  return new Date(now.getTime() + ACCESS_DAYS * 86_400_000).toISOString();
}
