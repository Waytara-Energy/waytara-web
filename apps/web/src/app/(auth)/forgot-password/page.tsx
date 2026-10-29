import Link from "next/link";
import Image from "next/image";
import { HelpCircle, Phone } from "lucide-react";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { ForgotPasswordForm } from "./forgot-password-form";

const LEGAL_LINKS = [
  { label: "Terms of Service", href: "/terms" },
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Cookie Policy", href: "/cookies" },
  { label: "Warranty Policy", href: "/warranty" },
];

const HEADER_ICON_CLASS =
  "p-2 rounded-lg text-theme-primary transition-all duration-200 hover:text-theme-highlight hover:bg-theme-surface flex items-center justify-center";

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen bg-theme-bg">
      {/* Left: hero photo, theme-swapped — hidden below lg */}
      <div className="relative hidden w-1/2 lg:block">
        <Image
          src="/images/login-light.webp"
          alt="A WayTara-equipped home with rooftop solar and an EV charger, in daylight"
          fill
          priority
          sizes="50vw"
          className="theme-media-light object-cover"
        />
        <Image
          src="/images/login-dark.webp"
          alt="A WayTara-equipped home with rooftop solar and an EV charger, at night"
          fill
          priority
          sizes="50vw"
          className="theme-media-dark object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <div className="absolute bottom-12 left-12 right-12">
          <p className="text-2xl font-semibold leading-snug text-white">
            Secure password recovery.
          </p>
          <p className="mt-2 text-sm text-white/80">
            A 6-digit one-time code sent directly to your WayTara email address.
          </p>
        </div>
      </div>

      {/* Right: the verification and password reset form */}
      <div className="flex w-full flex-col lg:w-1/2">
        <header className="flex items-center justify-end gap-1 p-4">
          <Link
            href="/knowledge-centre"
            className={HEADER_ICON_CLASS}
            title="Knowledge Centre & Guides"
            aria-label="Knowledge Centre"
          >
            <HelpCircle className="h-[19px] w-[19px]" />
          </Link>
          <Link
            href="/contact"
            className={HEADER_ICON_CLASS}
            title="Contact & Engineering Support"
            aria-label="Contact Us"
          >
            <Phone className="h-[19px] w-[19px]" />
          </Link>
          <ThemeToggle className={HEADER_ICON_CLASS} />
        </header>

        <main className="flex flex-1 items-center justify-center px-6 py-8">
          <ForgotPasswordForm />
        </main>

        <footer className="flex flex-col items-center justify-between gap-3 border-t border-theme-border px-6 py-4 text-xs text-theme-muted sm:flex-row">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            {LEGAL_LINKS.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="hover:text-theme-primary hover:underline"
              >
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
