"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { EvCharger, Radio, RefreshCw, Server, SlidersHorizontal } from "lucide-react";
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { Spinner } from "@/components/ui/spinner";
import { CONNECTION_LABEL, type ConnectionStatus } from "@/lib/device-state";
import type { ChargerSidebarInfo } from "@/lib/sidebar-device-info";
import { getConnectorStatusLabel } from "@/lib/ev-charger-catalog";
import { useHasMounted } from "@/hooks/use-has-mounted";
import { timeAgo } from "@/lib/time-ago";
import { useLatest, useTelemetryStore } from "@/lib/telemetry/react";
import { cn } from "@/lib/utils";
import { selectDevice } from "@/app/dashboard/actions";
import { useDeviceHub } from "./device-live-hub";

export interface SidebarControlDevice {
  id: string;
  name: string;
  kind: "inverter" | "ev";
  charger?: ChargerSidebarInfo;
}

const DOT: Record<ConnectionStatus, string> = { online: "bg-emerald-500", connection_lost: "bg-amber-500", offline: "bg-red-500" };
const TONE: Record<ConnectionStatus, string> = { online: "text-emerald-500", connection_lost: "text-amber-500", offline: "text-red-500" };
const STATE_TEXT: Record<ConnectionStatus, string> = { online: "Online", connection_lost: CONNECTION_LABEL.connection_lost, offline: CONNECTION_LABEL.offline };

const MINI = "inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-md px-2 text-[11px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-sidebar-ring disabled:pointer-events-none disabled:opacity-60";

const timeOnly = (ms: number) => new Date(ms).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
/** "10:42 am" today, "11 Nov, 10:42 am" on another day. */
function stamp(ms: number, now: number) {
  return new Date(ms).toDateString() === new Date(now).toDateString() ? timeOnly(ms) : `${new Date(ms).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}, ${timeOnly(ms)}`;
}

/**
 * One inverter or charger in the sidebar, with its own controls (these used to be the device icons in the page header):
 *  - the name (press it to make it the device the pages show, as the header's icon menu did) and a dot for its connection,
 *  - its state, and under it how long ago it last sent a reading; for a charger its connector status and its latest charging session,
 *  - Refresh (re-reads its connection and the page), Go live (watch its readings as they arrive; it stays on while the sidebar is shut) and its settings.
 * What it shows follows the live channel; the sessions come from the server and are fetched again by Refresh.
 */
export function SidebarDeviceRow({ device, selected, onNavigate }: { device: SidebarControlDevice; selected: boolean; onNavigate: () => void }) {
  const { controls, states, clock } = useDeviceHub();
  const store = useTelemetryStore();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const mounted = useHasMounted();
  const [switching, startSwitch] = React.useTransition();
  const [refreshing, startRefresh] = React.useTransition();
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
  const statusWord = status !== "online" ? STATE_TEXT[status] : (connector ?? STATE_TEXT.online);
  const session = device.charger?.lastSession ?? null;
  let line2: string | null = null;
  if (mounted) {
    if (device.kind === "inverter") line2 = lastRead ? `Last reading ${timeAgo(lastRead, clock)}` : "No reading yet";
    else if (!session) line2 = "No charging sessions yet";
    else if (session.endedAt === null) line2 = `Charging since ${stamp(new Date(session.startedAt).getTime(), clock)}`;
    else line2 = `Last session ${session.kwh === null ? "" : `${session.kwh.toFixed(1)} kWh · `}${stamp(new Date(session.endedAt).getTime(), clock)}`;
  }

  function pick() {
    startSwitch(async () => {
      await selectDevice(device.id);
      onNavigate();
      // A device-scoped page follows ?device=; the Overview is the whole site, so it just reloads.
      if (pathname === "/dashboard") router.refresh();
      else {
        const params = new URLSearchParams(searchParams.toString());
        params.set("device", device.id);
        router.push(`${pathname}?${params.toString()}`);
      }
    });
  }
  function refresh() {
    startRefresh(async () => {
      await store.refreshHeartbeat(device.id);
      router.refresh();
    });
  }
  const goText = failed ? "Try again" : connecting ? "Connecting…" : isLive ? "Live" : "Go live";

  return (
    <SidebarMenuItem>
      <SidebarMenuButton isActive={selected} onClick={pick} disabled={switching} title={selected ? "The device the pages show" : "Show this device on the pages"}>
        <Icon className="size-4 shrink-0 opacity-70" />
        <span className="truncate text-[clamp(12.5px,0.85vw,13.5px)]">{device.name}</span>
        <span role="img" aria-label={STATE_TEXT[status]} title={STATE_TEXT[status]} className={cn("ml-auto size-2 shrink-0 rounded-full", DOT[status], status === "online" && "shadow-[0_0_6px_rgba(16,185,129,0.7)]")} />
      </SidebarMenuButton>
      <div className="pb-2 pl-8 pr-2 pt-0.5">
        <p className={cn("text-[11.5px] font-medium leading-tight", TONE[status])}>{statusWord}</p>
        <p className="min-h-[14px] text-[11px] leading-tight text-sidebar-foreground/60">{line2}</p>
        <div className="mt-1.5 flex items-center gap-1.5">
          <button type="button" onClick={refresh} disabled={refreshing} className={cn(MINI, "bg-sidebar-accent text-sidebar-foreground hover:bg-sidebar-accent/70")}>
            {refreshing ? <Spinner className="size-3" /> : <RefreshCw className="size-3" />}
            Refresh
          </button>
          <button
            type="button"
            onClick={() => (connecting || isLive ? control?.stop() : control?.start())}
            disabled={!control}
            className={cn(MINI, isLive ? "bg-emerald-600 text-white" : connecting ? "bg-orange-500 text-white" : failed ? "bg-red-600 text-white" : "bg-sidebar-foreground text-sidebar hover:opacity-90")}
            title={isLive || connecting ? "Stop watching live" : "Watch its readings as they arrive"}
          >
            <Radio className={cn("size-3", connecting && "motion-safe:animate-pulse")} />
            {goText}
          </button>
          <Link
            href={`/dashboard/devices?device=${device.id}`}
            onClick={onNavigate}
            aria-label="Open device settings"
            title="Open device settings"
            className="ml-auto grid size-6 place-items-center rounded-md text-sidebar-foreground/70 outline-none transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          >
            <SlidersHorizontal className="size-3.5" />
          </Link>
        </div>
      </div>
    </SidebarMenuItem>
  );
}
