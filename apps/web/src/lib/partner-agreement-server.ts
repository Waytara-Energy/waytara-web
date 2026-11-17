import "server-only";
import { createHash } from "node:crypto";
import { createServiceRoleClient } from "@waytara/supabase/service-role";
import { CODE_TTL_MS, MAX_ATTEMPTS, RESEND_GAP_MS, hashSecret, newCode, sameHash } from "@waytara/supabase/partner-otp";
import { AGREEMENT_VERSION, agreementText } from "@waytara/supabase/partner-agreement";

export interface SignedAgreement {
  version: string;
  signedAt: string;
}

/** The fingerprint of the exact agreement text a partner of this kind is shown. Stored with every acceptance. */
export const agreementHash = (partnerType: string | null): string => createHash("sha256").update(agreementText(partnerType), "utf8").digest("hex");

/** The code is salted differently from the sign-in code, so one can never stand in for the other. */
const salted = (code: string) => `agreement:${code}`;

/** Whether the partner has accepted the CURRENT version of the agreement (an older version does not count: it must be accepted again). */
export async function signedAgreement(applicationId: string): Promise<SignedAgreement | null> {
  const { data } = await createServiceRoleClient().from("partner_agreements").select("version, signed_at").eq("application_id", applicationId).eq("version", AGREEMENT_VERSION).maybeSingle();
  return data ? { version: data.version, signedAt: data.signed_at } : null;
}

export type CodeResult = { ok: true; code: string } | { ok: false; error: string; status: number };

/** Makes a code for signing (replacing any earlier one) unless one was made under 45 seconds ago. The caller e-mails it; only its hash is kept. */
export async function issueAgreementCode(applicationId: string): Promise<CodeResult> {
  const db = createServiceRoleClient();
  const { data: row } = await db.from("partner_agreement_codes").select("last_sent_at").eq("application_id", applicationId).maybeSingle();
  if (row && Date.now() - new Date(row.last_sent_at).getTime() < RESEND_GAP_MS) return { ok: false, error: "A code was just sent. Please wait a moment before asking for another.", status: 429 };
  const code = newCode();
  const now = new Date();
  const { error } = await db
    .from("partner_agreement_codes")
    .upsert({ application_id: applicationId, code_hash: hashSecret(applicationId, salted(code)), expires_at: new Date(now.getTime() + CODE_TTL_MS).toISOString(), attempts: 0, last_sent_at: now.toISOString() }, { onConflict: "application_id" });
  if (error) return { ok: false, error: "We couldn't send a code just now. Please try again.", status: 500 };
  return { ok: true, code };
}

/** Checks a typed code: right, within 10 minutes and within 5 tries; on success the code is used up. */
export async function checkAgreementCode(applicationId: string, code: string): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const db = createServiceRoleClient();
  const { data: row } = await db.from("partner_agreement_codes").select("code_hash, expires_at, attempts").eq("application_id", applicationId).maybeSingle();
  if (!row || row.code_hash === "used" || new Date(row.expires_at).getTime() < Date.now()) return { ok: false, error: "That code has expired. Ask for a new one.", status: 400 };
  if (row.attempts >= MAX_ATTEMPTS) return { ok: false, error: "Too many wrong tries. Ask for a new code.", status: 429 };
  // count the try first, and only if nobody else counted one in between (so parallel guesses cannot beat the limit)
  const { data: counted } = await db.from("partner_agreement_codes").update({ attempts: row.attempts + 1 }).eq("application_id", applicationId).eq("attempts", row.attempts).select("attempts").maybeSingle();
  if (!counted) return { ok: false, error: "Please try again.", status: 409 };
  if (!sameHash(row.code_hash, hashSecret(applicationId, salted(code)))) {
    const left = MAX_ATTEMPTS - counted.attempts;
    return { ok: false, error: `That code is not right. ${left} ${left === 1 ? "try" : "tries"} left.`, status: 400 };
  }
  await db.from("partner_agreement_codes").update({ code_hash: "used" }).eq("application_id", applicationId);
  return { ok: true };
}
