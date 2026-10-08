"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, EvCharger, Radio, RefreshCw, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { computeDeviceState, CONNECTION_LABEL, type ConnectionStatus } from "@/lib/device-state";
import type { DeviceSyncInit } from "@/lib/device-sync-types";
import { agoText, newestIso, worstStatus } from "@/lib/device-status-summary";
import { useTelemetryStore } from "@/lib/telemetry/react";
import { cn } from "@/lib/utils";
import { selectDevice } from "@/app/dashboard/actions";
import { useGoLive } from "./go-live";

export interface StatusDevice {
  id: string;
  name: string;
  kind: "inverter" | "ev";
  sync: DeviceSyncInit;
}

const KIND = {
  inverter: { icon: Server, label: "Inverter" },
  ev: { icon: EvCharger, label: "EV charger" },
} as const;

const TONE: Record<ConnectionStatus, string> = {
  online: "text-emerald-500",
  connection_lost: "text-amber-500",
  offline: "text-red-500",
};
const DOT: Record<ConnectionStatus, string> = { online: "bg-emerald-500", connection_lost: "bg-amber-500", offline: "bg-red-500" };
const STATE_TEXT: Record<ConnectionStatus, string> = { online: "Online", connection_lost: CONNECTION_LABEL.connection_lost, offline: CONNECTION_LABEL.offline };

const clockText = (ms: number) => new Date(ms).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", second: "2-digit" });
/** How long the time of a new connection stays up before it fades and the icon comes back. */
const MOMENT_MS = 3200;

