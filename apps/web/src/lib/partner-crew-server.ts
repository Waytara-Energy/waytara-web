import "server-only";
import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@waytara/supabase/service-role";
import { hashAccessToken, isPlausibleAccessToken } from "@waytara/supabase/partner-access";
import { readOnboarding, memberKey, type OnboardingData, type TeamMember } from "@waytara/supabase/partner-onboarding";
import { allowRequest, clientIp } from "@/lib/rate-limit";
import { fail } from "@/lib/partner-track-api";
import { SITE } from "@/lib/site";

/** How long a link to a team member works. */
export const CREW_INVITE_DAYS = 14;

export interface CrewSession {
  invite: { id: string; status: string };
  app: { id: string; partnerType: string | null; reference: string | null; contactName: string; companyName: string };
  data: OnboardingData;
  member: TeamMember;
  /** The id the person's documents are filed under; the subject of everything they send is `member:<key>`. */
  key: string;
}

/** The page a link leads to, on the right site: the public address in production, whatever this server is running on while developing. */
export function crewLink(token: string, requestOrigin: string): string {
  const origin = process.env.NODE_ENV === "production" ? SITE.url : requestOrigin;
  return `${origin}/partner/crew/${token}`;
}

/**
 * Opens a link: right shape, known, not replaced, not expired, and the partner still filling in their onboarding (not yet sent for verification), because what the team
 * is checking must not change under them. Null for every way a link can fail, so nothing tells a stranger why.
 */
export async function loadCrewSession(token: string): Promise<CrewSession | null> {
  if (!isPlausibleAccessToken(token)) return null;
  const db = createServiceRoleClient();
  const { data: invite } = await db.from("partner_crew_invites").select("id, application_id, member_id, status, expires_at").eq("token_hash", hashAccessToken(token)).maybeSingle();
  if (!invite || invite.status === "revoked" || new Date(invite.expires_at).getTime() <= Date.now()) return null;

  const [{ data: app }, { data: onboarding }] = await Promise.all([
    db.from("partner_applications").select("id, partner_type, reference, contact_name, company_name, status").eq("id", invite.application_id).maybeSingle(),
    db.from("partner_onboarding").select("data, submitted_at").eq("application_id", invite.application_id).maybeSingle(),
  ]);
  if (!app || app.status !== "onboarding" || !onboarding || onboarding.submitted_at) return null;

  const data = readOnboarding(onboarding.data);
  const index = data.team.members.findIndex((m, i) => memberKey(m, i) === invite.member_id);
  if (index < 0) return null;
  return {
    invite: { id: invite.id, status: invite.status },
    app: { id: app.id, partnerType: app.partner_type, reference: app.reference, contactName: app.contact_name, companyName: app.company_name },
    data,
    member: data.team.members[index],
    key: invite.member_id,
  };
}

/** What every crew route does first: slow down anyone sending too many requests, then open the link. Returns the session, or the response to send back. */
export async function openCrew(headers: Headers, token: string, bucket: string, limit: number): Promise<CrewSession | NextResponse> {
  if (!(await allowRequest(`partner-crew:${bucket}`, clientIp(headers), limit, 60 * 60))) return fail("Too many requests. Please try again later.", 429);
  return (await loadCrewSession(token)) ?? fail("This link is not active.", 404);
}
