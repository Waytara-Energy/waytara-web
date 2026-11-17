import type { createClient } from "@waytara/supabase/server";
import { memberKey, readOnboarding, type OnboardingData } from "@waytara/supabase/partner-onboarding";
import { cashfreeConfigured, cashfreeEnvironment } from "@waytara/supabase/partner-cashfree";
import { loadResults } from "@waytara/supabase/partner-verification-run";
import { SCREENING_SUBJECT, isCheckKey, isCheckState, isMemberCheckKey, type CheckKey, type CheckState, type MemberCheckKey, type MemberRef, type MemberStates } from "@waytara/supabase/partner-verification";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export interface CheckRow {
  note: string | null;
  checked_at: string | null;
}

export interface VerificationData {
  onboarding: OnboardingData | null;
  /** The partner's own checks: state by key, and the row (note, when) by key. */
  states: Partial<Record<CheckKey, CheckState>>;
  rows: Partial<Record<CheckKey, CheckRow>>;
  /** The team: who they are, and where each stands. */
  members: MemberRef[];
  memberStates: MemberStates;
  memberRows: Record<string, Partial<Record<MemberCheckKey, CheckRow>>>;
  /** The screening call's checklist: what is ticked, and the note on each. */
  screening: Partial<Record<string, CheckState>>;
  screeningRows: Partial<Record<string, CheckRow>>;
  /** Every version of the Partner Agreement the partner accepted, newest first. */
  agreements: { version: string; signed_at: string; signer_name: string; signer_email: string; signer_ip: string | null; text_hash: string }[];
  /** The automatic checks (Cashfree): the latest result of each, keyed "subject|kind"; whether they are set up on this server, and whether against the sandbox. */
  checks: Awaited<ReturnType<typeof loadResults>>;
  autoOn: boolean;
  autoEnv: "production" | "sandbox";
  /** The newest link sent to each team member, by member id. */
  invites: Record<string, { status: string; sent_via: string; created_at: string; opened_at: string | null; completed_at: string | null; expired: boolean }>;
  /** What DigiLocker stated about a person who verified with it, by subject ("partner" or "member:<id>"): the name, date of birth, gender and address, and the last four Aadhaar digits. */
  digilocker: Record<string, { status: string; identity: { name?: string; dob?: string; gender?: string; address?: string }; uid_last4: string | null; completed_at: string | null }>;
}

/**
 * Everything the approval gate and the verification tabs need, in one read: what the admin has checked about the partner, the people on their team (from what the
 * partner entered), and what has been checked about each of them. Run as the signed-in admin, so the row-level rules apply.
 */
export async function loadVerification(supabase: Supabase, applicationId: string): Promise<VerificationData> {
  const [{ data: checks }, { data: onb }, { data: agreements }, { data: invs }, autoChecks, { data: dls }] = await Promise.all([
    supabase.from("partner_item_checks").select("subject, key, state, note, checked_at").eq("application_id", applicationId),
    supabase.from("partner_onboarding").select("data").eq("application_id", applicationId).maybeSingle(),
    supabase.from("partner_agreements").select("version, signed_at, signer_name, signer_email, signer_ip, text_hash").eq("application_id", applicationId).order("signed_at", { ascending: false }),
    supabase.from("partner_crew_invites").select("member_id, status, sent_via, expires_at, created_at, opened_at, completed_at").eq("application_id", applicationId).neq("status", "revoked").order("created_at", { ascending: false }),
    loadResults(supabase, applicationId),
    supabase.from("partner_digilocker").select("subject, status, identity, uid_last4, completed_at").eq("application_id", applicationId),
  ]);
  const digilocker: VerificationData["digilocker"] = {};
  for (const d of dls ?? []) digilocker[d.subject] = { status: d.status, identity: (d.identity ?? {}) as VerificationData["digilocker"][string]["identity"], uid_last4: d.uid_last4, completed_at: d.completed_at };
  const invites: VerificationData["invites"] = {};
  for (const i of invs ?? []) {
    if (invites[i.member_id]) continue;
    invites[i.member_id] = { status: i.status, sent_via: i.sent_via, created_at: i.created_at, opened_at: i.opened_at, completed_at: i.completed_at, expired: new Date(i.expires_at).getTime() <= Date.now() && i.status !== "completed" };
  }
  const onboarding = onb ? readOnboarding(onb.data) : null;
  const members: MemberRef[] = (onboarding?.team.members ?? []).map((m, i) => ({ key: memberKey(m, i), name: m.name, needsLicence: m.needsLicence }));

  const states: VerificationData["states"] = {};
  const rows: VerificationData["rows"] = {};
  const memberStates: MemberStates = {};
  const memberRows: VerificationData["memberRows"] = {};
  const screening: VerificationData["screening"] = {};
  const screeningRows: VerificationData["screeningRows"] = {};
  for (const c of checks ?? []) {
    if (!isCheckState(c.state)) continue;
    const row = { note: c.note, checked_at: c.checked_at };
    if (c.subject === "partner" && isCheckKey(c.key)) {
      states[c.key] = c.state;
      rows[c.key] = row;
    } else if (c.subject === SCREENING_SUBJECT) {
      screening[c.key] = c.state;
      screeningRows[c.key] = row;
    } else if (c.subject.startsWith("member:") && isMemberCheckKey(c.key)) {
      const k = c.subject.slice("member:".length);
      (memberStates[k] ??= {})[c.key] = c.state;
      (memberRows[k] ??= {})[c.key] = row;
    }
  }
  return { onboarding, states, rows, members, memberStates, memberRows, screening, screeningRows, agreements: agreements ?? [], invites, digilocker, checks: autoChecks, autoOn: cashfreeConfigured(), autoEnv: cashfreeEnvironment() };
}
