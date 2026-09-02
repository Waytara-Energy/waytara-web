import { createClient } from "@waytara/supabase/server";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { setNewPassword } from "./actions";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="fluid-container flex min-h-screen items-center justify-center py-16">
        <div className="max-w-sm space-y-2 text-center">
          <h1 className="text-xl font-semibold text-theme-primary">This reset link is invalid</h1>
          <p className="text-sm text-theme-muted">
            It may have already been used, or the link is incorrect. Request a new one from the sign-in
            page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fluid-container flex min-h-screen items-center justify-center py-16">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-theme-primary">Set a new password</h1>
          <p className="mt-1 text-sm text-theme-muted">Choose a new password for your account.</p>
        </div>

        {error ? (
          <div className="rounded-lg border border-theme-border bg-theme-alert-subtle px-4 py-3 text-sm text-theme-alert">
            {error}
          </div>
        ) : null}

        <form action={setNewPassword} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="password">New password</Label>
            <PasswordInput id="password" name="password" autoComplete="new-password" minLength={8} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <PasswordInput
              id="confirmPassword"
              name="confirmPassword"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          <Button type="submit" className="w-full">
            Update password
          </Button>
        </form>
      </div>
    </div>
  );
}
