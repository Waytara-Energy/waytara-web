import Link from "next/link";
import { LifeBuoy } from "lucide-react";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { SecurityShowcase } from "@/components/auth/security-showcase";
import { ForgotPasswordForm } from "./forgot-password-form";

const HEADER_ICON_CLASS =
  "p-2 rounded-lg text-theme-primary transition-all duration-200 hover:text-theme-highlight hover:bg-theme-surface flex items-center justify-center";

/** Password recovery: the same layout as the sign-in page. On the left, how the account is protected; on the right, the three steps. Phones get the steps only. */
export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen bg-theme-bg">
      <SecurityShowcase />

      <div className="flex w-full flex-col lg:w-1/2">
        <header className="flex items-center justify-end gap-1 p-4">
          <Link href="/support" className={HEADER_ICON_CLASS} title="Support" aria-label="Support">
            <LifeBuoy className="h-[19px] w-[19px]" />
          </Link>
          <ThemeToggle className={HEADER_ICON_CLASS} />
        </header>

        <main className="flex flex-1 items-center justify-center px-6 py-8">
          <ForgotPasswordForm />
        </main>
      </div>
    </div>
  );
}
