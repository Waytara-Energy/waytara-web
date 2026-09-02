import Link from "next/link";
import Image from "next/image";
import { HelpCircle, Phone } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { login } from "./actions";

const LEGAL_LINKS = [
  { label: "Terms of Service", href: "/knowledge-centre" },
  { label: "Privacy Policy", href: "/knowledge-centre" },
  { label: "Cookie Policy", href: "/knowledge-centre" },
  { label: "Warranty Policy", href: "/knowledge-centre" },
];

const HEADER_ICON_CLASS =
  "p-2 rounded-lg text-theme-primary transition-all duration-200 hover:text-theme-highlight hover:bg-theme-surface flex items-center justify-center";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex min-h-screen bg-theme-bg">
      {/* Left: hero photo, theme-swapped — hidden below lg so the form gets
          full width on mobile rather than squeezing next to a cropped photo. */}
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
            Your energy system, always within reach.
          </p>
          <p className="mt-2 text-sm text-white/80">
            Monitor output, manage payments, and get support — all from one dashboard.
          </p>
        </div>
      </div>

      {/* Right: the actual sign-in form */}
      <div className="flex w-full flex-col lg:w-1/2">
        <header className="flex items-center justify-end gap-1 p-4">
          <Link href="/knowledge-centre" className={HEADER_ICON_CLASS} title="Knowledge Centre & Guides" aria-label="Knowledge Centre">
            <HelpCircle className="h-[19px] w-[19px]" />
          </Link>
          <Link href="/contact" className={HEADER_ICON_CLASS} title="Contact & Engineering Support" aria-label="Contact Us">
            <Phone className="h-[19px] w-[19px]" />
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
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link href="/forgot-password" className="text-xs font-medium text-theme-highlight hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <PasswordInput id="password" name="password" autoComplete="current-password" required />
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
        </main>

        <footer className="flex flex-col items-center justify-between gap-3 border-t border-theme-border px-6 py-4 text-xs text-theme-muted sm:flex-row">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            {LEGAL_LINKS.map((link) => (
              <Link key={link.label} href={link.href} className="hover:text-theme-primary hover:underline">
                {link.label}
              </Link>
            ))}
          </div>
          <p>© {new Date().getFullYear()} WayTara Energy LLP. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
}
