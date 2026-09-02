"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, Plus, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { selectDevice } from "@/app/dashboard/actions";

export interface SwitcherDevice {
  id: string;
  label: string | null;
  deviceUid: string;
  siteName: string | null;
}

/** Vercel's project-switcher pattern, applied to devices — device is the
 *  dashboard's navigation root now, not sites. Search value combines
 *  label/uid/site so a customer with several devices at different sites can
 *  find one by typing either. Selecting calls the `selectDevice` server
 *  action directly (same "client component calls a server action, not a
 *  <form>" pattern already used for sign-out) and refreshes so every
 *  server-rendered page re-reads the new cookie immediately. */
export function DeviceSwitcher({
  devices,
  selectedId,
}: {
  devices: SwitcherDevice[];
  selectedId: string | null;
}) {
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const router = useRouter();
  const selected = devices.find((d) => d.id === selectedId) ?? devices[0];

  function handleSelect(id: string) {
    setOpen(false);
    if (id === selected?.id) return;
    startTransition(async () => {
      await selectDevice(id);
      router.refresh();
    });
  }

  if (devices.length === 0) return null;

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
          <span className="flex min-w-0 items-center gap-1.5">
            <Zap className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{selected?.label || selected?.deviceUid}</span>
          </span>
          <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="Find device…" />
          <CommandList>
            <CommandEmpty>No device found.</CommandEmpty>
            <CommandGroup>
              {devices.map((d) => (
                <CommandItem
                  key={d.id}
                  value={`${d.label ?? ""} ${d.deviceUid} ${d.siteName ?? ""}`}
                  onSelect={() => handleSelect(d.id)}
                >
                  <Check className={cn("size-4 shrink-0", d.id === selected?.id ? "opacity-100" : "opacity-0")} />
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate">{d.label || d.deviceUid}</span>
                    {d.siteName && <span className="truncate text-xs text-muted-foreground">{d.siteName}</span>}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          <CommandSeparator />
          <div className="p-1">
            <Link
              href="/dashboard/sites"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Plus className="size-4" />
              Manage Sites &amp; Devices
            </Link>
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
