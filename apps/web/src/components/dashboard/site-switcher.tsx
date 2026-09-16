"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { selectSite } from "@/app/dashboard/actions";

export interface SwitcherSite {
  id: string;
  name: string;
  deviceCount: number;
}

/** Vercel's project-switcher pattern, applied to sites — a customer can
 *  have several sites (properties), each with its own devices, so site is
 *  the dashboard's navigation root, not device. Selecting calls the
 *  `selectSite` server action directly (same "client component calls a
 *  server action, not a <form>" pattern already used for sign-out) and
 *  refreshes so every server-rendered page re-reads the new cookie
 *  immediately. */
export function SiteSwitcher({ sites, selectedId }: { sites: SwitcherSite[]; selectedId: string | null }) {
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const router = useRouter();
  const selected = sites.find((s) => s.id === selectedId) ?? sites[0];

  function handleSelect(id: string) {
    setOpen(false);
    if (id === selected?.id) return;
    startTransition(async () => {
      await selectSite(id);
      router.refresh();
    });
  }

  if (sites.length === 0) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          role="combobox"
          aria-expanded={open}
          disabled={pending}
          className="h-8 min-w-0 max-w-[140px] justify-between gap-1.5 px-2 text-sm font-medium text-foreground hover:bg-accent lg:max-w-[220px]"
        >
          <span className="min-w-0 truncate">{selected?.name}</span>
          {pending ? (
            <Spinner className="size-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="Find site…" />
          <CommandList>
            <CommandEmpty>No site found.</CommandEmpty>
            <CommandGroup>
              {sites.map((s) => (
                <CommandItem key={s.id} value={s.name} onSelect={() => handleSelect(s.id)}>
                  <Check className={cn("size-4 shrink-0", s.id === selected?.id ? "opacity-100" : "opacity-0")} />
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate">{s.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {s.deviceCount} device{s.deviceCount === 1 ? "" : "s"}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
