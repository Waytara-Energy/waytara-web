"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { useSidebar } from "@/components/ui/sidebar";
import { visibleNavItems, SECONDARY_NAV_ITEMS } from "./nav-config";
import { isPeeking, setPeeking } from "./sidebar-peek";

const ACCOUNT_GROUP_ITEMS = SECONDARY_NAV_ITEMS;

// ⌘K / Ctrl+K quick-nav across whatever dashboard pages this customer's
// plan actually unlocks (same visibleNavItems feature-gate the sidebar
// itself uses, so the palette never offers a destination the plan can't
// reach). Also surfaces the account-menu pages (Support, Billing, Settings)
// — none of them have a sidebar row, but they're still reachable, so
// power-users can still jump straight there.
export function DashboardCommandMenu({ features = {}, variant = "header" }: { features?: Record<string, boolean>; variant?: "header" | "sidebar" }) {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  const { isMobile, setOpen: setSidebarOpen, setOpenMobile } = useSidebar();
  const navItems = visibleNavItems(features);

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((o) => !o);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function go(href: string) {
    setOpen(false);
    // Going to a page closes a sidebar that was only peeked at.
    if (isMobile) setOpenMobile(false);
    else if (isPeeking()) {
      setPeeking(false);
      setSidebarOpen(false);
    }
    router.push(href);
  }

  return (
    <>
      {variant === "sidebar" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-8 w-full items-center gap-2 rounded-lg border border-sidebar-foreground/15 bg-sidebar-accent/60 px-2.5 text-xs text-sidebar-foreground/80 outline-none transition-colors hover:border-sidebar-foreground/25 hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          <Search className="size-3.5 shrink-0" />
          <span className="flex-1 text-left">Search…</span>
          <Kbd className="h-4 min-w-4 px-1 text-[10px] max-md:hidden">⌘K</Kbd>
        </button>
      ) : (
        <Button type="button" variant="outline" size="sm" className="h-8 gap-2 text-muted-foreground" onClick={() => setOpen(true)}>
          <Search className="h-3.5 w-3.5" />
          <span className="hidden lg:inline">Quick nav…</span>
          <Kbd className="hidden lg:inline-flex">⌘K</Kbd>
        </Button>
      )}
      <CommandDialog open={open} onOpenChange={setOpen} title="Quick navigation" description="Jump to a dashboard page">
        <CommandInput placeholder="Where do you want to go?" />
        <CommandList>
          <CommandEmpty>No matching page.</CommandEmpty>
          <CommandGroup heading="Dashboard">
            {navItems.map(({ href, label, icon: Icon }) => (
              <CommandItem key={href} value={label} onSelect={() => go(href)}>
                <Icon />
                {label}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Account">
            {ACCOUNT_GROUP_ITEMS.map(({ href, label, icon: Icon }) => (
              <CommandItem key={href} value={label} onSelect={() => go(href)}>
                <Icon />
                {label}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
