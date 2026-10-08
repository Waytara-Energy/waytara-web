"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronUp, Home, LogOut } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/spinner";
import { useSidebar } from "@/components/ui/sidebar";
import { logout } from "@/app/dashboard/actions";
import { cn } from "@/lib/utils";
import { SECONDARY_NAV_ITEMS } from "./nav-config";
import { isPeeking, setPeeking } from "./sidebar-peek";

function initials(name: string | null, email: string | null): string {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
  }
  return (email?.[0] ?? "?").toUpperCase();
}

const ROW = "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-sidebar-foreground/90 outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-sidebar-foreground/60";

/** The account row at the foot of the sidebar. Opening it unfolds the account details inside the sidebar, above the row (no floating
 *  popup): the account pages, Home and sign out. */
export function DashboardUserMenu({
  fullName,
  email,
  avatarUrl,
  planName,
}: {
  fullName: string | null;
  email: string | null;
  avatarUrl: string | null;
  planName?: string | null;
}) {
  const { isMobile, setOpenMobile, setOpen: setSidebarOpen } = useSidebar();
  const [open, setOpen] = React.useState(false);

  // logout() redirects on completion, so this only shows the sign-out as busy until the page leaves.
  const [loggingOut, startLogoutTransition] = React.useTransition();
  function handleLogout() {
    startLogoutTransition(() => {
      void logout();
    });
  }

  // Going to a page folds the details away, and on a phone closes the sidebar sheet too.
  function handleNavigate() {
    setOpen(false);
    if (isMobile) setOpenMobile(false);
    else if (isPeeking()) {
      setPeeking(false);
      setSidebarOpen(false);
    }
  }

  return (
    <div>
      <div className={cn("grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
        <div className="overflow-hidden" inert={!open}>
          <div className="max-h-[55vh] space-y-1 overflow-y-auto px-1 pb-2 pt-1">
            <div className="space-y-0.5">
              {SECONDARY_NAV_ITEMS.map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href} onClick={handleNavigate} className={ROW}>
                  <Icon />
                  {label}
                </Link>
              ))}
            </div>

            <div className="space-y-0.5 border-t border-sidebar-border pt-1.5">
              <Link href="/" onClick={handleNavigate} className={ROW}>
                <Home />
                Home
              </Link>
            </div>

            <div className="border-t border-sidebar-border pt-1.5">
              <button type="button" disabled={loggingOut} onClick={handleLogout} className={cn(ROW, "text-red-500 hover:text-red-500 disabled:opacity-60 [&_svg]:text-red-500")}>
                {loggingOut ? <Spinner /> : <LogOut />}
                {loggingOut ? "Signing out…" : "Sign out"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 rounded-lg p-2 text-left outline-none transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring data-[open=true]:bg-sidebar-accent"
        data-open={open}
      >
        <Avatar className="h-8 w-8 shrink-0 border-0">
          {avatarUrl && <AvatarImage src={avatarUrl} alt={fullName ?? "Account"} />}
          <AvatarFallback className="text-xs">{initials(fullName, email)}</AvatarFallback>
        </Avatar>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium leading-tight text-sidebar-foreground">{fullName ?? "Your account"}</span>
          <span className="block truncate text-xs leading-tight text-sidebar-foreground/60">{planName ?? email}</span>
        </span>
        <ChevronUp className={cn("size-4 shrink-0 text-sidebar-foreground/60 transition-transform duration-200", open ? "rotate-180" : "rotate-0")} />
      </button>
    </div>
  );
}
