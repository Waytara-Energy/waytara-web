import "server-only";
import { createServiceRoleClient } from "@waytara/supabase/service-role";
import { CODE_TTL_MS, MAX_ATTEMPTS, PROOF_TTL_MS, RESEND_GAP_MS, hashSecret, newCode, newProof, sameHash } from "@waytara/supabase/partner-otp";

export type SendResult = { ok: true; code: string } | { ok: false; error: string; status: number };
export type VerifyResult = { ok: true; proof: string } | { ok: false; error: string; status: number };

/** Makes a new code for an application (replacing any earlier one), unless one was made under 45 seconds ago. The caller e-mails it; only its hash is stored. */
export async function issueCode(applicationId: string): Promise<SendResult> {
  const db = createServiceRoleClient();
  const { data: row } = await db.from("partner_login_codes").select("last_sent_at").eq("application_id", applicationId).maybeSingle();
  if (row && Date.now() - new Date(row.last_sent_at).getTime() < RESEND_GAP_MS) return { ok: false, error: "A code was just sent. Please wait a moment before asking for another.", status: 429 };
  const code = newCode();
  const now = new Date();
  const { error } = await db.from("partner_login_codes").upsert(
    { application_id: applicationId, code_hash: hashSecret(applicationId, code), expires_at: new Date(now.getTime() + CODE_TTL_MS).toISOString(), attempts: 0, last_sent_at: now.toISOString(), proof_hash: null, proof_expires_at: null },
    { onConflict: "application_id" },
  );
  if (error) return { ok: false, error: "We couldn't send a code just now. Please try again.", status: 500 };
  return { ok: true, code };
}

/** Checks a typed code: right, within 10 minutes, and within 5 tries. On success the code is used up and a one-time proof (valid 15 minutes) is returned for the next step. */
export async function checkCode(applicationId: string, code: string): Promise<VerifyResult> {
  const db = createServiceRoleClient();
  const { data: row } = await db.from("partner_login_codes").select("code_hash, expires_at, attempts").eq("application_id", applicationId).maybeSingle();
  if (!row || new Date(row.expires_at).getTime() < Date.now()) return { ok: false, error: "That code has expired. Ask for a new one.", status: 400 };
  if (row.attempts >= MAX_ATTEMPTS) return { ok: false, error: "Too many wrong tries. Ask for a new code.", status: 429 };
  // count the try first, and only if nobody else counted one in between (so parallel guesses cannot beat the limit)
  const { data: counted } = await db.from("partner_login_codes").update({ attempts: row.attempts + 1 }).eq("application_id", applicationId).eq("attempts", row.attempts).select("attempts").maybeSingle();
  if (!counted) return { ok: false, error: "Please try again.", status: 409 };
  if (!sameHash(row.code_hash, hashSecret(applicationId, code))) return { ok: false, error: `That code is not right. ${MAX_ATTEMPTS - counted.attempts} ${MAX_ATTEMPTS - counted.attempts === 1 ? "try" : "tries"} left.`, status: 400 };
  const proof = newProof();
  const { error } = await db
    .from("partner_login_codes")
    .update({ code_hash: "used", proof_hash: hashSecret(applicationId, proof), proof_expires_at: new Date(Date.now() + PROOF_TTL_MS).toISOString() })
    .eq("application_id", applicationId);
  if (error) return { ok: false, error: "Please try again.", status: 500 };
  return { ok: true, proof };
}

/** Whether a proof is the live one for this application. It is checked here and spent only when the account is made (see consumeProof). */
export async function proofIsValid(applicationId: string, proof: string): Promise<boolean> {
  const { data: row } = await createServiceRoleClient().from("partner_login_codes").select("proof_hash, proof_expires_at").eq("application_id", applicationId).maybeSingle();
  return !!row?.proof_hash && !!row.proof_expires_at && new Date(row.proof_expires_at).getTime() > Date.now() && sameHash(row.proof_hash, hashSecret(applicationId, proof));
}

export async function consumeProof(applicationId: string): Promise<void> {
  await createServiceRoleClient().from("partner_login_codes").delete().eq("application_id", applicationId);
}