/** The connection state of each device, live: from the server's first reading, then the live messages (re-judged every 15 seconds). */
function useDeviceStates(devices: StatusDevice[]) {
  const store = useTelemetryStore();
  const [clock, setClock] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setClock(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);
  // Changes whenever any device's live status changes (the live status objects are replaced, so a text key is the stable signal).
  const sig = React.useSyncExternalStore(
    store.subscribe,
    () =>
      devices
        .map((d) => {
          const s = store.getStatus(d.id);
          return `${s.lastTickAt}|${s.lastReadAt}|${s.deviceOnline}`;
        })
        .join(";"),
    () => ""
  );
  const states = React.useMemo(
    () => devices.map((d) => computeDeviceState(d.sync, store.getStatus(d.id), clock)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [devices, store, clock, sig]
  );
  return { states, clock, store };
}

/** One kind of device in the page header, as an icon button the size of the notification bell: a server for the inverters, a charger
 *  for the EV chargers, with how many there are written beside it (only when more than one), both in the colour of the state (green online, amber
 *  connection lost, red offline). The icon is the device control for every page; clicking it opens a menu to
 *   - switch to another device of this kind (the page, and every page after it, follows),
 *   - go live with the selected one (it must sit inside a GoLiveProvider for that device), or stop,
 *   - refresh its connection and the page.
 *  While it connects the icon turns orange with a spinning ring and a pulse; when the connection comes up the time it did appears in
 *  the icon's place, fades, and the icon pops back in green with a soft ring. */
export function DeviceStatusIcon({
  kind,
  devices,
  selectedId,
  index = 0,
}: {
  kind: "inverter" | "ev";
  devices: StatusDevice[];
  /** The device the page is showing (it may be of the other kind). */
  selectedId: string;
  index?: number;
}) {
  const live = useGoLive();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { states, clock, store } = useDeviceStates(devices);
  const { icon: Icon, label } = KIND[kind];
  const [open, setOpen] = React.useState(false);
  const [switching, startSwitch] = React.useTransition();
  const [refreshing, startRefresh] = React.useTransition();
  const [fetchedAt, setFetchedAt] = React.useState(() => Date.now());
  // Clicking the icon re-reads the connection straight away: the icon turns into a spinning refresh icon until that is done.
  const [quickRefresh, setQuickRefresh] = React.useState(false);

  const status = worstStatus(states.map((s) => s.status));
  const lastRead = newestIso(states.map((s) => s.lastReadAt));
  const liveStatus = live?.state.status ?? "off";
  const connecting = liveStatus === "connecting" || liveStatus === "waiting" || liveStatus === "loading";
  const isLive = liveStatus === "live";
  const failed = liveStatus === "error";
  const active = connecting || isLive;
  const holdsSelected = devices.some((d) => d.id === selectedId);

  // The moment the connection comes up: its time is shown for a while, then the icon returns with a different animation.
  const [momentAt, setMomentAt] = React.useState<number | null>(null);
  const [entrance, setEntrance] = React.useState<"drop" | "pop">("drop");
  const previous = React.useRef(liveStatus);
  React.useEffect(() => {
    const cameUp = previous.current !== "live" && liveStatus === "live";
    previous.current = liveStatus;
    if (!cameUp) return;
    setMomentAt(Date.now());
    const timer = setTimeout(() => {
      setMomentAt(null);
      setEntrance("pop");
    }, MOMENT_MS);
    return () => clearTimeout(timer);
  }, [liveStatus]);
  const showMoment = momentAt !== null && isLive;

  function pick(id: string) {
    if (id === selectedId) {
      setOpen(false);
      return;
    }
    startSwitch(async () => {
      await selectDevice(id);
      setOpen(false);
      // A device-scoped page follows ?device=; the Overview is the whole site, so it just reloads.
      if (pathname === "/dashboard") router.refresh();
      else {
        const params = new URLSearchParams(searchParams.toString());
        params.set("device", id);
        router.push(`${pathname}?${params.toString()}`);
      }
    });
  }

  function toggleLive() {
    if (!live) return;
    if (active) {
      live.stop();
      return;
    }
    live.start();
    devices.forEach((d) => void store.refreshHeartbeat(d.id));
  }

  function openMenu(next: boolean) {
    setOpen(next);
    if (!next || quickRefresh) return;
    setQuickRefresh(true);
    void Promise.allSettled(devices.map((d) => store.refreshHeartbeat(d.id))).then(() =>
      setTimeout(() => {
        setFetchedAt(Date.now());
        setQuickRefresh(false);
      }, 700)
    );
  }

  function refresh() {
    startRefresh(async () => {
      await Promise.allSettled(devices.map((d) => store.refreshHeartbeat(d.id)));
      router.refresh();
      setFetchedAt(Date.now());
    });
  }

  const tone = failed ? "text-red-500" : connecting ? "text-orange-500" : isLive ? "text-emerald-500" : TONE[status];
  const plural = devices.length > 1 ? "s" : "";
  const liveText = failed ? "Try again" : connecting ? "Connecting… stop" : isLive ? "Live · stop" : "Go live";

  const spinning = quickRefresh || refreshing;

  return (
    <div className="flex items-center gap-1.5">
    <Popover open={open} onOpenChange={openMenu}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${label}${plural}: ${devices.length}, ${states.map((s) => STATE_TEXT[s.status].toLowerCase()).join(", ")}. Open the device menu.`}
          className={cn(
            "relative flex h-8 min-w-8 cursor-pointer items-center justify-center rounded-md border px-2 outline-none transition-colors hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring",
            holdsSelected ? "border-border bg-accent/40" : "border-border",
            tone
          )}
        >
          {showMoment ? (
            // The connection is up: its time, fading in and out.
            <span className="flex items-center gap-1.5 [animation:time-in-out_3200ms_ease-in-out_both] motion-reduce:animate-none">
              <Check className="size-3.5" strokeWidth={2.6} />
              <span className="text-xs font-semibold tabular-nums">{clockText(momentAt)}</span>
            </span>
          ) : (
            <span
              key={entrance}
              style={entrance === "drop" ? { animationDelay: `${index * 160}ms` } : undefined}
              className={cn(
                "flex items-center justify-center motion-reduce:animate-none",
                entrance === "drop" ? "[animation:coin-drop_700ms_cubic-bezier(0.34,1.56,0.64,1)_both]" : "[animation:icon-pop_650ms_cubic-bezier(0.34,1.56,0.64,1)_both]"
              )}
            >
              <span className="relative flex size-4 items-center justify-center">
                {connecting && <span className="absolute -inset-1 rounded-full border-2 border-current border-t-transparent opacity-70 motion-safe:animate-spin" />}
                {isLive && <span className="absolute -inset-0.5 rounded-full bg-current opacity-25 motion-safe:animate-ping" />}
                {spinning ? <RefreshCw className="size-4 animate-spin" aria-label="Refreshing" /> : <Icon className={cn("size-4", connecting && "motion-safe:animate-pulse")} />}
              </span>
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-72 p-1.5">
        <p className="px-2 pb-1 pt-1.5 text-xs font-medium text-muted-foreground">
          {label}
          {plural}
        </p>
        <ul className="space-y-0.5">
          {devices.map((d, i) => (
            <li key={d.id}>
              <button
                type="button"
                onClick={() => pick(d.id)}
                disabled={switching}
                className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              >
                <span className={cn("size-2 shrink-0 rounded-full", DOT[states[i].status])} title={STATE_TEXT[states[i].status]} />
                <span className="min-w-0 flex-1 truncate">{d.name}</span>
                {d.id === selectedId && <Check className="size-4 shrink-0 text-primary" />}
              </button>
            </li>
          ))}
        </ul>

        <div className="my-1.5 h-px bg-border" />
        <div className="grid grid-cols-2 gap-1.5 p-0.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              "h-8 gap-1.5 px-2 text-xs",
              isLive && "border-emerald-500/50 text-emerald-600 dark:text-emerald-400",
              connecting && "border-orange-500/50 text-orange-600 dark:text-orange-400",
              failed && "border-red-500/50 text-red-600 dark:text-red-400"
            )}
            onClick={toggleLive}
            disabled={!holdsSelected}
            title={holdsSelected ? undefined : "Pick a device of this kind first"}
          >
            <Radio className={cn("size-3.5", connecting && "motion-safe:animate-pulse")} />
            {liveText}
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 px-2 text-xs" onClick={refresh} disabled={refreshing}>
            {refreshing ? <Spinner className="size-3.5" /> : <RefreshCw className="size-3.5" />}
            Refresh
          </Button>
        </div>
        <p className="px-2 pb-1 pt-2 text-[11px] text-muted-foreground">
          Fetched at {clockText(fetchedAt)}
          {lastRead ? ` · last reading ${agoText(clock - new Date(lastRead).getTime())}` : ""}
        </p>
      </PopoverContent>
    </Popover>
    {/* The count, outside the button, and only when there is more than one device to choose between. */}
    {devices.length > 1 && <span className={cn("text-xs font-semibold tabular-nums", tone)}>{devices.length}</span>}
    </div>
  );
}
