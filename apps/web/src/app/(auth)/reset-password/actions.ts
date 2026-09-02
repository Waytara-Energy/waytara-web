"use server";

import { redirect } from "next/navigation";
import { createClient } from "@waytara/supabase/server";

export async function setNewPassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!password || password.length < 8) {
    redirect(`/reset-password?error=${encodeURIComponent("Password must be at least 8 characters.")}`);
  }
  if (password !== confirmPassword) {
    redirect(`/reset-password?error=${encodeURIComponent("Passwords don't match.")}`);
  }

  const supabase = await createClient();

  // The recovery session (set by auth/callback exchanging the emailed
  // link's code) is what makes this allowed — no separate token/id needs
  // passing through the form, updateUser acts on whichever session this
  // request's cookies carry.
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirect(`/reset-password?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/dashboard");
}
