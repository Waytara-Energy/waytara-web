import "server-only";
import { createServiceRoleClient } from "@waytara/supabase/service-role";
import { cashfreeConfigured } from "@waytara/supabase/partner-cashfree";
import { checkInputHash, runChecks, loadResults, type Actor, type CheckResult } from "@waytara/supabase/partner-verification-run";
import { PARTNER_CHECK_LIMIT, PARTNER_KINDS, gstinFill, partnerMessage, type VerificationKind, type VerificationStatus } from "@waytara/supabase/partner-verify-rules";
import { PARTNER_BUCKET, loadOnboarding } from "@/lib/partner-onboarding-server";

/** What the partner is told about one of their checks: a plain line and whether it passed, never what the PAN or the bank holds about them. */
export interface PartnerCheckView {
  kind: VerificationKind;
  status: VerificationStatus;
  message: string;
  /** How many times they may still ask for this check. */
  asksLeft: number;
  /** Whether the result is for what is saved now (false once they have changed the number or name since). */
  current: boolean;
  /** For a GST check that found the registration: what it says about the business, which the partner may copy into their blank details (the GST register is public). */
  fill?: { name: string; address: string; started: string; pin: string };
}

type HashKind = "pan" | "gstin" | "udyam" | "bank";

const view = (kind: VerificationKind, r: { status: VerificationStatus; code: string; detail?: Record<string, unknown>; input_hash?: string }, attempts: number, nowHash: string | null): PartnerCheckView => {
  const fill = kind === "gstin" && (r.status === "passed" || r.status === "review") ? gstinFill(r.detail) : null;
  return {
    kind,
    status: r.status,
    message: partnerMessage(kind, r),
    asksLeft: Math.max(0, PARTNER_CHECK_LIMIT - attempts),
    current: Boolean(nowHash) && r.input_hash === nowHash,
    ...(fill ? { fill } : {}),
  };
};

/** Whether automatic checks are set up, and the partner's stored results (as they may see them). */
export async function partnerCheckViews(applicationId: string, partnerType: string | null): Promise<{ configured: boolean; checks: PartnerCheckView[] }> {
  const configured = cashfreeConfigured();
  const stored = await loadResults(createServiceRoleClient(), applicationId);
  const { data } = await loadOnboarding(applicationId);
  const checks = PARTNER_KINDS.flatMap((k) => {
    const r = stored[`partner|${k}`];
    return r ? [view(k, r, r.partner_attempts, checkInputHash(k as HashKind, partnerType, data))] : [];
  });
  return { configured, checks };
}

/** Runs the checks the partner asked for (only PAN, GST and bank: the others are not theirs to ask for) and returns what they may be told. */
export async function runForPartner(applicationId: string, partnerType: string | null, kinds: VerificationKind[]): Promise<{ configured: boolean; checks: PartnerCheckView[]; asked: PartnerCheckView[] }> {
  const state = await loadOnboarding(applicationId);
  const db = createServiceRoleClient();
  const results = await runChecks({ db, applicationId, partnerType, data: state.data, docs: [], download: async () => null, actor: { by: "partner" }, kinds });
  const stored = await loadResults(db, applicationId);
  const asked = results
    .filter((r) => PARTNER_KINDS.includes(r.kind))
    .map((r) => view(r.kind, { ...r, input_hash: stored[`partner|${r.kind}`]?.input_hash }, stored[`partner|${r.kind}`]?.partner_attempts ?? 0, checkInputHash(r.kind as HashKind, partnerType, state.data)));
  return { configured: cashfreeConfigured(), checks: (await partnerCheckViews(applicationId, partnerType)).checks, asked };
}

/**
 * Runs every automatic check for an application that has just been sent: PAN, GST, bank, the names against each other, and the faces of the partner and each person on
 * the team. Nothing the partner waits for: the team finds the results ready. A check whose inputs have not changed since the partner asked is not paid for again.
 */
export async function runAllForSubmitted(applicationId: string, partnerType: string | null, actor: Actor = { by: "system" }): Promise<CheckResult[]> {
  try {
    const state = await loadOnboarding(applicationId);
    const db = createServiceRoleClient();
    const { data: docs } = await db.from("partner_documents").select("id, kind, subject, file_name, storage_path, uploaded_at").eq("application_id", applicationId);
    return await runChecks({
      db,
      applicationId,
      partnerType,
      data: state.data,
      docs: docs ?? [],
      download: async (path) => {
        const { data } = await db.storage.from(PARTNER_BUCKET).download(path);
        return data ? Buffer.from(await data.arrayBuffer()) : null;
      },
      actor,
    });
  } catch (e) {
    // never lets a failed check disturb what was sent: the team can run them again from the admin page
    console.error("runAllForSubmitted error:", e);
    return [];
  }
}
