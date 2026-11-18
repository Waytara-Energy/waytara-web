"use server";

import { revalidatePath } from "next/cache";
import { requireCustomer } from "@waytara/supabase/auth";
import { createServiceRoleClient } from "@waytara/supabase/service-role";
import { newAccessToken } from "@waytara/supabase/partner-access";
import { TEAM_INVITE_DAYS, TEAM_MAX_MEMBERS, checkAccess, checkInvite, type TeamAccessInput } from "@waytara/supabase/team";
import { escapeLike } from "@/lib/like-escape";
import { getCustomerSites } from "@/lib/selected-site";
import { getTeamAccess, teamJoinLink, teamSignInUrl } from "@/lib/team-server";
import { sendMail, type MailResult } from "@/lib/send-mail";
import { buildTeamInviteMail, buildTeamSharedMail, type TeamAccessSummary } from "@/lib/team-mail";

// What the owner does on the Team tab of Application Settings, and what a SUPER USER may do there for the owner who made them one. Every action re-checks who is asking
// (the account's owner, or a super user of it: never an ordinary member), takes the devices from the owner's OWN sites on the server (whatever the browser sends), writes
// with the server's key only after those checks, and answers with a plain result (a server action's thrown message is hidden in production, so a refusal is returned, not
// thrown). A super user can invite people, change their access and make others super users, but only the owner can change, suspend or remove a super user.

export type TeamResult = { ok: true; message: string } | { ok: false; error: string };
const fail = (error: string): TeamResult => ({ ok: false, error });

const expiry = () => new Date(Date.now() + TEAM_INVITE_DAYS * 24 * 60 * 60 * 1000).toISOString();
const ONLY_OWNER = "Only the account owner can change a super user.";

async function ownerContext() {
  const profile = await requireCustomer();
  const access = await getTeamAccess();
  let ownerId = profile.id;
  let actor: "owner" | "super" = "owner";
  if (access.kind === "member") {
    // an ordinary member manages nothing; a super user acts for the owner who made them one
    if (!access.superUser || !access.ownerIds[0]) return null;
    ownerId = access.ownerIds[0];
    actor = "super";
  }
  const db = createServiceRoleClient();
  const { data: ownerRow } = actor === "owner" ? { data: { email: profile.email, full_name: profile.full_name } } : await db.from("profiles").select("email, full_name").eq("id", ownerId).maybeSingle();
  // the devices this account may share: the monitored devices of the sites that are the OWNER'S (a site shared with them by someone else is not theirs to share on)
  const owned = new Set<string>();
  for (const s of await getCustomerSites()) if (s.ownerId === ownerId) for (const d of s.devices) owned.add(d.id);
  return { profile, ownerId, actor, owner: { email: ownerRow?.email ?? "", name: ownerRow?.full_name ?? "" }, owned, db };
}

const summaryOf = (a: TeamAccessInput): TeamAccessSummary => ({
  role: a.role,
  deviceCount: a.devices.length,
  operateCount: a.devices.filter((d) => d.level === "operate").length,
  pageCount: a.pages.length,
  canSchedule: a.canSchedule,
});

const mailNote = (r: MailResult, to: string): string => (r === "sent" ? ` We e-mailed ${to}.` : r === "suppressed" ? " (E-mail is not set up on this server, so nothing was sent.)" : " The e-mail could not be sent just now: use Send again.");

