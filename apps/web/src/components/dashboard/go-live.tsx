"use client";

import * as React from "react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from "recharts";
import { Pause, Radio, RotateCcw } from "lucide-react";
import { createClient } from "@waytara/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartReadout, type ReadoutItem } from "./chart-kit";
import { CHART_CURSOR } from "./chart-cursor";
import { ChartConfig, ChartContainer } from "@/components/ui/chart";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { istDayStart } from "@/lib/telemetry/combine";
import {
  GoLiveSession,
  decimateMinMax,
  type GoLiveEnv,
  type GoLiveState,
  type SnapshotFile,
  type SnapshotMeta,
  type TickMessage,
} from "@/lib/telemetry/go-live";
import type { BarTrendSeries } from "./bar-trend-chart";
import { ChartErrorCard } from "./chart-states";

type Sb = ReturnType<typeof createClient>;

function browserEnv(sb: Sb): GoLiveEnv {
  const viewer = Math.random().toString(36).slice(2, 10);
  return {
    viewerId: () => viewer,
    join: async (deviceId, handlers) => {
      await sb.realtime.setAuth(); // the signed-in session's token: the channel is private
      const channel = sb.channel(`live:${deviceId}`, { config: { private: true, presence: { key: viewer } } });
      let joined: () => void = () => {};
      const ready = new Promise<void>((resolve, reject) => {
        joined = resolve;
        setTimeout(() => reject(new Error("Couldn't open the live connection in time.")), 10_000);
      });
      channel
        .on("broadcast", { event: "snapshot" }, (m) => handlers.onSnapshot(m.payload as SnapshotMeta))
        .on("broadcast", { event: "tick" }, (m) => handlers.onTick(m.payload as TickMessage))
        .on("broadcast", { event: "bye" }, () => handlers.onBye())
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            joined();
            handlers.onStatus("joined");
          } else if (status === "CLOSED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            handlers.onStatus("dropped");
          }
        });
      await ready;
      return {
        track: (payload) => void channel.track(payload),
        leave: () => {
          void channel.untrack();
          void sb.removeChannel(channel);
        },
      };
    },
    download: async (meta) => {
      const { data, error } = await sb.storage.from(meta.bucket).download(meta.path);
      if (error || !data) throw new Error("Couldn't load today's readings from the device.");
      const stream = data.stream().pipeThrough(new DecompressionStream("gzip"));
      return (await new Response(stream).json()) as SnapshotFile;
    },
  };
}

interface GoLiveContextValue {
  state: GoLiveState;
  active: boolean;
  agentOnline: boolean;
  start: () => void;
  stop: () => void;
  register: (keys: string[]) => () => void;
}

const GoLiveContext = React.createContext<GoLiveContextValue | null>(null);

/** Go Live for a device's screen. While it is on, the screen shows the device's readings as they arrive (the agent sends every
 *  reading for the first minute, then thins them out) instead of the regular 15-minute updates. No timer ever ends it, and it stays
 *  on while the tab is open, in front or behind: it closes when the page is left or closed, or pauses while the browser is offline
 *  (and starts again by itself when the network is back). */
export function GoLiveProvider({
  deviceId,
  agentOnline,
  history = true,
  children,
}: {
  deviceId: string;
  agentOnline: boolean;
  /** false = follow the readings from now on only; the agent doesn't send today's data (Overview). */
  history?: boolean;
  children: React.ReactNode;
}) {
  const [session] = React.useState(() => new GoLiveSession(browserEnv(createClient())));
  const state = React.useSyncExternalStore(session.subscribe, session.getState, session.getState);
  const registered = React.useRef(new Map<number, string[]>());
  const nextId = React.useRef(0);

  const union = React.useCallback(() => [...new Set([...registered.current.values()].flat())].sort(), []);

  const register = React.useCallback(
    (keys: string[]) => {
      const id = nextId.current++;
      registered.current.set(id, keys);
      session.setKeys(union());
      return () => {
        registered.current.delete(id);
        session.setKeys(union());
      };
    },
    [session, union]
  );

  const start = React.useCallback(() => void session.start(deviceId, union(), { history }), [session, deviceId, union, history]);
  const stop = React.useCallback(() => session.stop(), [session]);

  // It stays on while the tab is open, in front or behind. Losing the network pauses it and it comes back with the network; leaving or
  // closing the page ends it.
  const resumeRef = React.useRef(false);
  React.useEffect(() => {
    const onOffline = () => {
      const status = session.getState().status;
      resumeRef.current = status !== "off" && status !== "error";
      session.stop();
    };
    const onOnline = () => {
      if (!resumeRef.current) return;
      resumeRef.current = false;
      void session.start(deviceId, union(), { history });
    };
    const leave = () => {
      resumeRef.current = false;
      session.stop();
    };
    window.addEventListener("pagehide", leave);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("pagehide", leave);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
      session.stop(); // leaving the screen leaves the channel
    };
  }, [session, deviceId, union, history]);

  const active = state.status !== "off" && state.status !== "error";
  const value = React.useMemo(() => ({ state, active, agentOnline, start, stop, register }), [state, active, agentOnline, start, stop, register]);
  return <GoLiveContext.Provider value={value}>{children}</GoLiveContext.Provider>;
}

