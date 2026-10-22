"use server";

import { redirect } from "next/navigation";
import { createClient } from "@waytara/supabase/server";
import { getCurrentProfile } from "@waytara/supabase/auth";
import { isAdminAppRole } from "@waytara/supabase/roles";

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

  if (!isAdminAppRole(profile?.role)) {
    // this device only: signOut() alone defaults to the "global" scope and would end every other device's session too
    await supabase.auth.signOut({ scope: "local" });
    redirect(
      `/login?error=${encodeURIComponent("This app is for staff accounts only.")}`
    );
  }

  redirect(profile?.role === "site_engineer" ? "/support" : "/dashboard");
}
