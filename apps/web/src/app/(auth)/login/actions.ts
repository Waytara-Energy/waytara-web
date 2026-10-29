"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@waytara/supabase/server";
import { getCurrentProfile } from "@waytara/supabase/auth";
import { isCustomerRole } from "@waytara/supabase/roles";
import { notifyAuthEvent } from "@/lib/auth-notify";
import { needsSecondFactor } from "@/lib/mfa";
import { parseStartPage, startPath } from "@/lib/start-page";

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    redirect(`/login?error=${encodeURIComponent("Email and password are required.")}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  const profile = await getCurrentProfile(supabase);

  if (!isCustomerRole(profile?.role)) {
    // this device only: signOut() alone defaults to the "global" scope and would end every other device's session too
    await supabase.auth.signOut({ scope: "local" });
    redirect(
      `/login?error=${encodeURIComponent("This app is for customer accounts only.")}`
    );
  }

  // A new sign-in starts with the sidebar closed, whatever it was left at last time (the toggle remembers its state in this cookie for a week).
  (await cookies()).set("sidebar_state", "false", { path: "/", maxAge: 60 * 60 * 24 * 7 });

  // someone with two-factor sign-in on owes a code before anything else: the sign-in is recorded and e-mailed once it has been given
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (needsSecondFactor(aal)) redirect("/login/verify");

  // tell the person about the sign-in (if they want that e-mail); it is sent after the redirect, so it does not slow it down
  if (profile) await notifyAuthEvent("signin", profile);

  // open on the page the person chose in Settings (the Overview unless they chose another)
  redirect(startPath(parseStartPage(profile?.ui_preferences)));
}
