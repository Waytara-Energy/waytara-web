import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@waytara/supabase/service-role";
import { passwordProblem } from "@waytara/supabase/partner-account";
import { allowRequest, clientIp } from "@/lib/rate-limit";
import { adminSignInUrl, fail } from "@/lib/partner-track-api";
import { findTrackedRecord } from "@/lib/partner-track-server";
import { sendMail } from "@/lib/send-mail";
import { buildPartnerAccountMail } from "@/lib/partner-mail";

const schema = z.object({ password: z.string().max(200), confirm: z.string().max(200) });

/**
 * The last step of an approved application: the applicant chooses a password and gets their partner account. The private link is what proves who they are (the one
 * the approval e-mail carried), and it stops working the moment the account exists. The account is created for the e-mail address on the application and never for
 * one that already has an account (so this can never be used to take over a staff, customer or partner account), with the least privileged role there is.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    if (!(await allowRequest("partner-track:account", clientIp(req.headers), 10, 60 * 60))) return fail("Too many requests. Please try again later.", 429);
    const app = await findTrackedRecord(token);
    if (!app) return fail("This link is not active.", 404);
    if (app.status !== "approved") return fail("Your application is not approved yet.", 409);
    if (app.profileId) return fail("Your account has already been created. Sign in with your e-mail address and password.", 409);

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail("Please enter your password twice.", 400);
    const problem = passwordProblem(parsed.data.password, parsed.data.confirm, app.email);
    if (problem) return fail(problem, 400);

    const service = createServiceRoleClient();
    const { data: created, error: createError } = await service.auth.admin.createUser({ email: app.email, password: parsed.data.password, email_confirm: true });
    if (createError || !created.user) {
      // An account for this address already exists (a customer or a member of staff, say). It is never touched, and nothing about it is said.
      const exists = /already|registered|exists/i.test(createError?.message ?? "");
      if (!exists) console.error("API /api/partner/track/account create user error:", createError?.message);
      return fail(exists ? "We could not create your account with this e-mail address. Please contact us and we will help." : "We couldn't create your account. Please try again.", exists ? 409 : 500);
    }
    const userId = created.user.id;
    const undo = async () => {
      await service.from("profiles").delete().eq("id", userId);
      await service.auth.admin.deleteUser(userId);
    };

    const { error: profileError } = await service.from("profiles").insert({ id: userId, email: app.email, full_name: app.contactName, phone: app.phone, role: "partner" });
    if (profileError) {
      console.error("API /api/partner/track/account profile error:", profileError.message);
      await service.auth.admin.deleteUser(userId);
      return fail("We couldn't create your account. Please try again.", 500);
    }

    // Tie the account to the application, and close the link, in one step that only works if no account is tied yet (so two quick submissions make one account).
    const { data: tied, error: tieError } = await service
      .from("partner_applications")
      .update({ profile_id: userId, account_created_at: new Date().toISOString(), access_token_hash: null, access_expires_at: null })
      .eq("id", app.id)
      .eq("status", "approved")
      .is("profile_id", null)
      .select("id")
      .maybeSingle();
    if (tieError || !tied) {
      if (tieError) console.error("API /api/partner/track/account tie error:", tieError.message);
      await undo();
      return fail("Your account could not be created just now. Please try again.", 409);
    }

    after(() => sendMail(app.email, buildPartnerAccountMail(app.contactName, adminSignInUrl())));
    return NextResponse.json({ success: true, data: { signInUrl: adminSignInUrl() } });
  } catch (error) {
    console.error("API /api/partner/track/account error:", error);
    return fail("Something went wrong. Please try again.", 500);
  }
}
