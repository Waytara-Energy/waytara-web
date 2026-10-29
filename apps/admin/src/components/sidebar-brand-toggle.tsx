"use client";

import * as React from "react";
import Image from "next/image";
import { PanelLeftOpen } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

/**
 * The round button at the top left that opens the sidebar on a phone, where it is a sheet and there is no header. On a computer the sidebar folds to a
 * rail of icons that has its own toggle, so this is not shown. `alerts` puts a dot on it when something needs attention.
 */
export function SidebarBrandToggle({ alerts = 0 }: { alerts?: number }) {
  const { toggleSidebar, isMobile } = useSidebar();
  const visible = isMobile;
  return (
    <button
      type="button"
      onClick={toggleSidebar}
      aria-label={isMobile ? "Open menu" : "Show sidebar"}
      tabIndex={visible ? 0 : -1}
      className={cn(
        "group/brand fixed left-3 top-3 z-30 flex size-9 cursor-pointer items-center justify-center rounded-full border border-border bg-background shadow-sm outline-none transition-all duration-300 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
        !visible && "pointer-events-none -translate-x-2 opacity-0"
      )}
    >
      <Image src="/images/icon.png" alt="" width={22} height={22} unoptimized className="size-[22px] transition-all duration-200 group-hover/brand:scale-75 group-hover/brand:opacity-0" />
      <PanelLeftOpen className="absolute size-[18px] scale-75 opacity-0 transition-all duration-200 group-hover/brand:scale-100 group-hover/brand:opacity-100 max-md:hidden" />
      {alerts > 0 ? <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-red-500 ring-2 ring-background" /> : null}
    </button>
  );
}
