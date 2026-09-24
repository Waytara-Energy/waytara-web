"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { deviceDisplayId, type CustomerDevice } from "@/lib/device-display";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";

/** SiteSwitcher's own combobox pattern, applied to devices within the
 *  currently selected site — device selection is a per-page `?device=`
 *  search param (not a cookie, see DevicePicker's own doc comment: no
 *  single global "current device" since a site can hold more than one),
 *  so picking one here navigates rather than calling a server action.
 *  `usePathname` keeps this reusable on any device-scoped page exactly the
 *  way DevicePicker's relative `?device=` links already are.
 *
 *  The navigation re-runs the target page's async Server Component (a
 *  fresh Supabase fetch for the new device), which can take a beat —
 *  `useTransition` (same as SiteSwitcher) swaps the chevron for a spinner
 *  and disables the trigger for that stretch so picking a device doesn't
 *  read as unresponsive. */
export function DeviceSwitcher({ devices, selectedId }: { devices: CustomerDevice[]; selectedId: string }) {
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const router = useRouter();
  const pathname = usePathname();
  const selected = devices.find((d) => d.id === selectedId) ?? devices[0];

  function handleSelect(id: string) {
    setOpen(false);
    if (id === selected?.id) return;
    startTransition(() => {
      router.push(`${pathname}?device=${id}`);
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
          className="h-auto min-w-0 max-w-full justify-between gap-2 px-0 text-xl font-semibold text-theme-primary hover:bg-transparent"
        >
          <span className="min-w-0 truncate">{selected ? deviceDisplayId(selected) : "Select device"}</span>
          {pending ? (
            <Spinner className="size-5 shrink-0 text-theme-muted" />
          ) : (
            <ChevronsUpDown className="size-5 shrink-0 text-theme-muted" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder="Find device…" />
          <CommandList>
            <CommandEmpty>No device found.</CommandEmpty>
            <CommandGroup>
              {devices.map((d) => (
                <CommandItem key={d.id} value={deviceDisplayId(d)} onSelect={() => handleSelect(d.id)}>
                  <Check className={cn("size-4 shrink-0", d.id === selected?.id ? "opacity-100" : "opacity-0")} />
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate">{deviceDisplayId(d)}</span>
                    {d.deviceType?.name && <span className="truncate text-xs text-muted-foreground">{d.deviceType.name}</span>}
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
