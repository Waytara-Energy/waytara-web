"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import type { NavGroup } from "./admin-nav";

/** The search under the logo: a box that opens a palette (Ctrl or ⌘ + K) to jump to any page by name. */
export function AdminCommandMenu({ groups }: { groups: NavGroup[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search pages" className="flex h-8 w-full items-center gap-2 rounded-lg border border-sidebar-border bg-sidebar-accent/40 px-2.5 text-left text-[13px] text-sidebar-foreground/60 outline-none transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:p-0"
      >
        <Search className="size-4" />
        <span className="flex-1 group-data-[collapsible=icon]:hidden">Search pages</span>
        <kbd className="rounded group-data-[collapsible=icon]:hidden border border-sidebar-border px-1 text-[10px] font-medium">Ctrl K</kbd>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen} title="Search pages" description="Jump to a page">
        <CommandInput placeholder="Go to…" />
        <CommandList>
          <CommandEmpty>No page matches.</CommandEmpty>
          {groups.map((g) => (
            <CommandGroup key={g.label} heading={g.label}>
              {g.items.map(({ label, href, icon: Icon }) => (
                <CommandItem
                  key={href}
                  value={`${g.label} ${label}`}
                  onSelect={() => {
                    setOpen(false);
                    router.push(href);
                  }}
                >
                  <Icon />
                  {label}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}
