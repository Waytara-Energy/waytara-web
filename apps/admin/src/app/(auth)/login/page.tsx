import Image from "next/image";
import Link from "next/link";
import { Input } from "@waytara/ui/input";
import { cn } from "@waytara/ui/cn";
import { AUTH_INPUT_CLASSNAME, PasswordInput } from "@/components/password-input";
import { SubmitButton } from "@/components/submit-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { login } from "./actions";

const HEADER_ICON_CLASS =
  "p-2 rounded-lg text-foreground transition-all duration-200 hover:bg-accent flex items-center justify-center";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex min-h-screen bg-background">
      {/* Left: hero photo, theme-swapped — hidden below lg so the form gets
          full width on mobile rather than squeezing next to a cropped photo.
          Same house photography as the customer login page — one brand,
          shown here from the operations side rather than the resident's. */}
      <div className="relative hidden w-1/2 lg:block">
        <Image
          src="/images/login-light.png"
          alt="A WayTara-equipped home with rooftop solar and an EV charger, in daylight"
          fill
          priority
          sizes="50vw"
          className="theme-media-light object-cover"
        />
        <Image
          src="/images/login-dark.png"
          alt="A WayTara-equipped home with rooftop solar and an EV charger, at night"
          fill
          priority
          sizes="50vw"
          className="theme-media-dark object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <div className="absolute bottom-12 left-12 right-12">
          <p className="text-2xl font-semibold leading-snug text-white">
            Every customer&apos;s system, in one place.
          </p>
          <p className="mt-2 text-sm text-white/80">
            Monitoring, installs, support, and billing — the full operations view.
          </p>
        </div>
      </div>

      {/* Right: the actual sign-in form */}
      <div className="flex w-full flex-col lg:w-1/2">
        <header className="flex items-center justify-end p-4">
          <ThemeToggle className={HEADER_ICON_CLASS} />
        </header>

        <main className="flex flex-1 items-center justify-center px-6 py-8">
          <div className="w-full max-w-sm space-y-6">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">WayTara Admin</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Staff sign in — admin &amp; employee accounts only.
              </p>
            </div>

            {error ? (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            <form action={login} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="email" className="text-sm font-medium text-foreground">
                  Email
                </label>
                <Input id="email" name="email" type="email" autoComplete="email" required className={cn(AUTH_INPUT_CLASSNAME)} />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="text-sm font-medium text-foreground">
                    Password
                  </label>
                  <Link href="/forgot-password" className="text-xs font-medium text-primary hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <PasswordInput id="password" name="password" autoComplete="current-password" required />
              </div>
              <SubmitButton className="w-full" pendingText="Signing in…">
                Sign in
              </SubmitButton>
            </form>
          </div>
        </main>

        <footer className="flex items-center justify-center border-t border-border px-6 py-4 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} WayTara Energy LLP. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
}
