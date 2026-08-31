import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="fluid-container flex min-h-screen items-center justify-center py-16">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-theme-primary">
            Sign in to WayTara
          </h1>
          <p className="mt-1 text-sm text-theme-muted">
            Track your system, payments, and support in one place.
          </p>
        </div>

        {error ? (
          <div className="rounded-lg border border-theme-border bg-theme-alert-subtle px-4 py-3 text-sm text-theme-alert">
            {error}
          </div>
        ) : null}

        <form action={login} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          <Button type="submit" className="w-full">
            Sign in
          </Button>
        </form>

        <p className="text-center text-xs text-theme-muted">
          New customers get account access from the invite link sent by their
          WayTara advisor after onboarding —{" "}
          <Link href="/contact" className="text-theme-highlight hover:underline">
            contact us
          </Link>{" "}
          if you haven&apos;t received one.
        </p>
      </div>
    </div>
  );
}
