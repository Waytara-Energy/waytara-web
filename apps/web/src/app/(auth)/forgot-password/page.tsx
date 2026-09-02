import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { requestPasswordReset } from "./actions";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { error, sent } = await searchParams;

  return (
    <div className="fluid-container flex min-h-screen items-center justify-center py-16">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-theme-primary">Reset your password</h1>
          <p className="mt-1 text-sm text-theme-muted">
            Enter your account email and we&apos;ll send you a link to set a new one.
          </p>
        </div>

        {error ? (
          <div className="rounded-lg border border-theme-border bg-theme-alert-subtle px-4 py-3 text-sm text-theme-alert">
            {error}
          </div>
        ) : null}

        {sent ? (
          <div className="rounded-lg border border-theme-border bg-theme-highlight-subtle px-4 py-3 text-sm text-theme-highlight">
            If an account exists for that email, a reset link is on its way — check your inbox.
          </div>
        ) : (
          <form action={requestPasswordReset} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required />
            </div>
            <Button type="submit" className="w-full">
              Send reset link
            </Button>
          </form>
        )}

        <p className="text-center text-xs text-theme-muted">
          <Link href="/login" className="text-theme-highlight hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
