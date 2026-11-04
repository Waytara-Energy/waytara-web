"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Clock, IndianRupee, Leaf, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useUnits } from "@/components/units-provider";
import { useLiveNumbers } from "@/lib/telemetry/live-values";
import { useDeviceLive } from "@/lib/telemetry/react";
import { getConnectorStatusLabel } from "@/lib/ev-charger-catalog";
import { EV_LIVE_KEYS } from "@/lib/ev-live-keys";
import type { EnumOption } from "@/lib/enum-labels";
import { chargeProgress, kmText, minutesText, type CarProfile } from "@/lib/ev-car";
import type { EvHistory, EvHistorySession } from "@/lib/ev-history";
import type { OpenCharge } from "@/lib/ev-overview";
import { cn } from "@/lib/utils";
import { EvPowerPanel } from "./ev-power-panel";
import { EvSessionDialog, type EvSessionLoader } from "./ev-session-dialog";
import { getEvSessionDetail } from "@/app/dashboard/ev-session-detail-action";
import { EvCar } from "./ev-car";


const inr = (v: number) => `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const clock = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
const dayMonth = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
/** 5420 s -> "1 h 30 min", 154 s -> "3 min" (a charge under a minute is "< 1 min"). */
function span(s: number): string {
  const min = Math.round(s / 60);
  if (min < 1) return "< 1 min";
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")} min`;
}

