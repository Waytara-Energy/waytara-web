import type { TypedSupabaseClient } from "@waytara/supabase/auth";
import { TEAM_PAGE_KEYS, isTeamPage, type TeamPage } from "@waytara/supabase/team";

// What a signed-in person may see of the dashboard, in team terms. No "server-only" here: the proxy (which gates every page) and the server code both use it.

/** An owner (anyone without an accepted team membership, or who has an account of their own) sees everything; a member only the pages they were given. */
export interface TeamAccess {
  kind: "owner" | "member";
  pages: readonly TeamPage[];
  canSchedule: boolean;
  /** For a member: the accounts that invited them. */
  ownerIds: readonly string[];
}

export const OWNER_ACCESS: TeamAccess = { kind: "owner", pages: TEAM_PAGE_KEYS, canSchedule: true, ownerIds: [] };

/**
 * Who this is, in team terms. A person whose invitation was accepted (and who is not suspended) and who has no account of their own is a MEMBER; everyone else is an
 * owner. A person who belongs to several teams sees the union of the pages they were given. Staff are never members.
 */
export async function loadTeamAccess(supabase: TypedSupabaseClient, userId: string, role: string): Promise<TeamAccess> {
  if (role !== "customer") return OWNER_ACCESS;
  const { data: rows } = await supabase.from("team_members").select("owner_id, pages, can_schedule").eq("user_id", userId).eq("status", "active");
  if (!rows || rows.length === 0) return OWNER_ACCESS;
  // someone who also has a customer account of their own keeps the full dashboard for it
  const { data: own } = await supabase.from("customers").select("id").eq("id", userId).maybeSingle();
  if (own) return OWNER_ACCESS;
  const pages = TEAM_PAGE_KEYS.filter((k) => rows.some((r) => (r.pages ?? []).includes(k)));
  return { kind: "member", pages, canSchedule: rows.some((r) => r.can_schedule), ownerIds: rows.map((r) => r.owner_id) };
}

/** The value the proxy forwards to the pages (so a page does not ask the database again). ASCII only, as a header must be. */
export const teamAccessHeader = (a: TeamAccess): string => (a.kind === "owner" ? "owner" : JSON.stringify({ p: a.pages, s: a.canSchedule, o: a.ownerIds }));

/** Reads that value back; anything that is not exactly what the proxy writes is null (the caller then asks the database). */
export function parseTeamAccessHeader(value: string | null): TeamAccess | null {
  if (value === "owner") return OWNER_ACCESS;
  if (!value) return null;
  try {
    const v = JSON.parse(value) as { p?: unknown; s?: unknown; o?: unknown };
    if (!Array.isArray(v.p) || !Array.isArray(v.o)) return null;
    return { kind: "member", pages: TEAM_PAGE_KEYS.filter((k) => (v.p as unknown[]).includes(k) && isTeamPage(k)), canSchedule: v.s === true, ownerIds: v.o.filter((x): x is string => typeof x === "string") };
  } catch {
    return null;
  }
}
