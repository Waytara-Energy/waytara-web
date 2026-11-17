import { NextRequest, NextResponse, after } from "next/server";
import { createServiceRoleClient } from "@waytara/supabase/service-role";
import { passwordProblem } from "@waytara/supabase/partner-account";
import { isPlausibleProof } from "@waytara/supabase/partner-otp";
import { allowRequest, clientIp } from "@/lib/rate-limit";
import { escapeLike } from "@/lib/like-escape";
import { fail } from "@/lib/partner-track-api";
import { findInvitation, teamSignInUrl } from "@/lib/team-server";
import { consumeTeamProof, teamProofIsValid } from "@/lib/team-otp-server";
import { sendMail } from "@/lib/send-mail";
import { buildTeamWelcomeMail } from "@/lib/team-mail";

/**
 * Makes the team member's account, after the e-mail code was right (the proof) and a password was chosen. The account is for the address the invitation was made for, with
 * the ordinary customer role: what they can SEE is decided by the access the owner gave them, not by the account. If that address already has a customer account (made
 * after the invitation was sent), the membership is tied to that account instead, and nothing is created (the person proved they own the address with the code, but a
 * password is never changed here). An account of any other kind (staff, partner) is never touched. The invitation link closes once it is used.
 */
export async function POST(req: NextRequest) {
  try {
    if (!(await allowRequest("team-join:account", clientIp(req.headers), 10, 60 * 60))) return fail("Too many requests. Please try again later.", 429);
    const body = (await req.json().catch(() => null)) as { token?: unknown; proof?: unknown; password?: unknown; confirm?: unknown } | null;
    const inv = typeof body?.token === "string" ? await findInvitation(body.token) : null;
    if (!inv) return fail("This invitation is not active. Ask the person who invited you to send it again.", 404);
    if (!isPlausibleProof(body?.proof) || !(await teamProofIsValid(inv.id, body.proof))) return fail("Please confirm your e-mail address again with a new code.", 403);
    const password = typeof body?.password === "string" ? body.password : "";
    const confirm = typeof body?.confirm === "string" ? body.confirm : "";
    const problem = passwordProblem(password, confirm, inv.email);
    if (problem) return fail(problem, 400);

    const service = createServiceRoleClient();
    const now = new Date().toISOString();
    // closes the invitation and ties it to an account, only if it is still waiting (two quick submissions make one account)
    const accept = async (userId: string) =>
      (
        await service
          .from("team_members")
          .update({ user_id: userId, status: "active", accepted_at: now, access_token_hash: null, access_expires_at: null })
          .eq("id", inv.id)
          .eq("status", "invited")
          .is("user_id", null)
          .select("id")
          .maybeSingle()
      ).data;

    const { data: existing } = await service.from("profiles").select("id, role").ilike("email", escapeLike(inv.email)).maybeSingle();
    if (existing) {
      if (existing.role !== "customer") return fail("This e-mail address belongs to a different kind of WayTara account, so it cannot join a team. Please ask to be invited with another address.", 409);
      if (!(await accept(existing.id))) return fail("This invitation is no longer active.", 409);
      await consumeTeamProof(inv.id);
      return NextResponse.json({ success: true, data: { email: inv.email, existing: true } });
    }

    const { data: created, error: createError } = await service.auth.admin.createUser({ email: inv.email, password, email_confirm: true });
    if (createError || !created.user) {
      const exists = /already|registered|exists/i.test(createError?.message ?? "");
      if (!exists) console.error("API /api/team/join/account create user error:", createError?.message);
      return fail(exists ? "An account with this e-mail address already exists. Sign in with it instead." : "We couldn't create your account. Please try again.", exists ? 409 : 500);
    }
    const userId = created.user.id;
    const { error: profileError } = await service.from("profiles").insert({ id: userId, email: inv.email, full_name: inv.fullName, role: "customer" });
    if (profileError) {
      console.error("API /api/team/join/account profile error:", profileError.message);
      await service.auth.admin.deleteUser(userId);
      return fail("We couldn't create your account. Please try again.", 500);
    }
    if (!(await accept(userId))) {
      await service.from("profiles").delete().eq("id", userId);
      await service.auth.admin.deleteUser(userId);
      return fail("Your account could not be created just now. Please try again.", 409);
    }
    await consumeTeamProof(inv.id);
    after(() => sendMail(inv.email, buildTeamWelcomeMail({ memberName: inv.fullName, ownerName: inv.ownerName, signInUrl: teamSignInUrl() })));
    return NextResponse.json({ success: true, data: { email: inv.email, existing: false } });
  } catch (error) {
    console.error("API /api/team/join/account error:", error instanceof Error ? error.message : "unknown");
    return fail("Something went wrong. Please try again.", 500);
  }
}
