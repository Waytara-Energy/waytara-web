"use server";

import { redirect } from "next/navigation";
import { createClient } from "@waytara/supabase/server";

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    redirect(`/forgot-password?error=${encodeURIComponent("Enter your email address.")}`);
  }

  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  // Supabase's own resetPasswordForEmail doesn't error on an email that
  // has no account — it just doesn't send anything. Never branch the UI
  // on the result, so this page can't be used to check which emails are
  // registered.
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent("/reset-password")}`,
  });

  redirect("/forgot-password?sent=1");
}