export function useGoLive(): GoLiveContextValue | null {
  return React.useContext(GoLiveContext);
}

/** The Go Live control: one button whose label follows the connection. */
export function GoLiveButton() {
  const live = useGoLive();
  if (!live) return null;
  const { state, active, agentOnline, start, stop } = live;

  if (state.status === "live") {
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={stop}
        title="Pause live readings (the page keeps updating from the saved data)"
        className="gap-1.5 border-emerald-500/50 text-emerald-600 dark:text-emerald-400"
      >
        <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
        Live
        <Pause className="size-3" />
      </Button>
    );
  }
  if (active) {
    return (
      <Button size="sm" variant="outline" onClick={stop} className="gap-1.5">
        <Spinner className="size-3.5" />
        {state.status === "loading" ? "Loading today's data…" : "Connecting to the device…"}
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        onClick={start}
        disabled={!agentOnline}
        title={agentOnline ? "Show every reading from the device as it arrives" : "The device is offline"}
        className="gap-1.5"
      >
        {state.status === "error" ? <RotateCcw className="size-3.5" /> : <Radio className="size-3.5" />}
        {state.status === "error" ? "Try Go Live again" : "Go Live"}
      </Button>
      {state.status === "error" && state.error && <span className="max-w-xs text-xs text-destructive">{state.error}</span>}
    </div>
  );
}

/** The status in the page header with Go Live in front of it: one control, icon then the status word (`children`). Clicking it - even
 *  when the status says Offline - tries a live connection to the equipment agent and shows the readings as they arrive; clicking
 *  again lets go. It is orange and animated while it connects (and keeps waiting for as long as the page is open - no timeout),
 *  green while live, red when it fails, and a muted red icon when the device is offline and nothing has been tried yet. */
