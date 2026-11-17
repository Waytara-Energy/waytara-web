import type { Metadata } from "next";
import { Logo } from "@/components/shared/logo";

export const metadata: Metadata = { title: "Back to your application", robots: { index: false, follow: false }, referrer: "no-referrer" };

/**
 * Where DigiLocker sends a person once they have agreed (or declined) on its page. It carries nothing and shows nothing about them: the application page they came from
 * asks for the result itself, so this only tells them to go back to it.
 */
export default function DigilockerDonePage() {
  return (
    <div className="min-h-dvh bg-theme-bg">
      <div className="fluid-container py-6 sm:py-8">
        <Logo />
      </div>
      <main className="fluid-container pb-20 pt-6 sm:pt-12">
        <div className="mx-auto max-w-xl text-center">
          <h1 className="text-[clamp(1.5rem,3vw,2rem)] font-semibold leading-tight tracking-tight text-theme-primary">You are done on DigiLocker</h1>
          <p className="mt-4 leading-relaxed text-theme-secondary">You can close this tab and go back to your application. It will show your details in a few seconds.</p>
        </div>
      </main>
    </div>
  );
}