/** Invites someone: an e-mail with a link (a new account) or, if that address already has a customer account, the access is added and they are told to sign in. */
export async function inviteTeamMember(input: unknown): Promise<TeamResult> {
  const ctx = await ownerContext();
  if (!ctx) return fail("Only the account owner can manage the team.");
  const checked = checkInvite(input, { ownEmail: ctx.owner.email, owned: ctx.owned });
  if (!checked.ok) return fail(checked.error);
  const v = checked.value;
  const { db } = ctx;
  if (v.email === (ctx.profile.email ?? "").trim().toLowerCase()) return fail("That is your own e-mail address.");

  const { count } = await db.from("team_members").select("id", { count: "exact", head: true }).eq("owner_id", ctx.ownerId);
  if ((count ?? 0) >= TEAM_MAX_MEMBERS) return fail(`A team can have up to ${TEAM_MAX_MEMBERS} people. Remove someone first.`);

  const { data: existing } = await db.from("profiles").select("id, role").ilike("email", escapeLike(v.email)).maybeSingle();
  if (existing && existing.role !== "customer") return fail("That e-mail address belongs to a different kind of WayTara account, so it cannot be added to a team. Please use another address.");
  if (existing && (existing.id === ctx.ownerId || existing.id === ctx.profile.id)) return fail("That is already the account's owner or your own address.");

  const now = new Date().toISOString();
  const token = existing ? null : newAccessToken();
  const { data: row, error } = await db
    .from("team_members")
    .insert({
      owner_id: ctx.ownerId,
      user_id: existing?.id ?? null,
      email: v.email,
      full_name: v.fullName,
      role: v.role,
      pages: v.pages,
      can_schedule: v.canSchedule,
      status: existing ? "active" : "invited",
      accepted_at: existing ? now : null,
      access_token_hash: token?.hash ?? null,
      access_expires_at: token ? expiry() : null,
      last_sent_at: now,
    })
    .select("id")
    .single();
  if (error || !row) return fail(error?.code === "23505" ? "That person is already on your team." : "We couldn't save the invitation. Please try again.");

  // a super user has no device list (the database gives them every device, new ones too)
  if (v.devices.length > 0) {
    const { error: devicesError } = await db.from("team_member_devices").insert(v.devices.map((d) => ({ member_id: row.id, equipment_id: d.equipmentId, level: d.level })));
    if (devicesError) {
      await db.from("team_members").delete().eq("id", row.id);
      return fail("We couldn't save the invitation. Please try again.");
    }
  }

  const ownerName = ctx.owner.name;
  const mail = token
    ? buildTeamInviteMail({ memberName: v.fullName, ownerName, summary: summaryOf(v), link: await teamJoinLink(token.token) })
    : buildTeamSharedMail({ memberName: v.fullName, ownerName, summary: summaryOf(v), signInUrl: teamSignInUrl() });
  const sent = await sendMail(v.email, mail);
  revalidatePath("/dashboard/settings");
  return { ok: true, message: `${existing ? `${v.email} already has a WayTara account, so the access was added.` : `Invitation made for ${v.email}.`}${mailNote(sent, v.email)}` };
}

/** Changes what a person can see and do: their role label, pages, schedule switch and devices (each with its level). Takes effect at their next page load. */
export async function updateTeamMember(memberId: string, input: unknown): Promise<TeamResult> {
  const ctx = await ownerContext();
  if (!ctx) return fail("Only the account owner can manage the team.");
  const { db } = ctx;
  const { data: member } = await db.from("team_members").select("id, role").eq("id", memberId).eq("owner_id", ctx.ownerId).maybeSingle();
  if (!member) return fail("That person is not on your team.");
  if (ctx.actor === "super" && member.role === "super") return fail(ONLY_OWNER);
  const checked = checkAccess(input, ctx.owned);
  if (!checked.ok) return fail(checked.error);
  const a = checked.value;

  const { error } = await db.from("team_members").update({ full_name: a.fullName, role: a.role, pages: a.pages, can_schedule: a.canSchedule }).eq("id", memberId);
  if (error) return fail("We couldn't save the changes. Please try again.");
  // the new device list: add or change first, then drop what is no longer given, so a failure never leaves the person with less than they had
  // (a super user has none: they are given every device by the database)
  if (a.devices.length > 0) {
    const { error: upsertError } = await db.from("team_member_devices").upsert(a.devices.map((d) => ({ member_id: memberId, equipment_id: d.equipmentId, level: d.level })), { onConflict: "member_id,equipment_id" });
    if (upsertError) return fail("We couldn't save the devices. Please try again.");
  }
  const keep = a.devices.map((d) => d.equipmentId);
  const drop = keep.length > 0 ? db.from("team_member_devices").delete().eq("member_id", memberId).not("equipment_id", "in", `(${keep.join(",")})`) : db.from("team_member_devices").delete().eq("member_id", memberId);
  const { error: dropError } = await drop;
  if (dropError) return fail("The devices were updated, but some removed ones could not be taken away. Please save again.");
  revalidatePath("/dashboard/settings");
  return { ok: true, message: a.role === "super" ? "Saved. They are now a super user: everything, like you." : "Saved. The change applies the next time they open a page." };
}

