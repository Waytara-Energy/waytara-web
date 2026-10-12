"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Check, EvCharger, Radio, RefreshCw, Server, SlidersHorizontal } from "lucide-react";
import { useRealtimeTable } from "@waytara/ui/realtime-provider";
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
  /** When the device's settings were last asked for, and last read from the device (ISO). */
  settingsRequestedAt?: string | null;
  settingsReadAt?: string | null;
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

const STORAGE_KEY = "waytara:last-go-live";
const goLiveListeners = new Set<() => void>();
const readGoLive = () => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "{}";
  } catch {
    return "{}";
  }
};
/** When each device last went live, kept in this browser (going live is a thing this browser does), as JSON text. */
function useGoLiveTimes(): Record<string, number> {
  const raw = React.useSyncExternalStore(
    (cb) => {
      goLiveListeners.add(cb);
      return () => void goLiveListeners.delete(cb);
    },
    readGoLive,
    () => "{}"
  );
  return React.useMemo(() => {
    try {
      return JSON.parse(raw) as Record<string, number>;
    } catch {
      return {};
    }
  }, [raw]);
}
function rememberGoLive(deviceId: string) {
  try {
    const all = JSON.parse(readGoLive()) as Record<string, number>;
    all[deviceId] = Date.now();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // storage can be blocked; the time just is not kept
  }
  goLiveListeners.forEach((l) => l());
}

const timeOnly = (ms: number) => new Date(ms).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
const stamp = (ms: number, now: number) => {
  const d = new Date(ms);
  const sameDay = d.toDateString() === new Date(now).toDateString();
  return sameDay ? timeOnly(ms) : d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) + ", " + timeOnly(ms);
};

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
  const [fetchedAt, setFetchedAt] = React.useState(() => Date.now());

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
  const goLiveTimes = useGoLiveTimes();
  // Settings times follow the device's own rows as they arrive; the server's values are the starting point.
  const [seenSettings, setSeenSettings] = React.useState<Record<string, { requested?: string; read?: string }>>({});
  useRealtimeTable<{ equipment_id: string; source: string | null; ts: string }>("equipment_configs", "INSERT", `equipment_id=in.(${devices.map((d) => d.id).join(",")})`, (p) => {
    const row = p.new;
    const agent = (row.source ?? "").startsWith("agent");
    setSeenSettings((prev) => ({ ...prev, [row.equipment_id]: { ...prev[row.equipment_id], [agent ? "read" : "requested"]: row.ts } }));
  });
  const newestOf = (a: string | null | undefined, b: string | null | undefined) => (a && b ? (a > b ? a : b) : (a ?? b ?? null));
  const settingsRequested = newestOf(focus?.settingsRequestedAt, seenSettings[focus?.id ?? ""]?.requested);
  const settingsRead = newestOf(focus?.settingsReadAt, seenSettings[focus?.id ?? ""]?.read);

  // The moment the connection comes up: its time is shown for a while, then the icon returns with a different animation.
  const [momentAt, setMomentAt] = React.useState<number | null>(null);
  const [entrance, setEntrance] = React.useState<"drop" | "pop">("drop");
  const previous = React.useRef(liveStatus);
  React.useEffect(() => {
    const cameUp = previous.current !== "live" && liveStatus === "live";
    previous.current = liveStatus;
    if (!cameUp) return;
    setMomentAt(Date.now());
    rememberGoLive(selectedId);
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
      setFetchedAt(Date.now());
    });
  }

  const tone = failed ? "text-red-500" : connecting ? "text-orange-500" : isLive ? "text-emerald-500" : TONE[status];
  const plural = devices.length > 1 ? "s" : "";
  const liveText = failed ? "Try again" : connecting ? "Connecting… stop" : isLive ? "Live · stop" : "Go live";

  const spinning = refreshing;

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
        {/* When things last happened, for the device the page shows. Opening this menu reads nothing again. */}
        <dl className="mt-2 space-y-1 border-t pt-2 text-xs">
          {(
            [
              ["Last went live", goLiveTimes[focus?.id ?? ""] ? stamp(goLiveTimes[focus!.id], clock) : "Not yet"],
              ["Last refresh", stamp(fetchedAt, clock)],
              ["Last reading (sync)", lastRead ? `${stamp(new Date(lastRead).getTime(), clock)} · ${agoText(clock - new Date(lastRead).getTime())}` : "No reading yet"],
              ["Settings read from device", settingsRead ? stamp(new Date(settingsRead).getTime(), clock) : "Not yet"],
              ["Settings last changed", settingsRequested ? stamp(new Date(settingsRequested).getTime(), clock) : "No change yet"],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="flex items-baseline justify-between gap-3 px-2">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="text-right font-medium tabular-nums text-foreground">{value}</dd>
            </div>
          ))}
        </dl>
        <Link
          href={`/dashboard/devices${focus ? `?device=${focus.id}` : ""}${kind === "inverter" ? "#settings-basic" : ""}`}
          onClick={() => setOpen(false)}
          className="mt-2 flex items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs font-medium text-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
        >
          <SlidersHorizontal className="size-3.5" />
          Open device settings
        </Link>
      </PopoverContent>
    </Popover>
    {/* The count, outside the button, and only when there is more than one device to choose between. */}
    {devices.length > 1 && <span className={cn("text-xs font-semibold tabular-nums", tone)}>{devices.length}</span>}
    </div>
  );
}