export function GoLiveStatusButton({ children, onStart }: { children: React.ReactNode; onStart?: () => void }) {
  const live = useGoLive();
  if (!live) return <>{children}</>;
  const { state, active, agentOnline, start, stop } = live;

  const isLive = state.status === "live";
  const connecting = active && !isLive;
  const failed = state.status === "error";

  let label = "Go Live: show every reading as it arrives";
  let tone = "text-muted-foreground group-hover/golive:text-foreground";
  let onClick: () => void = () => {
    start();
    onStart?.();
  };
  if (isLive) {
    label = "Live - click to pause (the page keeps updating with the regular 15-minute updates)";
    tone = "text-emerald-600 dark:text-emerald-400";
    onClick = stop;
  } else if (connecting) {
    label = state.status === "loading" ? "Loading… click to cancel" : "Connecting to the device… it keeps trying while you stay on this page. Click to cancel";
    tone = "text-orange-600 dark:text-orange-400";
    onClick = stop;
  } else if (failed) {
    label = `${state.error || "Couldn't go live"} - click to try again`;
    tone = "text-red-600 dark:text-red-400";
  } else if (!agentOnline) {
    label = "Offline - click to try a live connection to the device";
    tone = "text-red-500/80 group-hover/golive:text-red-500";
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          onClick={onClick}
          className="group/golive flex cursor-pointer items-center gap-2 rounded-full py-0.5 pl-0.5 pr-2 outline-none transition-colors hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className={cn("relative flex size-6 shrink-0 items-center justify-center rounded-full", tone)}>
            {(isLive || connecting) && <span className={cn("absolute inset-0 rounded-full border-2 opacity-60 motion-safe:animate-ping", isLive ? "border-emerald-500" : "border-orange-500")} />}
            <Radio className={cn("relative size-4", connecting && "motion-safe:animate-pulse")} />
          </span>
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-64">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

function ist(ms: number): string {
  return new Date(ms + 19_800_000).toISOString().slice(11, 19);
}

/** A BarTrendChart's replacement while Go Live is on: every reading of today, as the device reported it. */
export function LiveRawChart({
  title,
  series,
  valueScale = 0.001,
  unit = "kW",
}: {
  title: string;
  series: BarTrendSeries[];
  valueScale?: number;
  unit?: string;
}) {
  const live = useGoLive();
  const [dayStart] = React.useState(() => istDayStart(Date.now()));
  // The moment pointed at (mouse or finger) along the day; null = follow the newest reading.
  const [pointedT, setPointedT] = React.useState<number | null>(null);
  const keys = React.useMemo(() => series.filter((s) => !s.cumulativeOf).map((s) => s.key), [series]);
  const register = live?.register;
  React.useEffect(() => (register ? register(keys) : undefined), [register, keys]);

  const chartConfig = React.useMemo(
    () => Object.fromEntries(series.map((s) => [s.key, { label: s.label, color: s.color }])) satisfies ChartConfig,
    [series]
  );

  const data = React.useMemo(() => {
    if (!live || live.state.status !== "live") return [];
    return series
      .filter((s) => !s.cumulativeOf)
      .map((s) => {
        const raw = live.state.series.get(s.key);
        const scale = s.scale ?? valueScale;
        const d = raw ? decimateMinMax(raw, 700) : { t: [], v: [] };
        return { s, points: d.t.map((t, i) => ({ t, v: d.v[i] * scale })), count: raw?.t.length ?? 0, last: raw?.t[raw.t.length - 1] };
      });
  }, [live, series, valueScale]);

  if (!live) return null;
  if (live.state.status === "error") return <ChartErrorCard title={title} message={live.state.error} onRetry={live.start} />;
  if (live.state.status !== "live") {
    return (
      <Card>
        <CardHeader className="space-y-2">
          <CardTitle className="text-sm">{title}</CardTitle>
          <CardDescription>{live.state.status === "loading" ? "Loading today's readings from the device…" : "Waiting for the device…"}</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[240px] w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  const total = data.reduce((n, d) => n + d.count, 0);
  const lastMs = Math.max(0, ...data.map((d) => d.last ?? 0));
  // The newest reading of each series, written big under the title (it moves with every reading that arrives).
  // The reading at (or just before) the moment pointed at, else the newest one.
  const readingAt = (points: { t: number; v: number }[]) => {
    if (pointedT === null) return points[points.length - 1];
    let found: { t: number; v: number } | undefined;
    for (const p of points) {
      if (p.t > pointedT) break;
      found = p;
    }
    return found;
  };
  const pointedAt = pointedT === null ? null : data.reduce<number | null>((t, d) => Math.max(t ?? 0, readingAt(d.points)?.t ?? 0) || t, null);
  const readoutItems: ReadoutItem[] = data.map(({ s, points }) => {
    const shown = readingAt(points);
    return { key: s.key, label: s.label, color: `var(--color-${s.key})`, value: shown ? { num: shown.v.toFixed(2), unit: s.unit ?? unit } : null };
  });
  // A finger or the mouse over the chart picks the moment; the plot spans the width less the chart's 4 px margins.
  const pointAt = (e: React.PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const fraction = Math.min(1, Math.max(0, (e.clientX - box.left - 4) / Math.max(1, box.width - 8)));
    setPointedT(dayStart + fraction * 86_400_000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          {title}
          <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
            Live
          </span>
        </CardTitle>
        <ChartReadout when={pointedT !== null ? (pointedAt ? ist(pointedAt) : null) : lastMs ? `Latest reading · ${ist(lastMs)}` : null} items={readoutItems} />
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="aspect-auto h-[240px] w-full" onPointerDown={pointAt} onPointerMove={pointAt} onPointerLeave={(e) => e.pointerType === "mouse" && setPointedT(null)}>
          <AreaChart accessibilityLayer margin={{ left: 4, right: 4, top: 8 }}>
            <defs>
              {data.map(({ s }) => (
                <linearGradient key={s.key} id={`live-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={`var(--color-${s.key})`} stopOpacity={0.32} />
                  <stop offset="100%" stopColor={`var(--color-${s.key})`} stopOpacity={0.02} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="t"
              domain={[dayStart, dayStart + 86_400_000]}
              ticks={Array.from({ length: 9 }, (_, i) => dayStart + i * 3 * 3_600_000)}
              tickFormatter={(t: number) => ist(t).slice(0, 5)}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            />
            <YAxis hide domain={["auto", "auto"]} />
            {pointedAt !== null && <ReferenceLine x={pointedAt} stroke={CHART_CURSOR.stroke} strokeWidth={CHART_CURSOR.strokeWidth} strokeOpacity={CHART_CURSOR.strokeOpacity} strokeLinecap="round" />}
            {data.map(({ s, points }) => (
              <Area key={s.key} data={points} dataKey="v" name={s.label} type="stepAfter" stroke={`var(--color-${s.key})`} strokeWidth={1.75} fill={`url(#live-${s.key})`} baseValue="dataMin" dot={false} isAnimationActive={false} />
            ))}
          </AreaChart>
        </ChartContainer>
        <CardDescription className="mt-2 text-xs">Today, every reading as the device reports it</CardDescription>
      </CardContent>
      <CardFooter className="text-xs text-muted-foreground">
        {total.toLocaleString("en-IN")} readings today{lastMs ? ` · last at ${ist(lastMs)}` : ""}
      </CardFooter>
    </Card>
  );
}
