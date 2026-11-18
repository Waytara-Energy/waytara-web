import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { createClient } from "@waytara/supabase/server";
import { createServiceRoleClient } from "@waytara/supabase/service-role";
import { hashAccessToken, isPlausibleAccessToken } from "@waytara/supabase/partner-access";
import { isDeviceLevel, isTeamPage, type DeviceLevel, type TeamPage } from "@waytara/supabase/team";
import { getRequestProfile } from "@/lib/request-profile";
import { OWNER_ACCESS, loadTeamAccess, parseTeamAccessHeader, type TeamAccess } from "@/lib/team-access";
import { SITE } from "@/lib/site";

export type { TeamAccess } from "@/lib/team-access";

/**
 * Who this is, in team terms (see team-access.ts). The proxy already worked it out for this request and forwards it as a header, so a page normally pays nothing; if the
 * header is missing (a render outside the proxy) it asks the database itself. A member sees only the pages they were given, of the devices they were given (the database
 * holds the devices back; the website holds the pages back).
 */
export const getTeamAccess = cache(async (): Promise<TeamAccess> => {
  const fromProxy = parseTeamAccessHeader((await headers()).get("x-waytara-team"));
  if (fromProxy) return fromProxy;
  const profile = await getRequestProfile();
  if (!profile) return OWNER_ACCESS;
  return loadTeamAccess(await createClient(), profile.id, profile.role);
});

/** An invitation that is still open, as the join page needs it. Server use only: the public role cannot read the table. */
export interface Invitation {
  id: string;
  ownerId: string;
  ownerName: string;
  email: string;
  fullName: string | null;
}

/** Opens the invitation a link belongs to: the code in the link is hashed and looked up, and must be unexpired and still waiting. Anything else is null, so a page cannot be used to learn which. */
export async function findInvitation(token: string): Promise<Invitation | null> {
  if (!isPlausibleAccessToken(token)) return null;
  try {
    const db = createServiceRoleClient();
    const { data } = await db
      .from("team_members")
      .select("id, owner_id, email, full_name")
      .eq("access_token_hash", hashAccessToken(token))
      .eq("status", "invited")
      .is("user_id", null)
      .gt("access_expires_at", new Date().toISOString())
      .maybeSingle();
    if (!data) return null;
    const { data: owner } = await db.from("profiles").select("full_name").eq("id", data.owner_id).maybeSingle();
    return { id: data.id, ownerId: data.owner_id, ownerName: owner?.full_name?.trim() || "A WayTara customer", email: data.email, fullName: data.full_name };
  } catch {
    return null;
  }
}

/** The page an invitation leads to, on the right site: the public address in production, whatever this server runs on while developing. */
export async function teamJoinLink(token: string): Promise<string> {
  let origin: string = SITE.url;
  if (process.env.NODE_ENV !== "production") {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (host) origin = `${h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.includes(".localhost") ? "http" : "https")}://${host}`;
  }
  return `${origin.replace(/\/+$/, "")}/team/join?t=${token}`;
}

export const teamSignInUrl = (): string => `${(process.env.NEXT_PUBLIC_SITE_URL || SITE.url).replace(/\/+$/, "")}/login`;

/** The names of the accounts that invited a member, for the header of their settings. Read with the server's key (a member cannot read another profile) and only for the ids they belong to. */
export async function ownerNamesOf(ownerIds: readonly string[]): Promise<string[]> {
  if (ownerIds.length === 0) return [];
  const { data } = await createServiceRoleClient().from("profiles").select("full_name").in("id", [...ownerIds]);
  return (data ?? []).map((r) => r.full_name?.trim()).filter((n): n is string => !!n);
}

export interface TeamMemberView {
  id: string;
  email: string;
  fullName: string | null;
  role: string;
  pages: TeamPage[];
  canSchedule: boolean;
  status: "invited" | "active" | "suspended";
  invitedAt: string;
  lastSentAt: string | null;
  acceptedAt: string | null;
  /** An invitation whose link has run out (it can be sent again). */
  expired: boolean;
  devices: { equipmentId: string; level: DeviceLevel }[];
}

/** The owner's team, newest first, as the Settings tab lists it (the owner's own session reads it: the database only returns their rows). A super user is not the owner, so
 *  for them it is read with the server's key (`client`), for the owner who made them one only. */
export async function loadTeam(ownerId: string, client?: Awaited<ReturnType<typeof createClient>>): Promise<TeamMemberView[]> {
  const supabase = client ?? (await createClient());
  const { data: members } = await supabase
    .from("team_members")
    .select("id, email, full_name, role, pages, can_schedule, status, access_expires_at, invited_at, last_sent_at, accepted_at")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });
  if (!members || members.length === 0) return [];
  const { data: devices } = await supabase.from("team_member_devices").select("member_id, equipment_id, level").in("member_id", members.map((m) => m.id));
  const now = Date.now();
  return members.map((m) => ({
    id: m.id,
    email: m.email,
    fullName: m.full_name,
    role: m.role,
    pages: (m.pages ?? []).filter(isTeamPage),
    canSchedule: m.can_schedule,
    status: m.status as TeamMemberView["status"],
    invitedAt: m.invited_at,
    lastSentAt: m.last_sent_at,
    acceptedAt: m.accepted_at,
    expired: m.status === "invited" && !!m.access_expires_at && new Date(m.access_expires_at).getTime() <= now,
    devices: (devices ?? []).filter((d) => d.member_id === m.id && isDeviceLevel(d.level)).map((d) => ({ equipmentId: d.equipment_id, level: d.level as DeviceLevel })),
  }));
}
