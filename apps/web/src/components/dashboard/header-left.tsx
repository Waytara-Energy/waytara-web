"use client";

import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { SidebarBrandToggle } from "./sidebar-brand-toggle";
import { SiteSwitcher, type SwitcherSite } from "./site-switcher";

/** The header's left side: on a phone the brand button (it opens the sidebar sheet), then the site. On a desktop the brand
 *  button floats at the window's corner, so when the sidebar is closed the site steps aside to clear it. */
export function HeaderLeft({ sites, selectedSiteId }: { sites: SwitcherSite[]; selectedSiteId: string | null }) {
  const { state, isMobile } = useSidebar();
  const closed = state === "collapsed" && !isMobile;
  return (
    <div className={cn("flex min-w-0 items-center gap-2 transition-[padding] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]", closed && "md:pl-12")}>
      <SidebarBrandToggle className="md:hidden" />
      <SiteSwitcher sites={sites} selectedId={selectedSiteId} />
    </div>
  );
}
