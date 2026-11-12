"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { EvCharger, Radio, Server } from "lucide-react";
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { CONNECTION_LABEL, type ConnectionStatus } from "@/lib/device-state";
import type { ChargerSidebarInfo } from "@/lib/sidebar-device-info";
import { getConnectorStatusLabel } from "@/lib/ev-charger-catalog";
import { useHasMounted } from "@/hooks/use-has-mounted";
import { timeAgo } from "@/lib/time-ago";
import { useLatest } from "@/lib/telemetry/react";
import { cn } from "@/lib/utils";
import { selectDevice } from "@/app/dashboard/actions";
import { useDeviceHub } from "./device-live-hub";

export interface SidebarControlDevice {
  id: string;
  name: string;
  kind: "inverter" | "ev";
  charger?: ChargerSidebarInfo;
}

/** The pages that are about one device (they follow ?device=): on these the device the page shows is marked in the list, and pressing another device's
 *  name switches the page to it. On any other page pressing a name opens that device's page. */
export const DEVICE_PAGES = ["/dashboard/devices", "/dashboard/ev-sessions", "/dashboard/maintenance", "/dashboard/monitoring", "/dashboard/performance", "/dashboard/reports"];
export const isDevicePage = (pathname: string) => DEVICE_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

const DOT: Record<ConnectionStatus, string> = { online: "bg-emerald-500", connection_lost: "bg-amber-500", offline: "bg-red-500" };
const TONE: Record<Exclude<ConnectionStatus, "online">, string> = { connection_lost: "text-amber-500", offline: "text-red-500" };
const STATE_TEXT: Record<ConnectionStatus, string> = { online: "Online", connection_lost: CONNECTION_LABEL.connection_lost, offline: CONNECTION_LABEL.offline };

const timeOnly = (ms: number) => new Date(ms).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
/** "10:42 am" today, "11 Nov, 10:42 am" on another day. */
function stamp(ms: number, now: number) {
  return new Date(ms).toDateString() === new Date(now).toDateString() ? timeOnly(ms) : `${new Date(ms).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}, ${timeOnly(ms)}`;
}

/**
 * One inverter or charger in the sidebar:
 *  - its name with a dot for its connection (green reporting, amber connection lost, red offline), which is all that is said about a device that is fine;
 *    pressing the name opens that device (on a page about one device it switches the page to it, from any other page it opens the device's page),
 *  - a word only when there is something to say: Connection lost or Offline, or a charger's connector status (Available, Charging ...),
 *  - one line of value: how long ago an inverter last sent a reading ("5 mins ago"); a charger's latest charging session ("1.0 kWh . 4 Nov, 6:56 pm", or
 *    "Since 6:56 pm" while one is open),
 *  - at the right end of that line a small Go live button (it stays on while the sidebar is shut).
 * Nothing here has a tooltip. What it shows follows the live channel; a charger's sessions come from the server and are read again whenever the page is.
 */
export function SidebarDeviceRow({ device, selected, onNavigate }: { device: SidebarControlDevice; selected: boolean; onNavigate: () => void }) {
  const { controls, states, clock } = useDeviceHub();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const mounted = useHasMounted();
  const [opening, startOpen] = React.useTransition();
  const state = states[device.id];
  const status: ConnectionStatus = state?.status ?? "online";
  const control = controls[device.id];
  const live = control?.status ?? "off";
  const connecting = live === "connecting" || live === "waiting" || live === "loading";
  const isLive = live === "live";
  const failed = live === "error";
  const Icon = device.kind === "ev" ? EvCharger : Server;
  const lastRead = state?.lastReadAt ? new Date(state.lastReadAt).getTime() : null;

  // a charger's connector status, live (the server's word until the first live message)
  const code = useLatest(device.id, "connector_status");
  const connector = device.charger ? (code ? getConnectorStatusLabel(code.value, device.charger.connectorOptions).label : device.charger.status) : null;
  const session = device.charger?.lastSession ?? null;
  let value: string | null = null;
  if (mounted) {
    if (device.kind === "inverter") value = lastRead ? timeAgo(lastRead, clock) : "No reading yet";
    else if (!session) value = "No sessions yet";
    else if (session.endedAt === null) value = `Since ${stamp(new Date(session.startedAt).getTime(), clock)}`;
    else value = `${session.kwh === null ? "" : `${session.kwh.toFixed(1)} kWh · `}${stamp(new Date(session.endedAt).getTime(), clock)}`;
  }

  function open() {
    startOpen(async () => {
      await selectDevice(device.id);
      onNavigate();
      if (isDevicePage(pathname)) {
        const params = new URLSearchParams(searchParams.toString());
        params.set("device", device.id);
        router.push(`${pathname}?${params.toString()}`);
      } else {
        router.push(`/dashboard/devices?device=${device.id}`);
      }
    });
  }
  const goLabel = failed ? "Go live failed. Try again" : connecting ? "Connecting. Stop" : isLive ? "Live. Stop" : "Go live";

  return (
    <SidebarMenuItem>
      <SidebarMenuButton isActive={selected} onClick={open} disabled={opening}>
        <Icon className="size-4 shrink-0 opacity-70" />
        <span className="truncate text-[clamp(12.5px,0.85vw,13.5px)]">{device.name}</span>
        <span role="img" aria-label={STATE_TEXT[status]} className={cn("ml-auto size-2 shrink-0 rounded-full", DOT[status], status === "online" && "shadow-[0_0_6px_rgba(16,185,129,0.7)]")} />
      </SidebarMenuButton>
      <div className="flex items-center gap-2 pb-2 pl-8 pr-2 pt-0.5">
        <div className="min-w-0 flex-1">
          {status !== "online" ? (
            <p className={cn("text-[11.5px] font-medium leading-tight", TONE[status])}>{STATE_TEXT[status]}</p>
          ) : (
            connector && <p className="text-[11.5px] font-medium leading-tight text-sidebar-foreground/80">{connector}</p>
          )}
          <p className="min-h-[14px] text-[11px] leading-tight tabular-nums text-sidebar-foreground/60">{value}</p>
        </div>
        <button
          type="button"
          onClick={() => (connecting || isLive ? control?.stop() : control?.start())}
          disabled={!control}
          aria-label={goLabel}
          className={cn(
            "grid size-6 shrink-0 place-items-center rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-sidebar-ring disabled:opacity-50",
            isLive ? "bg-emerald-600 text-white" : connecting ? "bg-orange-500 text-white motion-safe:animate-pulse" : failed ? "bg-red-600 text-white" : "bg-sidebar-accent text-sidebar-foreground/70 hover:text-sidebar-foreground"
          )}
        >
          <Radio className="size-3.5" />
        </button>
      </div>
    </SidebarMenuItem>
  );
}
