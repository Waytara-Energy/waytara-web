"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Check, EvCharger, LifeBuoy, Radio, RefreshCw, Server, SlidersHorizontal, Stethoscope, WifiOff } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { computeDeviceState, CONNECTION_LABEL, type ConnectionStatus } from "@/lib/device-state";
import type { DeviceSyncInit } from "@/lib/device-sync-types";
import { durationText, reasonOf } from "@/lib/data-gaps";
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

const BTN = "inline-flex h-8 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-60";
const BTN_PRIMARY = "bg-foreground text-background hover:opacity-90";
const BTN_SECONDARY = "bg-muted text-foreground hover:bg-muted/70";

const clockText = (ms: number) => new Date(ms).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", second: "2-digit" });
/** How long the time of a new connection stays up before it fades and the icon comes back. */
const MOMENT_MS = 3200;

const timeOnly = (ms: number) => new Date(ms).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
const stamp = (ms: number, now: number) => {
  const d = new Date(ms);
  const sameDay = d.toDateString() === new Date(now).toDateString();
  return sameDay ? timeOnly(ms) : d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) + ", " + timeOnly(ms);
};

/** The connection state of each device, live: from the server's first reading, then the server's verdict as it changes over the live channel (the browser does not judge silence). */
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
          return `${s.lastTickAt}|${s.lastReadAt}|${s.deviceOnline}|${s.verdict?.status}|${s.verdict?.serverNowMs}`;
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

  const status = worstStatus(states.map((s) => s.status));
  const lastRead = newestIso(states.map((s) => s.lastReadAt));
  const liveStatus = live?.state.status ?? "off";
  const connecting = liveStatus === "connecting" || liveStatus === "waiting" || liveStatus === "loading";
  const isLive = liveStatus === "live";
  const failed = liveStatus === "error";
  const active = connecting || isLive;
  const holdsSelected = devices.some((d) => d.id === selectedId);
  // The device the menu talks about: the one the page shows, or the first of this kind.
  const focus = devices.find((d) => d.id === selectedId) ?? devices[0];
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
  }, [liveStatus, selectedId]);
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

  // Opening the menu only shows it; nothing is re-read until Refresh is pressed.
  const openMenu = setOpen;

  function refresh() {
    startRefresh(async () => {
      await Promise.allSettled(devices.map((d) => store.refreshHeartbeat(d.id)));
      router.refresh();
    });
  }

  const tone = failed ? "text-red-500" : connecting ? "text-orange-500" : isLive ? "text-emerald-500" : TONE[status];
  const plural = devices.length > 1 ? "s" : "";
  const liveText = failed ? "Try again" : connecting ? "Connecting… stop" : isLive ? "Live · stop" : "Go live";

  const spinning = refreshing;

  // The device the menu talks about, and whether it is reporting. Whatever is going live (or failed to) keeps Go live and Refresh in reach.
  const focusState = states[Math.max(0, devices.findIndex((d) => d.id === focus?.id))];
  const focusStatus: ConnectionStatus = focusState?.status ?? "online";
  const focusRead = focusState?.lastReadAt ?? null;
  const problem = focusStatus !== "online" && !active && !failed;
  const reason = reasonOf(focusStatus === "offline" ? "unit_offline" : "inverter_unreachable");
  const settingsHref = `/dashboard/devices${focus ? `?device=${focus.id}` : ""}${kind === "inverter" ? "#settings-basic" : ""}`;
  const healthHref = `/dashboard/maintenance${focus ? `?device=${focus.id}` : ""}#health`;
  const reportHref = `/dashboard/support?${new URLSearchParams({
    new: "1",
    category: "device",
    subject: `${focus?.name ?? label} is not reporting`,
    message: `${reason.title}: ${reason.detail}${focusRead ? ` Last reading ${stamp(new Date(focusRead).getTime(), clock)}.` : ""}`,
    ...(focus ? { device: focus.id } : {}),
  }).toString()}`;

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

      <PopoverContent align="end" className="w-[22rem] max-w-[calc(100vw-1rem)] rounded-2xl p-0">
        {/* What the device is doing, in words: its name when it is fine, what is wrong when it is not. The settings button is always here. */}
        <div className="flex items-start gap-3 p-4">
          <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", problem ? (focusStatus === "offline" ? "bg-red-500/12 text-red-600" : "bg-amber-500/12 text-amber-600") : "bg-emerald-500/12 text-emerald-600")}>
            {problem ? <WifiOff className="size-4" /> : <Icon className="size-4" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-5">{problem ? reason.title : (focus?.name ?? label)}</p>
            <p className="text-xs leading-snug text-muted-foreground">
              {problem ? reason.detail : `${label} · ${STATE_TEXT[focusStatus]}${focusRead ? ` · last reading ${agoText(clock - new Date(focusRead).getTime())}` : ""}`}
            </p>
          </div>
          <Link
            href={settingsHref}
            onClick={() => setOpen(false)}
            aria-label="Open device settings"
            title="Open device settings"
            className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-foreground outline-none transition-colors hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <SlidersHorizontal className="size-4" />
          </Link>
        </div>

        {devices.length > 1 && (
          <ul className="space-y-0.5 border-t p-1.5">
            {devices.map((d, i) => (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => pick(d.id)}
                  disabled={switching}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                >
                  <span className={cn("size-2 shrink-0 rounded-full", DOT[states[i].status])} title={STATE_TEXT[states[i].status]} />
                  <span className="min-w-0 flex-1 truncate">{d.name}</span>
                  {d.id === selectedId && <Check className="size-4 shrink-0 text-primary" />}
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* A site with one inverter and one charger has no list to pick from: this is how the pages (Monitoring, Performance, Reports, Maintenance) switch to this device. */}
        {devices.length === 1 && !holdsSelected && focus && (
          <div className="border-t p-1.5">
            <button
              type="button"
              onClick={() => pick(focus.id)}
              disabled={switching}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
            >
              <Icon className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">Show this {label.toLowerCase()} on the pages</span>
            </button>
          </div>
        )}

        {/* Only what a customer wants to know, in the look of the chart-gap card: how long it has been silent, or when it last reported. */}
        <div className="flex items-baseline justify-between gap-4 border-y px-4 py-2.5 text-xs">
          {problem ? (
            <>
              <span className="min-w-0">
                <span className="block text-sm font-medium tabular-nums text-foreground">{lastRead ? `since ${stamp(new Date(lastRead).getTime(), clock)}` : "No reading yet"}</span>
                <span className="block truncate text-muted-foreground">{focus?.name ?? label}</span>
              </span>
              {lastRead && <span className="shrink-0 tabular-nums text-muted-foreground">{durationText(clock - new Date(lastRead).getTime())} so far</span>}
            </>
          ) : (
            <>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-foreground">Last reading</span>
                <span className="block text-muted-foreground">{STATE_TEXT[focusStatus]}</span>
              </span>
              <span className="shrink-0 text-right tabular-nums text-muted-foreground">
                {lastRead ? stamp(new Date(lastRead).getTime(), clock) : "No reading yet"}
                {lastRead && <span className="block">{agoText(clock - new Date(lastRead).getTime())}</span>}
              </span>
            </>
          )}
        </div>
        {problem && <p className="px-4 pt-3 text-xs leading-snug text-muted-foreground">The charts keep the line going and mark this time in red. The figures for it are missing, not zero.</p>}

        {/* Reporting: go live or refresh. Not reporting: look into it, or tell us. */}
        <div className="flex gap-2 p-4">
          {problem ? (
            <>
              <Link href={healthHref} onClick={() => setOpen(false)} className={cn(BTN, BTN_PRIMARY)}>
                <Stethoscope className="size-3.5" />
                Check device health
              </Link>
              <Link href={reportHref} onClick={() => setOpen(false)} className={cn(BTN, BTN_SECONDARY)}>
                <LifeBuoy className="size-3.5" />
                Report a problem
              </Link>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={toggleLive}
                disabled={!holdsSelected}
                title={holdsSelected ? undefined : "Pick a device of this kind first"}
                className={cn(BTN, BTN_PRIMARY, isLive && "bg-emerald-600 text-white", connecting && "bg-orange-500 text-white", failed && "bg-red-600 text-white")}
              >
                <Radio className={cn("size-3.5", connecting && "motion-safe:animate-pulse")} />
                {liveText}
              </button>
              <button type="button" onClick={refresh} disabled={refreshing} className={cn(BTN, BTN_SECONDARY)}>
                {refreshing ? <Spinner className="size-3.5" /> : <RefreshCw className="size-3.5" />}
                Refresh
              </button>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
    {/* The count, outside the button, and only when there is more than one device to choose between. */}
    {devices.length > 1 && <span className={cn("text-xs font-semibold tabular-nums", tone)}>{devices.length}</span>}
    </div>
  );
}
