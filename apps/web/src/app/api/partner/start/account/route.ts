import { NextRequest, NextResponse, after } from "next/server";
import { createServiceRoleClient } from "@waytara/supabase/service-role";
import { passwordProblem } from "@waytara/supabase/partner-account";
import { isPlausibleProof } from "@waytara/supabase/partner-otp";
import { allowRequest, clientIp } from "@/lib/rate-limit";
import { SITE } from "@/lib/site";
import { fail } from "@/lib/partner-track-api";
import { findTrackedRecord } from "@/lib/partner-track-server";
import { consumeProof, proofIsValid } from "@/lib/partner-otp-server";
import { sendMail } from "@/lib/send-mail";
import { buildPartnerAccountMail } from "@/lib/partner-mail";

/**
 * Creates the partner account, after the e-mail code was right (the proof) and a password was chosen. The account is for the e-mail address on the application and
 * never for one that already has an account (so this cannot take over a customer, staff or partner account), with the least privileged role there is. The invite link
 * closes once the account exists. The browser then signs in with the password it just chose; nothing here sets a session.
 */
export async function POST(req: NextRequest) {
  try {
    if (!(await allowRequest("partner-start:account", clientIp(req.headers), 10, 60 * 60))) return fail("Too many requests. Please try again later.", 429);
    const body = (await req.json().catch(() => null)) as { token?: unknown; proof?: unknown; password?: unknown; confirm?: unknown } | null;
    const app = typeof body?.token === "string" ? await findTrackedRecord(body.token) : null;
    if (!app) return fail("This link is not active.", 404);
    if (app.profileId) return fail("You already have an account. Sign in with your e-mail address and password.", 409);
    if (!isPlausibleProof(body?.proof) || !(await proofIsValid(app.id, body.proof))) return fail("Please confirm your e-mail address again with a new code.", 403);
    const password = typeof body?.password === "string" ? body.password : "";
    const confirm = typeof body?.confirm === "string" ? body.confirm : "";
    const problem = passwordProblem(password, confirm, app.email);
    if (problem) return fail(problem, 400);

    const service = createServiceRoleClient();
    const { data: created, error: createError } = await service.auth.admin.createUser({ email: app.email, password, email_confirm: true });
    if (createError || !created.user) {
      const exists = /already|registered|exists/i.test(createError?.message ?? "");
      if (!exists) console.error("API /api/partner/start/account create user error:", createError?.message);
      return fail(exists ? "We could not create your account with this e-mail address. Please use another address, or contact us and we will help." : "We couldn't create your account. Please try again.", exists ? 409 : 500);
    }
    const userId = created.user.id;
    const { error: profileError } = await service.from("profiles").insert({ id: userId, email: app.email, full_name: app.contactName, phone: app.phone, role: "partner" });
    if (profileError) {
      console.error("API /api/partner/start/account profile error:", profileError.message);
      await service.auth.admin.deleteUser(userId);
      return fail("We couldn't create your account. Please try again.", 500);
    }
    // Tie the account to the application, and close the invite link, only if no account is tied yet (two quick submissions make one account).
    const { data: tied } = await service
      .from("partner_applications")
      .update({ profile_id: userId, account_created_at: new Date().toISOString(), access_token_hash: null, access_expires_at: null })
      .eq("id", app.id)
      .is("profile_id", null)
      .select("id")
      .maybeSingle();
    if (!tied) {
      await service.from("profiles").delete().eq("id", userId);
      await service.auth.admin.deleteUser(userId);
      return fail("Your account could not be created just now. Please try again.", 409);
    }
    await consumeProof(app.id);
    after(() => sendMail(app.email, buildPartnerAccountMail(app.contactName, `${(process.env.NEXT_PUBLIC_SITE_URL || SITE.url).replace(/\/+$/, "")}/partner/portal`)));
    return NextResponse.json({ success: true, data: { email: app.email } });
  } catch (error) {
    console.error("API /api/partner/start/account error:", error);
    return fail("Something went wrong. Please try again.", 500);
  }
}
