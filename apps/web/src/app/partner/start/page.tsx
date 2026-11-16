import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/shared/logo";
import { PartnerTrackerClosed } from "@/components/partner/partner-tracker";
import { StartForm } from "@/components/partner/start-form";
import { findTrackedRecord } from "@/lib/partner-track-server";

// Private to one applicant: never cached, never indexed, and the address is not passed on to other sites.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Open your partner area", robots: { index: false, follow: false }, referrer: "no-referrer" };

/** p***@example.com: enough for the person to recognise their own address, not enough for anyone else to learn it. */
const mask = (email: string) => {
  const [local = "", domain = ""] = email.split("@");
  return `${local.slice(0, 1)}${"*".repeat(Math.max(2, Math.min(6, local.length - 1)))}@${domain}`;
};

/**
 * Where the button in the application e-mail leads. The link only says which application it is for; opening it shows the (masked) address and offers to send a code
 * there, so a link that reaches the wrong person lets them in no further than that.
 */
export default async function PartnerStartPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t = "" } = await searchParams;
  const app = await findTrackedRecord(t);
  if (!app) return <PartnerTrackerClosed />;

  return (
    <div className="min-h-dvh bg-theme-bg">
      <div className="fluid-container py-6 sm:py-8">
        <Logo />
      </div>
      <main className="fluid-container pb-20 pt-10 sm:pt-16">
        <div className="mx-auto max-w-xl">
          <p className="text-sm text-theme-muted">Hi {app.firstName}</p>
          <h1 className="mt-2 text-[clamp(1.6rem,3vw,2.2rem)] font-semibold leading-tight tracking-tight text-theme-primary">Open your partner area</h1>
          <div className="mt-6">
            {app.profileId ? (
              <p className="text-[15px] leading-relaxed text-theme-secondary">
                You already have an account.{" "}
                <Link href="/login" className="text-theme-primary underline underline-offset-4">
                  Sign in
                </Link>{" "}
                with your e-mail address and password.
              </p>
            ) : (
              <StartForm token={t} maskedEmail={mask(app.email)} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