function Title({ children, aside, href }: { children: React.ReactNode; aside?: React.ReactNode; href?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-sm font-semibold text-foreground">
        {href ? (
          <Link href={href} className="group relative z-10 inline-flex items-center gap-0.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {children}
            <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
        ) : (
          children
        )}
      </h3>
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
function Statistic({ history, chargerId }: { history: EvHistory; chargerId: string }) {
  const u = useUnits();
  const [active, setActive] = React.useState<number | null>(null);
  // always the last 7 days
  const days = history.daily.slice(-7);
  const max = Math.max(0.1, ...days.map((d) => d.kwh));
  const total = days.reduce((s, d) => s + d.kwh, 0);
  const label = (day: string, long: boolean) =>
    new Date(`${day}T00:00:00Z`).toLocaleDateString("en-IN", long ? { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" } : { weekday: "short", timeZone: "UTC" });
  const shown = active !== null ? days[active] : null;

  return (
    <Card className="flex min-h-0 flex-col gap-3 p-4 max-lg:order-last lg:col-span-5">
      <Title href={`/dashboard/performance?device=${encodeURIComponent(chargerId)}#ev`}>Statistic</Title>
      <div>
        <p className="text-2xl font-semibold tabular-nums text-foreground">{u.format(shown ? shown.kwh : total, "kWh", "ev_energy_today_kwh", 1)}</p>
        <p className="text-xs text-muted-foreground">{shown ? label(shown.day, true) : "delivered in the last 7 days"}</p>
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
          {days.map((d) => (
            <span key={d.day} className="min-w-0 flex-1 truncate text-center">
              {label(d.day, false)}
            </span>
          ))}
        </div>
      </div>
    </Card>
  );
}

/** What a charge was: its energy, time and cost, and how much of the energy was the site's own solar. */
function LastCharge({ last, onOpen, chargerId }: { last: EvHistorySession | null; onOpen: (id: string) => void; chargerId: string }) {
  const u = useUnits();
  return (
    <Card className="relative flex min-h-0 flex-col gap-3 p-4 transition-colors hover:border-primary/40 lg:col-span-7">
      {/* the whole card is a link to the charger's tab on Monitoring; what must stay pressable on its own sits above it */}
      <Link href={`/dashboard/monitoring?device=${encodeURIComponent(chargerId)}#ev`} aria-label="Open the charger on Monitoring" className="absolute inset-0 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      <Title
        href={`/dashboard/monitoring?device=${encodeURIComponent(chargerId)}#ev`}
        aside={
          last ? (
            <button type="button" onClick={() => onOpen(last.id)} className="relative z-10 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
              {`${dayMonth(last.startedAt)}, ${clock(last.startedAt)}`} · Details
            </button>
          ) : null
        }
      >
        Last charge
      </Title>
      {last ? (
        <div className="pointer-events-none relative grid min-h-0 flex-1 grid-cols-2 grid-rows-2 gap-2.5">
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

function History({ sessions, onOpen, chargerId }: { sessions: EvHistorySession[]; onOpen: (id: string) => void; chargerId: string }) {
  const u = useUnits();
  return (
    <Card className="flex min-h-0 flex-col gap-2 p-4 lg:col-span-5">
      <Title
        href={`/dashboard/reports?device=${encodeURIComponent(chargerId)}#ev`}
        aside={
          sessions.length > 0 ? (
            <a href={`/api/ev/sessions.csv?device=${encodeURIComponent(chargerId)}&period=30d`} download className="rounded-md px-1.5 py-0.5 text-xs text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
              Export CSV
            </a>
          ) : null
        }
      >
        History
      </Title>
      {sessions.length === 0 ? (
        <p className="grid flex-1 place-items-center text-sm text-muted-foreground">Finished charges are listed here.</p>
      ) : (
        <ul className="-mx-2 max-h-60 min-h-0 flex-1 divide-y overflow-y-auto px-1 lg:max-h-none">
          {sessions.map((s) => (
            <li key={s.id}>
              <button type="button" onClick={() => onOpen(s.id)} className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{`${dayMonth(s.startedAt)}, ${clock(s.startedAt)}`}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[span(s.durationS), s.targetKwh !== null ? `booked ${s.targetKwh} kWh` : null, s.solarSharePct !== null ? `${Math.round(s.solarSharePct)}% solar` : null, s.closedAutomatically ? "closed automatically" : null].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold tabular-nums text-foreground">{u.format(s.kwh, "kWh", "ev_energy_today_kwh", 2)}</p>
                  {s.cost !== null ? <p className="text-xs tabular-nums text-muted-foreground">{inr(s.cost)}</p> : null}
                </div>
              </button>
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
  connected: connectedAtLoad,
  connectorOptions,
  open,
  initial,
  history,
  car = null,
  loadSession = getEvSessionDetail,
}: {
  chargerId: string;
  /** The charger answers through its unit, as the server saw it when the page loaded (null = no verdict yet); the live channel takes over. */
  connected: boolean | null;
  /** connector_status codes and their words. */
  connectorOptions: EnumOption[];
  open: OpenCharge | null;
  initial: Record<string, number | null>;
  history: EvHistory;
  /** The person's car (battery size, km per kWh), for what a charge adds; null when not entered. */
  car?: CarProfile | null;
  /** How a charge's detail is fetched (the dashboard's server action unless a page supplies its own). */
  loadSession?: EvSessionLoader;
}) {
  const u = useUnits();
  const n = useLiveNumbers([chargerId], EV_LIVE_KEYS, initial);
  // Everything below follows the live channel: the heartbeat's verdict (is the charger answering), the connector's own status and the
  // electrical readings. The server's values at load time are only what shows until the first live message.
  const live = useDeviceLive(chargerId);
  const connected = live.verdict ? live.verdict.status === "online" : connectedAtLoad;
  const offline = connected === false;
  const status = getConnectorStatusLabel(n.connector_status, connectorOptions).label;
  // A charge is on when a session is open or the connector itself says "Charging". The electrical readings are never the proof: the charger
  // stops sending them when a charge ends, so its last figures (for example 6.99 kW) stay in the database long after.
  const charging = !offline && (open !== null || /^charging$/i.test(status));
  const powerKw = charging ? n.power_active_import_kw : null;

  // The sessions (the open charge, the list, the statistic) come from the server. A change of the connector's state is the moment they change
  // (a charge starts, is stopped, ends), so each change fetches them again, and once more a few seconds later in case the charger's final
  // report was still being written.
  const router = useRouter();
  const lastCode = React.useRef(n.connector_status);
  React.useEffect(() => {
    if (lastCode.current === n.connector_status) return;
    lastCode.current = n.connector_status;
    router.refresh();
    const t = setTimeout(() => router.refresh(), 4_000);
    return () => clearTimeout(t);
  }, [n.connector_status, router]);

  // the charge so far: the register now less the register at the start (live), else what the server last worked out
  const reg = n.energy_active_import_register_kwh;
  const chargeKwh = open ? (reg !== null && open.startEnergyKwh !== null ? Math.max(0, reg - open.startEnergyKwh) : open.kwh) : null;
  const target = open?.targetKwh ?? null;
  const progress = chargeProgress({ deliveredKwh: chargeKwh, targetKwh: target, powerKw, car });
  const level = progress.percent ?? 0;

  const kwh = (v: number, digits = 1) => u.format(v, "kWh", "ev_energy_today_kwh", digits);
  // The line over the car while a charge runs: how far along it is (of the amount booked, else of the car's battery), the energy so far, and
  // what that means: the distance it adds and the time left to the booked amount. Without a booked amount or a car it is the energy alone.
  let headline: React.ReactNode = null;
  let sub = "";
  let detail = "";
  if (charging) {
    const energy = chargeKwh !== null ? kwh(chargeKwh, 2) : "—";
    if (progress.percent !== null) {
      headline = (
        <>
          {Math.round(progress.percent)}
          <span className="ml-0.5 align-top text-base font-medium text-muted-foreground">%</span>
        </>
      );
      sub = progress.percentOf === "booked" && target !== null ? `${energy} of ${kwh(target)} booked` : `${energy} this charge · of your ${car ? kwh(car.batteryKwh, car.batteryKwh % 1 === 0 ? 0 : 1) : ""} battery`;
    } else {
      headline = chargeKwh !== null ? kwh(chargeKwh, 2) : "Charging";
      sub = "this charge";
    }
    detail = [progress.kmAdded !== null ? `adds about ${kmText(progress.kmAdded)}` : null, progress.minutesLeft !== null ? `about ${minutesText(progress.minutesLeft)} left` : null].filter(Boolean).join(" · ");
  }

  const last = history.recent[0] ?? null;
  const [openId, setOpenId] = React.useState<string | null>(null);

  return (
    <div className="grid gap-4 lg:h-[max(calc(100svh-9.5rem),30rem)] lg:grid-cols-12 lg:grid-rows-[minmax(0,11fr)_minmax(0,9fr)]">
      {/* the charger itself has no card: the car stands on the page */}
      <section className="flex min-h-0 flex-col items-center justify-between gap-3 py-2 lg:col-span-7">
        {/* what the charge is doing, only while one runs; the space is kept so the car does not move when it starts */}
        <Link href={`/dashboard/monitoring?device=${encodeURIComponent(chargerId)}#ev`} aria-label="Open the charger on Monitoring" className="flex min-h-0 w-full flex-1 flex-col items-center justify-between gap-3 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <div className="min-h-[5rem] text-center">
            {headline !== null && (
              <>
                <p className="text-4xl font-semibold leading-none tracking-tight text-foreground tabular-nums">{headline}</p>
                <p className="mt-1.5 text-xs text-muted-foreground tabular-nums">{sub}</p>
                {detail ? <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">{detail}</p> : null}
              </>
            )}
          </div>
          <div className="flex min-h-0 w-full max-w-[40rem] flex-1 items-center justify-center">
            <EvCar level={level} sweep={charging && progress.percent === null} className="max-h-full" />
          </div>
        </Link>
        <EvPowerPanel
          chargerId={chargerId}
          sessionOpen={open !== null}
          transactionId={open?.transactionId ?? null}
          connected={connected}
          charging={charging}
          stats={
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
              <Stat label="Power" value={powerKw !== null ? u.format(powerKw, "kW", "power_active_import_kw", 2) : "—"} />
              <Stat label="Current" value={n.current_import_l1_a !== null ? u.format(n.current_import_l1_a, "A", "current_import_l1_a", 1) : "—"} />
              <Stat label="Voltage" value={n.voltage_l1_n_v !== null ? `${Math.round(n.voltage_l1_n_v)} V` : "—"} />
              <Stat label="This charge" value={chargeKwh !== null ? kwh(chargeKwh, 2) : "—"} />
            </div>
          }
        />
      </section>
      <Statistic history={history} chargerId={chargerId} />
      <LastCharge last={last} onOpen={setOpenId} chargerId={chargerId} />
      <History sessions={history.recent} onOpen={setOpenId} chargerId={chargerId} />
      <EvSessionDialog sessionId={openId} onClose={() => setOpenId(null)} load={loadSession} />
    </div>
  );
}
