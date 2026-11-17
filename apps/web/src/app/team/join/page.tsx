import type { Metadata } from "next";
import Link from "next/link";
import { maskEmail } from "@waytara/supabase/team";
import { Logo } from "@/components/shared/logo";
import { JoinForm } from "@/components/team/join-form";
import { findInvitation } from "@/lib/team-server";

// Private to one invited person: never cached, never indexed, and the address is not passed on to other sites.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Accept your invitation", robots: { index: false, follow: false }, referrer: "no-referrer" };

/**
 * Where the button in the invitation e-mail leads. The link only says which invitation it is; opening it shows the (masked) address and sends a code there, so a link that
 * reaches the wrong person lets them in no further than that. A link that is wrong, old, replaced or already used shows the same quiet page.
 */
export default async function TeamJoinPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t = "" } = await searchParams;
  const inv = await findInvitation(t);

  return (
    <div className="min-h-dvh bg-theme-bg">
      <div className="fluid-container py-6 sm:py-8">
        <Logo />
      </div>
      <main className="fluid-container pb-20 pt-10 sm:pt-16">
        <div className="mx-auto max-w-xl">
          {inv ? (
            <>
              <p className="text-sm text-theme-muted">Hi {(inv.fullName ?? "").trim().split(/\s+/)[0] || "there"}</p>
              <h1 className="mt-2 text-[clamp(1.6rem,3vw,2.2rem)] font-semibold leading-tight tracking-tight text-theme-primary">{inv.ownerName} invited you to WayTara</h1>
              <p className="mt-4 text-[15px] leading-relaxed text-theme-secondary">See their integrated energy system, with the access they gave you. It takes a minute: confirm your e-mail address, then choose a password.</p>
              <div className="mt-6">
                <JoinForm token={t} maskedEmail={maskEmail(inv.email)} />
              </div>
            </>
          ) : (
            <>
              <h1 className="text-[clamp(1.6rem,3vw,2.2rem)] font-semibold leading-tight tracking-tight text-theme-primary">This invitation is not active</h1>
              <p className="mt-4 text-[15px] leading-relaxed text-theme-secondary">
                It may have expired, been used already, or been replaced by a newer one. Ask the person who invited you to send it again. If you already created your account,{" "}
                <Link href="/login" className="text-theme-primary underline underline-offset-4">
                  sign in
                </Link>
                .
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
