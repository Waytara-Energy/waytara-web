"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Logo, LogoMark } from "@/components/shared/logo";
import { visibleNavItems } from "./nav-config";

// Replaces the old hand-rolled dashboard-nav.tsx with shadcn's real
// Sidebar system (collapsible="icon" — collapses to icon-only rather than
// disappearing entirely, persists across reloads via the cookie
// SidebarProvider itself manages). Same nav items, same feature-gating
// logic as before, just re-rendered as SidebarMenuItems.
//
// The collapse toggle lives here, at the end of the logo row, rather than
// in the header — SidebarRail (the edge click/drag target) still works
// too, this just gives it an explicit, discoverable button.
//
// Two more expand affordances once collapsed to the icon rail, since
// there's no room for a permanent visible trigger at that width:
//  - Hovering the logo mark crossfades it into the trigger button, in the
//    same spot (see the `group/logo` wrapper below).
//  - Clicking any empty area of the collapsed sidebar expands it —
//    handleSidebarClick, attached to the whole <Sidebar>, no-ops if the
//    click actually landed on a real control (nav link/button) so those
//    keep navigating instead of just toggling the rail open.
export function DashboardSidebar({
  features = {},
}: {
  features?: Record<string, boolean>;
}) {
  const pathname = usePathname();
  const navItems = visibleNavItems(features);
  const { isMobile, setOpenMobile, state, setOpen } = useSidebar();

  // On mobile the sidebar is a Sheet overlay covering the page (see
  // sidebar.tsx's own mobile branch) — picking a module should close it
  // immediately rather than leaving it open over the page it just
  // navigated to. Desktop's collapsible rail is unaffected: only the
  // mobile Sheet's own open state gets touched here.
  function handleNavClick() {
    if (isMobile) setOpenMobile(false);
  }

  function handleSidebarClick(e: React.MouseEvent<HTMLDivElement>) {
    if (isMobile || state !== "collapsed") return;
    // Real controls (nav links, the trigger button itself) handle their
    // own click — only an empty-space click should expand the rail.
    if ((e.target as HTMLElement).closest("a, button")) return;
    setOpen(true);
  }

  return (
    <Sidebar collapsible="icon" onClick={handleSidebarClick}>
      <SidebarHeader className="h-16 flex-row items-center justify-between px-3 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
        <div className="group/logo relative flex items-center">
          <Link
            href="/dashboard"
            aria-label="Dashboard home"
            className="flex items-center group-data-[collapsible=icon]:group-hover/logo:opacity-0"
            onClick={handleNavClick}
          >
            <Logo isLink={false} className="h-[clamp(19px,1.3vw,22px)] group-data-[collapsible=icon]:hidden" />
            <LogoMark className="hidden h-[clamp(22px,1.5vw,25px)] w-[clamp(22px,1.5vw,25px)] group-data-[collapsible=icon]:block" />
          </Link>
          {/* Collapsed-only — sits exactly over the logo mark above,
              revealed on hover of that same spot. */}
          <SidebarTrigger className="absolute inset-0 hidden items-center justify-center opacity-0 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:group-hover/logo:opacity-100 [&_svg]:h-[clamp(17px,1.15vw,19.5px)] [&_svg]:w-[clamp(17px,1.15vw,19.5px)]" />
        </div>
        {/* Hidden below md — that's the header's own trigger's job on
            mobile (dashboard-header.tsx), since this one has nothing
            useful to do there: the mobile Sheet doesn't collapse to an
            icon rail, so all this could do is close the Sheet you just
            opened via the header's trigger, which reads as a dead end
            rather than a toggle. */}
        <SidebarTrigger className="max-md:hidden group-data-[collapsible=icon]:hidden [&_svg]:h-[clamp(17px,1.15vw,19.5px)] [&_svg]:w-[clamp(17px,1.15vw,19.5px)]" />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map(({ href, label, icon: Icon }) => {
                const active = pathname === href;
                return (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton asChild isActive={active} tooltip={label}>
                      <Link href={href} onClick={handleNavClick}>
                        <Icon className="h-[clamp(15px,1vw,17px)] w-[clamp(15px,1vw,17px)]" />
                        <span className="text-[clamp(12.5px,0.85vw,13.5px)]">{label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  );
}
