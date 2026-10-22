"use client";

import Link from "next/link";
import { ChevronRight, Cpu, PlugZap, type LucideIcon } from "lucide-react";
import type { DeviceSyncInit } from "@/lib/device-sync-types";
import { cn } from "@/lib/utils";
import { useDeviceState } from "./use-device-state";

export interface SiteDevice {
  id: string;
  name: string;
  /** equipment category: "solar_inverter", "ev_charger", ... */
  category: string | null;
  sync: DeviceSyncInit;
}

const STATUS = {
  online: { text: "Online", dot: "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)]", label: "text-emerald-600 dark:text-emerald-400" },
  connection_lost: { text: "Connection lost", dot: "bg-amber-500", label: "text-amber-600 dark:text-amber-400" },
  offline: { text: "Offline", dot: "bg-red-500", label: "text-red-600 dark:text-red-400" },
} as const;

const ICON: Record<string, LucideIcon> = { ev_charger: PlugZap };

/** One device of the site: its name and, live, whether it is reporting (the same verdict as the dots in the menu); a tap opens that device's page. */
function Row({ device }: { device: SiteDevice }) {
  const { status } = useDeviceState(device.id, device.sync);
  const s = STATUS[status];
  const Icon = (device.category && ICON[device.category]) || Cpu;
  return (
    <Link
      href={`/dashboard/devices?device=${device.id}`}
      className="group -mx-2 flex items-center gap-3 rounded-lg px-2 py-2 outline-none transition-colors hover:bg-foreground/5 focus-visible:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-background/60 ring-1 ring-border/50">
        <Icon className="size-4 text-foreground/70" strokeWidth={1.6} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">{device.name}</span>
        <span className={cn("mt-0.5 flex items-center gap-1.5 text-xs", s.label)}>
          <span aria-hidden className={cn("size-1.5 rounded-full", s.dot)} />
          {s.text}
        </span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

/** The site's devices under its address, each with its status. */
export function SiteDevices({ devices }: { devices: SiteDevice[] }) {
  if (devices.length === 0) return <p className="text-xs text-muted-foreground">No devices yet.</p>;
  return (
    <div className="divide-y divide-border/40">
      {devices.map((d) => (
        <Row key={d.id} device={d} />
      ))}
    </div>
  );
}
