"use server";

import { redirect } from "next/navigation";
import { createClient } from "@waytara/supabase/server";
import { getCurrentProfile } from "@waytara/supabase/auth";
import { isCustomerRole } from "@waytara/supabase/roles";

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
    await supabase.auth.signOut();
    redirect(
      `/login?error=${encodeURIComponent("This app is for customer accounts only.")}`
    );
  }

  redirect("/dashboard");
}
