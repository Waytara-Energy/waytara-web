import type { createClient } from "@waytara/supabase/server";
import { memberKey, readOnboarding, type OnboardingData } from "@waytara/supabase/partner-onboarding";
import { isCheckKey, isCheckState, isMemberCheckKey, type CheckKey, type CheckState, type MemberCheckKey, type MemberRef, type MemberStates } from "@waytara/supabase/partner-verification";

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
}

/**
 * Everything the approval gate and the verification tabs need, in one read: what the admin has checked about the partner, the people on their team (from what the
 * partner entered), and what has been checked about each of them. Run as the signed-in admin, so the row-level rules apply.
 */
export async function loadVerification(supabase: Supabase, applicationId: string): Promise<VerificationData> {
  const [{ data: checks }, { data: onb }] = await Promise.all([
    supabase.from("partner_item_checks").select("subject, key, state, note, checked_at").eq("application_id", applicationId),
    supabase.from("partner_onboarding").select("data").eq("application_id", applicationId).maybeSingle(),
  ]);
  const onboarding = onb ? readOnboarding(onb.data) : null;
  const members: MemberRef[] = (onboarding?.team.members ?? []).map((m, i) => ({ key: memberKey(m, i), name: m.name, needsLicence: m.needsLicence }));

  const states: VerificationData["states"] = {};
  const rows: VerificationData["rows"] = {};
  const memberStates: MemberStates = {};
  const memberRows: VerificationData["memberRows"] = {};
  for (const c of checks ?? []) {
    if (!isCheckState(c.state)) continue;
    const row = { note: c.note, checked_at: c.checked_at };
    if (c.subject === "partner" && isCheckKey(c.key)) {
      states[c.key] = c.state;
      rows[c.key] = row;
    } else if (c.subject.startsWith("member:") && isMemberCheckKey(c.key)) {
      const k = c.subject.slice("member:".length);
      (memberStates[k] ??= {})[c.key] = c.state;
      (memberRows[k] ??= {})[c.key] = row;
    }
  }
  return { onboarding, states, rows, members, memberStates, memberRows };
}
