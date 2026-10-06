"use client";

import * as React from "react";
import { Line, LineChart, XAxis, YAxis } from "recharts";
import { Radio, RotateCcw, Square } from "lucide-react";
import { createClient } from "@waytara/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Spinner } from "@/components/ui/spinner";
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
    setTimer: (fn, ms) => setTimeout(fn, ms),
    clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
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
const HIDDEN_GRACE_MS = 10_000;

/** Go Live for a device's Monitoring screen. While it is on, the screen's trend charts show today's readings at the
 *  device's own rate (from the agent's local files) instead of 15-minute averages. It switches itself off when the
 *  tab is hidden for 10 s, the page closes, or the browser goes offline - and the page falls back to the saved data. */
export function GoLiveProvider({ deviceId, agentOnline, children }: { deviceId: string; agentOnline: boolean; children: React.ReactNode }) {
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

  const start = React.useCallback(() => void session.start(deviceId, union()), [session, deviceId, union]);
  const stop = React.useCallback(() => session.stop(), [session]);

  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") timer = setTimeout(() => session.stop(), HIDDEN_GRACE_MS);
      else if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };
    const leave = () => session.stop();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", leave);
    window.addEventListener("offline", leave);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", leave);
      window.removeEventListener("offline", leave);
      if (timer) clearTimeout(timer);
      session.stop(); // leaving the screen leaves the channel
    };
  }, [session]);

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
      <Button size="sm" variant="outline" onClick={stop} className="gap-1.5 border-emerald-500/50 text-emerald-600 dark:text-emerald-400">
        <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
        Live
        <Square className="size-3" />
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
        title={agentOnline ? "Show every reading from the device as it arrives" : "The device agent is offline"}
        className="gap-1.5"
      >
        {state.status === "error" ? <RotateCcw className="size-3.5" /> : <Radio className="size-3.5" />}
        {state.status === "error" ? "Try Go Live again" : "Go Live"}
      </Button>
      {state.status === "error" && state.error && <span className="max-w-xs text-xs text-destructive">{state.error}</span>}
      {!agentOnline && state.status !== "error" && <span className="text-xs text-theme-muted">Device agent offline</span>}
    </div>
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
        <CardDescription>Today, every reading as the device reports it</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="aspect-auto h-[240px] w-full">
          <LineChart accessibilityLayer margin={{ left: 4, right: 4, top: 8 }}>
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
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  indicator="dashed"
                  labelFormatter={(_, payload) => (payload?.[0]?.payload?.t ? ist(payload[0].payload.t) : "")}
                  formatter={(value, name, item) => (
                    <span className="flex w-full items-center justify-between gap-3">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <span className="size-2 shrink-0 rounded-[2px]" style={{ backgroundColor: item.color }} />
                        {String(name)}
                      </span>
                      <span className="font-medium text-foreground tabular-nums">
                        {typeof value === "number" ? value.toFixed(2) : String(value)} {unit}
                      </span>
                    </span>
                  )}
                />
              }
            />
            {data.map(({ s, points }) => (
              <Line key={s.key} data={points} dataKey="v" name={s.label} type="stepAfter" stroke={`var(--color-${s.key})`} strokeWidth={1.75} dot={false} isAnimationActive={false} />
            ))}
          </LineChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="text-xs text-muted-foreground">
        {total.toLocaleString("en-IN")} readings today{lastMs ? ` · last at ${ist(lastMs)}` : ""}
      </CardFooter>
    </Card>
  );
}
