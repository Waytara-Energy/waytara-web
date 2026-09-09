import Link from "next/link";
import { Input } from "@waytara/ui/input";
import { cn } from "@waytara/ui/cn";
import { AUTH_INPUT_CLASSNAME } from "@/components/password-input";
import { SubmitButton } from "@/components/submit-button";
import { requestPasswordReset } from "./actions";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { error, sent } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-16">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-foreground">Reset your password</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter your account email and we&apos;ll send you a link to set a new one.
          </p>
        </div>

        {error ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {sent ? (
          <div className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary">
            If an account exists for that email, a reset link is on its way — check your inbox.
          </div>
        ) : (
          <form action={requestPasswordReset} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium text-foreground">
                Email
              </label>
              <Input id="email" name="email" type="email" autoComplete="email" required className={cn(AUTH_INPUT_CLASSNAME)} />
            </div>
            <SubmitButton className="w-full">Send reset link</SubmitButton>
          </form>
        )}

        <p className="text-center text-xs text-muted-foreground">
          <Link href="/login" className="text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
