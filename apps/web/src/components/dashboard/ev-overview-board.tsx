"use client";

import * as React from "react";
import { Clock, IndianRupee, Leaf, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useUnits } from "@/components/units-provider";
import { useLiveNumbers } from "@/lib/telemetry/live-values";
import { elapsedText } from "@/lib/ev-control";
import type { EvHistory, EvHistorySession } from "@/lib/ev-history";
import type { OpenCharge } from "@/lib/ev-overview";
import { cn } from "@/lib/utils";
import { EvChargeControl } from "./ev-charge-control";
import { EvCarScene, type EvSceneState } from "./ev-car-scene";

const KEYS = ["power_active_import_kw", "current_import_l1_a", "voltage_l1_n_v", "energy_active_import_register_kwh"];

const inr = (v: number) => `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const clock = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
const dayMonth = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
/** 5420 s -> "1 h 30 min", 154 s -> "3 min" (a charge under a minute is "< 1 min"). */
function span(s: number): string {
  const min = Math.round(s / 60);
  if (min < 1) return "< 1 min";
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")} min`;
}

function Title({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-sm font-semibold text-foreground">{children}</h3>
      {aside}
    </div>
  );
}

function Tile({ icon: Icon, label, value, hint }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; hint?: string }) {
  return (
    <div className="flex min-h-0 min-w-0 flex-col justify-between rounded-xl bg-muted/50 p-3">
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5 shrink-0" />
        <span className="truncate">{label}</span>
      </span>
      <div className="mt-1">
        <p className="truncate text-xl font-semibold tabular-nums text-foreground">{value}</p>
        {hint ? <p className="truncate text-xs text-muted-foreground">{hint}</p> : null}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-xs text-muted-foreground">{label}</p>
      <p className="truncate text-lg font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

/** Energy per day as plain bars: 7 or 30 days, today last. Hovering (or focusing) a bar names its day and figure in the header line. */
function Statistic({ history }: { history: EvHistory }) {
  const u = useUnits();
  const [range, setRange] = React.useState<7 | 30>(7);
  const [active, setActive] = React.useState<number | null>(null);
  const days = history.daily.slice(-range);
  const max = Math.max(0.1, ...days.map((d) => d.kwh));
  const total = days.reduce((s, d) => s + d.kwh, 0);
  const label = (day: string, long: boolean) =>
    new Date(`${day}T00:00:00Z`).toLocaleDateString("en-IN", long ? { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" } : range === 7 ? { weekday: "short", timeZone: "UTC" } : { day: "numeric", timeZone: "UTC" });
  const shown = active !== null ? days[active] : null;

  return (
    <Card className="flex min-h-0 flex-col gap-3 p-4 lg:col-span-5">
      <Title
        aside={
          <div role="tablist" aria-label="Range" className="flex gap-0.5 rounded-lg bg-muted/60 p-0.5">
            {([7, 30] as const).map((r) => (
              <button
                key={r}
                type="button"
                role="tab"
                aria-selected={range === r}
                onClick={() => {
                  setRange(r);
                  setActive(null);
                }}
                className={cn("rounded-md px-2.5 py-1 text-xs font-medium transition-colors", range === r ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
              >
                {r} days
              </button>
            ))}
          </div>
        }
      >
        Statistic
      </Title>
      <div>
        <p className="text-2xl font-semibold tabular-nums text-foreground">{u.format(shown ? shown.kwh : total, "kWh", "ev_energy_today_kwh", 1)}</p>
        <p className="text-xs text-muted-foreground">{shown ? label(shown.day, true) : `delivered in the last ${range} days`}</p>
      </div>
      <div className="relative min-h-28 flex-1" onMouseLeave={() => setActive(null)}>
        <div aria-hidden="true" className="absolute inset-x-0 top-0 bottom-5 flex flex-col justify-between">
          {[0, 1, 2].map((i) => (
            <div key={i} className="border-t border-dashed border-border/70" />
          ))}
        </div>
        <div className="absolute inset-x-0 top-0 bottom-5 flex items-end gap-[3px]">
          {days.map((d, i) => (
            <button
              key={d.day}
              type="button"
              aria-label={`${label(d.day, true)}: ${d.kwh.toFixed(1)} kWh`}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              className="group flex h-full min-w-0 flex-1 items-end outline-none"
            >
              <span
                className={cn(
                  "mx-auto block w-full max-w-[2.25rem] rounded-t-md transition-colors",
                  d.kwh > 0 ? (i === days.length - 1 ? "bg-emerald-500" : "bg-emerald-500/55 group-hover:bg-emerald-500 group-focus-visible:bg-emerald-500") : "bg-muted",
                )}
                style={{ height: d.kwh > 0 ? `${Math.max(4, (d.kwh / max) * 100)}%` : "3px" }}
              />
            </button>
          ))}
        </div>
        <div aria-hidden="true" className="absolute inset-x-0 bottom-0 flex gap-[3px] text-[10px] text-muted-foreground">
          {days.map((d, i) => (
            <span key={d.day} className="min-w-0 flex-1 truncate text-center">
              {range === 7 || i % 5 === days.length % 5 ? label(d.day, false) : ""}
            </span>
          ))}
        </div>
      </div>
    </Card>
  );
}

/** What a charge was: its energy, time and cost, and how much of the energy was the site's own solar. */
function LastCharge({ last }: { last: EvHistorySession | null }) {
  const u = useUnits();
  return (
    <Card className="flex min-h-0 flex-col gap-3 p-4 lg:col-span-7">
      <Title aside={last ? <span className="text-xs text-muted-foreground">{`${dayMonth(last.startedAt)}, ${clock(last.startedAt)}`}</span> : null}>Last charge</Title>
      {last ? (
        <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-2 gap-2.5">
          <Tile icon={Zap} label="Energy" value={u.format(last.kwh, "kWh", "ev_energy_today_kwh", 2)} hint={last.peakKw !== null ? `peak ${u.format(last.peakKw, "kW", "power_active_import_kw", 1)}` : undefined} />
          <Tile icon={Clock} label="Time" value={span(last.durationS)} hint={`until ${clock(last.endedAt)}`} />
          <Tile icon={IndianRupee} label="Cost" value={last.cost !== null ? inr(last.cost) : "—"} />
          <Tile icon={Leaf} label="From solar" value={last.solarSharePct !== null ? `${Math.round(last.solarSharePct)}%` : "—"} hint={last.solarSharePct !== null ? "of this charge" : "not measured"} />
        </div>
      ) : (
        <p className="grid flex-1 place-items-center text-sm text-muted-foreground">No charge yet.</p>
      )}
    </Card>
  );
}

function History({ sessions }: { sessions: EvHistorySession[] }) {
  const u = useUnits();
  return (
    <Card className="flex min-h-0 flex-col gap-2 p-4 lg:col-span-5">
      <Title>History</Title>
      {sessions.length === 0 ? (
        <p className="grid flex-1 place-items-center text-sm text-muted-foreground">Finished charges are listed here.</p>
      ) : (
        <ul className="-mx-1 max-h-60 min-h-0 flex-1 divide-y overflow-y-auto px-1 lg:max-h-none">
          {sessions.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{`${dayMonth(s.startedAt)}, ${clock(s.startedAt)}`}</p>
                <p className="truncate text-xs text-muted-foreground">{[span(s.durationS), s.solarSharePct !== null ? `${Math.round(s.solarSharePct)}% solar` : null].filter(Boolean).join(" · ")}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold tabular-nums text-foreground">{u.format(s.kwh, "kWh", "ev_energy_today_kwh", 2)}</p>
                {s.cost !== null ? <p className="text-xs tabular-nums text-muted-foreground">{inr(s.cost)}</p> : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/**
 * A charger's Overview: the charger and car drawn with what it is doing (live power, current and voltage, the charge so far, Start / Stop),
 * the last finished charge, the list of recent ones and the energy per day. The words and the open charge come from the server (the page
 * refreshes when a session starts or ends); the electrical numbers are live.
 */
export function EvOverviewBoard({
  chargerId,
  name,
  status,
  connected,
  todayKwh,
  open,
  initial,
  history,
}: {
  chargerId: string;
  name: string;
  /** The connector's status in words ("Available", "Charging", "Offline"...), or null when not known yet. */
  status: string | null;
  /** The charger answers through its unit (null = no verdict yet). */
  connected: boolean | null;
  todayKwh: number | null;
  open: OpenCharge | null;
  initial: Record<string, number | null>;
  history: EvHistory;
}) {
  const u = useUnits();
  const n = useLiveNumbers([chargerId], KEYS, initial);
  const powerKw = n.power_active_import_kw;
  const offline = connected === false;
  const charging = !offline && (open !== null || (powerKw ?? 0) > 0);
  const word = offline ? "Offline" : charging ? "Charging" : (status ?? "Available");
  const plugged = charging || /prepar|suspend|finish/i.test(word);
  const scene: EvSceneState = offline ? "offline" : charging ? "charging" : "idle";

  // the charge so far: the register now less the register at the start (live), else what the server last worked out
  const reg = n.energy_active_import_register_kwh;
  const chargeKwh = open ? (reg !== null && open.startEnergyKwh !== null ? Math.max(0, reg - open.startEnergyKwh) : open.kwh) : null;

  // the time since the charge began, moved on every few seconds while one is open
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(t);
  }, [open]);

  const tone = offline ? "bg-red-500" : charging ? "bg-emerald-500" : "bg-muted-foreground/50";
  const last = history.recent[0] ?? null;

  return (
    <div className="grid gap-4 lg:h-[max(calc(100svh-9.5rem),30rem)] lg:grid-cols-12 lg:grid-rows-[minmax(0,11fr)_minmax(0,9fr)]">
      <Card className="flex min-h-0 flex-col gap-2 p-4 lg:col-span-7">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-foreground">{name}</h3>
            <p className="text-xs text-muted-foreground tabular-nums">
              {charging ? (open ? `Charging for ${elapsedText(Date.parse(open.startedAt), now)}` : "Charging") : todayKwh !== null && todayKwh > 0 ? `${u.format(todayKwh, "kWh", "ev_energy_today_kwh", 1)} delivered today` : "No charge yet today"}
            </p>
          </div>
          <span className="flex shrink-0 items-center gap-2 rounded-full bg-muted/60 px-3 py-1 text-xs font-medium text-foreground">
            <span className={cn("size-2 rounded-full", tone, charging && "motion-safe:animate-pulse")} />
            {word}
          </span>
        </div>
        <div className="min-h-0 flex-1">
          <EvCarScene state={scene} plugged={plugged} className="h-full max-h-[15rem] lg:max-h-none" />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
            <Stat label="Power" value={powerKw !== null ? u.format(powerKw, "kW", "power_active_import_kw", 2) : "—"} />
            <Stat label="Current" value={n.current_import_l1_a !== null ? u.format(n.current_import_l1_a, "A", "current_import_l1_a", 1) : "—"} />
            <Stat label="Voltage" value={n.voltage_l1_n_v !== null ? `${Math.round(n.voltage_l1_n_v)} V` : "—"} />
            <Stat label="This charge" value={chargeKwh !== null ? u.format(chargeKwh, "kWh", "ev_energy_today_kwh", 2) : "—"} />
          </div>
          <EvChargeControl chargerId={chargerId} sessionOpen={open !== null} transactionId={open?.transactionId ?? null} connected={connected} className="w-full sm:w-64" />
        </div>
      </Card>
      <Statistic history={history} />
      <LastCharge last={last} />
      <History sessions={history.recent} />
    </div>
  );
}
