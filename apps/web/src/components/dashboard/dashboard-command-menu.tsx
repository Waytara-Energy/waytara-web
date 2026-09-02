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
import { visibleNavItems, SECONDARY_NAV_ITEMS, SITES_NAV_ITEM } from "./nav-config";

const ACCOUNT_GROUP_ITEMS = [...SECONDARY_NAV_ITEMS, SITES_NAV_ITEM];

// ⌘K / Ctrl+K quick-nav across whatever dashboard pages this customer's
// plan actually unlocks (same visibleNavItems feature-gate the sidebar
// itself uses, so the palette never offers a destination the plan can't
// reach). Also surfaces the account-menu pages (Support, Billing, Settings)
// plus Sites & Devices — none of them have a sidebar row (Sites & Devices
// lives in the header's DeviceSwitcher instead), but they're still
// reachable, so power-users can still jump straight there.
export function DashboardCommandMenu({ features = {} }: { features?: Record<string, boolean> }) {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
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
    router.push(href);
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 gap-2 text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <Search className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Quick nav…</span>
        <Kbd className="hidden sm:inline-flex">⌘K</Kbd>
      </Button>
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
