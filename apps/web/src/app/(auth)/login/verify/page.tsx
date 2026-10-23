import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { createClient } from "@waytara/supabase/server";
import { needsSecondFactor } from "@/lib/mfa";
import { VerifyForm } from "./verify-form";

// The second step of signing in for someone with two-factor sign-in on: the 6-digit code from their authenticator app. Reached from the sign-in
// form and from the proxy (a session that has the password but not the code); anyone else is sent on.
export default async function VerifyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (!needsSecondFactor(aal)) redirect("/dashboard");

  return (
    <div className="flex min-h-screen items-center justify-center bg-theme-bg px-6 py-10">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border border-theme-border bg-theme-surface p-6 shadow-sm">
        <div className="space-y-3 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="size-6" />
          </span>
          <div>
            <h1 className="text-xl font-semibold text-theme-primary">Two-factor sign-in</h1>
            <p className="mt-1 text-sm text-theme-muted">Open your authenticator app and enter the 6-digit code for WayTara.</p>
          </div>
        </div>
        <VerifyForm />
        <p className="text-center text-xs text-theme-muted">
          Lost your phone? <Link href="/contact" className="text-theme-highlight hover:underline">Contact WayTara support</Link> and we will help you back in.
        </p>
      </div>
    </div>
  );
}
