import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Footer } from "@/components/sections/footer";
import { Navigation } from "@/components/sections/navigation";
import { findSessionRecord } from "@/lib/partner-track-server";

// A partner's own pages: private, never cached or indexed. Only a signed-in partner account that is tied to an application gets in; anyone else goes to the sign-in page.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your partner area", robots: { index: false, follow: false } };

export default async function PartnerPortalLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const record = await findSessionRecord();
  if (!record) redirect("/login");
  return (
    <div className="flex min-h-screen flex-col bg-theme-bg text-theme-primary">
      <Navigation />
      <div className="flex-1 pt-[clamp(6.5rem,10vw,9rem)]">{children}</div>
      <Footer />
    </div>
  );
}
