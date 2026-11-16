import { logout } from "@/app/(dashboard)/actions";
import { Button } from "@/components/ui/button";
import { requirePartner } from "@/lib/partner-context";
import { PartnerNav } from "./partner-nav";

// The partner area: a partner (an approved applicant) sees only these pages. proxy.ts sends them nowhere else, and every page here asks requirePartner() who they are
// and reads only their own application. No sidebar, no counts, none of the staff pages.
export default async function PartnerLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { application } = await requirePartner();
  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          {/* eslint-disable-next-line @next/next/no-img-element -- a small fixed logo */}
          <img src="/images/logo.png" alt="WayTara" className="h-7 w-auto" />
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden truncate text-muted-foreground sm:inline">{application.company_name}</span>
            <form action={logout}>
              <Button type="submit" size="sm" variant="outline">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-4xl space-y-6 px-4 pb-16 pt-5 sm:px-6">
        <PartnerNav />
        <main>{children}</main>
      </div>
    </div>
  );
}
