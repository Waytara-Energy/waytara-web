"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useUnits } from "@/components/units-provider";
import { useLiveNumbers } from "@/lib/telemetry/live-values";
import { useDeviceLive } from "@/lib/telemetry/react";
import { getConnectorStatusLabel } from "@/lib/ev-charger-catalog";
import { EV_LIVE_KEYS } from "@/lib/ev-live-keys";
import type { EnumOption } from "@/lib/enum-labels";
import { chargeProgress, type CarProfile } from "@/lib/ev-car";
import type { EvHistory, EvHistorySession } from "@/lib/ev-history";
import type { OpenCharge } from "@/lib/ev-overview";
import { cn } from "@/lib/utils";
import { EvMobileCard } from "./ev-mobile-card";


const inr = (v: number) => `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const clock = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
const dayMonth = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
/** 5420 s -> "1 h 30 min", 154 s -> "3 min" (a charge under a minute is "< 1 min"). */
function span(s: number): string {
  const min = Math.round(s / 60);
  if (min < 1) return "< 1 min";
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")} min`;
}

/** A card's heading: the title, and at the right (after whatever else belongs there) the same round arrow button as the solar cards on the Overview. */
function Title({ children, aside, href }: { children: React.ReactNode; aside?: React.ReactNode; href?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-sm font-medium text-foreground">{children}</h3>
      <div className="flex shrink-0 items-center gap-2">
        {aside}
        {href && (
          <Link
            href={href}
            aria-label={`Open ${typeof children === "string" ? children.toLowerCase() : "details"}`}
            className="group relative z-10 grid size-9 place-items-center rounded-full bg-muted text-foreground outline-none transition-colors hover:bg-emerald-500 hover:text-white focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowUpRight className="size-4" />
          </Link>
        )}
      </div>
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
    <Card className="flex min-h-0 flex-col gap-3 p-4 border-border! bg-transparent! shadow-none! max-lg:order-last lg:col-span-5 lg:col-start-8 lg:row-start-2 lg:p-5">
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

function History({ sessions, onOpen, chargerId }: { sessions: EvHistorySession[]; onOpen: (id: string) => void; chargerId: string }) {
  const u = useUnits();
  return (
    <Card className="flex min-h-0 flex-col gap-2 p-4 border-border! bg-transparent! shadow-none! lg:col-span-7 lg:col-start-1 lg:row-start-2 lg:p-5">
      <Title href={`/dashboard/reports?device=${encodeURIComponent(chargerId)}#ev`}>History</Title>
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
  tariff = 8,
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
  /** The person's tariff per kWh, for the cost of a charge on a phone. */
  tariff?: number;
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

  const kwh = (v: number, digits = 1) => u.format(v, "kWh", "ev_energy_today_kwh", digits);
  const last = history.recent[0] ?? null;
  // How the last charge ended: against the amount booked (Completed if it got there, else the percentage it stopped at); with none booked, against the car's
  // battery when the car is known (the share of the battery it added); with neither there is no goal to measure it by, so it is Completed (the bar full).
  const finished = (() => {
    if (!last) return null;
    const p = chargeProgress({ deliveredKwh: last.kwh, targetKwh: last.targetKwh, powerKw: null, car });
    const completed = p.percent === null || p.percent >= 98;
    return { percent: completed ? 100 : (p.percent as number), completed, when: `${dayMonth(last.startedAt)}, ${clock(last.startedAt)}` };
  })();
  // a charge opens on its own page (Reports, the charger's tab, with that charge open), not in a popup
  const openCharge = (id: string) => router.push(`/dashboard/reports?device=${encodeURIComponent(chargerId)}&session=${encodeURIComponent(id)}#ev`);

  // On a wide screen the board fits the screen (at least 44 rem, so a short window scrolls a little rather than squeezing the cards): the car and the charge with the figures and the control beside them in the first row (never shorter than the figures, source, live readings and control need), the history and the statistic under them.
  return (
    <div className="grid gap-4 lg:h-[max(calc(100svh-9.5rem),44rem)] lg:grid-cols-12 lg:grid-rows-[minmax(27rem,12fr)_minmax(14rem,8fr)]">
      {/* The charger in the way of a car's charging screen: the car, the charge and the figures (one column on a phone and a tablet; on a wide screen the car and the charge on the left, the figures and the control on the right). */}
      <EvMobileCard
        chargerId={chargerId}
        connected={connected}
        status={status}
        charging={charging}
        sessionOpen={open !== null}
        transactionId={open?.transactionId ?? null}
        progress={progress}
        headlineKwh={chargeKwh !== null ? kwh(chargeKwh, 2) : null}
        // the last finished charge, where "Ready" would be: how far it got and when
        finished={finished}
        // the figures below are of the charge that runs, else of the last finished one
        showStats={charging || last !== null}
        energy={charging ? (chargeKwh !== null ? kwh(chargeKwh, 2) : null) : last ? kwh(last.kwh, 2) : null}
        startedAt={charging ? (open?.startedAt ?? null) : null}
        durationText={!charging && last ? span(last.durationS) : null}
        cost={charging ? (chargeKwh !== null ? inr(chargeKwh * tariff) : null) : last && last.cost !== null ? inr(last.cost) : null}
        shares={charging ? (open?.shares ?? null) : (last?.shares ?? null)}
        // the live readings, as tiles beside the car on a wide screen
        live={[
          { label: "Power", value: powerKw !== null ? u.format(powerKw, "kW", "power_active_import_kw", 2) : "—" },
          { label: "Current", value: n.current_import_l1_a !== null ? u.format(n.current_import_l1_a, "A", "current_import_l1_a", 1) : "—" },
          { label: "Voltage", value: n.voltage_l1_n_v !== null ? `${Math.round(n.voltage_l1_n_v)} V` : "—" },
        ]}
      />
      <Statistic history={history} chargerId={chargerId} />
      <History sessions={history.recent} onOpen={openCharge} chargerId={chargerId} />
      {/* room for the control that is fixed to the bottom of the screen on a phone */}
      <div aria-hidden="true" className="h-24 max-lg:order-last sm:hidden" />
    </div>
  );
}