/** Sends an invitation again, with a new link (the earlier link stops working). */
export async function resendTeamInvite(memberId: string): Promise<TeamResult> {
  const ctx = await ownerContext();
  if (!ctx) return fail("Only the account owner can manage the team.");
  const { db } = ctx;
  const { data: m } = await db.from("team_members").select("id, email, full_name, role, pages, can_schedule, status, user_id, last_sent_at").eq("id", memberId).eq("owner_id", ctx.ownerId).maybeSingle();
  if (!m) return fail("That person is not on your team.");
  if (ctx.actor === "super" && m.role === "super") return fail(ONLY_OWNER);
  if (m.status !== "invited" || m.user_id) return fail("This person has already joined.");
  if (m.last_sent_at && Date.now() - new Date(m.last_sent_at).getTime() < 60_000) return fail("An invitation was just sent. Please wait a minute before sending it again.");
  const { data: devices } = await db.from("team_member_devices").select("level").eq("member_id", memberId);

  const token = newAccessToken();
  const { error } = await db.from("team_members").update({ access_token_hash: token.hash, access_expires_at: expiry(), last_sent_at: new Date().toISOString() }).eq("id", memberId).eq("status", "invited").is("user_id", null);
  if (error) return fail("We couldn't send it just now. Please try again.");
  const summary: TeamAccessSummary = { role: m.role, deviceCount: devices?.length ?? 0, operateCount: (devices ?? []).filter((d) => d.level === "operate").length, pageCount: m.pages.length, canSchedule: m.can_schedule };
  const sent = await sendMail(m.email, buildTeamInviteMail({ memberName: m.full_name, ownerName: ctx.owner.name, summary, link: await teamJoinLink(token.token) }));
  revalidatePath("/dashboard/settings");
  return { ok: sent !== "failed", ...(sent === "failed" ? { error: "The e-mail could not be sent just now. Please try again." } : { message: `Sent again to ${m.email}.${mailNote(sent, m.email).replace(` We e-mailed ${m.email}.`, "")}` }) } as TeamResult;
}

/** Suspends a person (they keep their account but see nothing) or lets them back in. */
export async function setTeamMemberStatus(memberId: string, status: "active" | "suspended"): Promise<TeamResult> {
  const ctx = await ownerContext();
  if (!ctx) return fail("Only the account owner can manage the team.");
  if (status !== "active" && status !== "suspended") return fail("That is not a valid choice.");
  if (ctx.actor === "super") {
    const { data: target } = await ctx.db.from("team_members").select("role").eq("id", memberId).eq("owner_id", ctx.ownerId).maybeSingle();
    if (target?.role === "super") return fail(ONLY_OWNER);
  }
  const { data, error } = await ctx.db.from("team_members").update({ status }).eq("id", memberId).eq("owner_id", ctx.ownerId).not("user_id", "is", null).select("id").maybeSingle();
  if (error || !data) return fail("We couldn't change that. Only someone who has joined can be suspended.");
  revalidatePath("/dashboard/settings");
  return { ok: true, message: status === "suspended" ? "Suspended. They can no longer see your system." : "They have access again." };
}

/** Removes a person from the team (or cancels an invitation that has not been used). Their own account is not deleted. */
export async function removeTeamMember(memberId: string): Promise<TeamResult> {
  const ctx = await ownerContext();
  if (!ctx) return fail("Only the account owner can manage the team.");
  if (ctx.actor === "super") {
    const { data: target } = await ctx.db.from("team_members").select("role").eq("id", memberId).eq("owner_id", ctx.ownerId).maybeSingle();
    if (target?.role === "super") return fail(ONLY_OWNER);
  }
  const { data, error } = await ctx.db.from("team_members").delete().eq("id", memberId).eq("owner_id", ctx.ownerId).select("id").maybeSingle();
  if (error || !data) return fail("We couldn't remove that person. Please try again.");
  revalidatePath("/dashboard/settings");
  return { ok: true, message: "Removed. They can no longer see your system." };
}
