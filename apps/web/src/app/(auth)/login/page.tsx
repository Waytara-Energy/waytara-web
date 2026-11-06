import Link from "next/link";
import { LifeBuoy } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { SubmitButton } from "@/components/ui/submit-button";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { ToastFromSearchParams } from "@/components/dashboard/toast-from-search-params";
import { LoginFlow, LoginShowcase } from "@/components/auth/login-showcase";
import { login } from "./actions";

const HEADER_ICON_CLASS =
  "p-2 rounded-lg text-theme-primary transition-all duration-200 hover:text-theme-highlight hover:bg-theme-surface flex items-center justify-center";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ email?: string; error?: string; success?: string }>;
}) {
  const params = await searchParams;
  const prefillEmail = params?.email ?? "";

  return (
    <div className="flex min-h-screen bg-theme-bg">
      {/* Left: the application, five slides (wide screens only) */}
      <LoginShowcase />

      {/* Right: the actual sign-in form (on a phone, after the five slides unless the visitor needs the form at once) */}
      <LoginFlow skipIntro={Boolean(params?.error || params?.success || params?.email)}>
        <header className="flex items-center justify-end gap-1 p-4">
          <Link href="/support" className={HEADER_ICON_CLASS} title="Support" aria-label="Support">
            <LifeBuoy className="h-[19px] w-[19px]" />
          </Link>
          <ThemeToggle className={HEADER_ICON_CLASS} />
        </header>

        <main className="flex flex-1 items-center justify-center px-6 py-8">
          <div className="w-full max-w-sm space-y-6">
            <div>
              <h1 className="text-2xl font-semibold text-theme-primary">Sign in to WayTara</h1>
              <p className="mt-1 text-sm text-theme-muted">
                Track your system, payments, and support in one place.
              </p>
            </div>

            <ToastFromSearchParams />

            <form action={login} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" autoComplete="email" defaultValue={prefillEmail} required />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link href="/forgot-password" className="text-xs font-medium text-theme-highlight hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <PasswordInput id="password" name="password" autoComplete="current-password" required />
              </div>
              <SubmitButton className="w-full" pendingText="Signing in…">
                Sign in
              </SubmitButton>
            </form>

            <p className="text-center text-xs text-theme-muted">
              New to WayTara?{" "}
              <Link href="/planner" className="text-theme-highlight hover:underline">
                Plan your system
              </Link>{" "}
              and our team will get in touch.
            </p>
          </div>
        </main>
      </LoginFlow>
    </div>
  );
}
