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
import { unknownAsSolar } from "./ev-source";
import type { EvHistory, EvHistorySession } from "@/lib/ev-history";
import type { EvLogEntry } from "@/lib/ev-log";
import { useFitRows } from "@/hooks/use-fit-rows";
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

function History({ sessions, onOpen, chargerId }: { sessions: EvHistorySession[]; onOpen: (id: string) => void; chargerId: string }) {
  const u = useUnits();
  // only as many rows as fit (three on a phone); the arrow opens all of them
  const { ref, count } = useFitRows(3);
  return (
    <Card className="flex min-h-0 flex-col gap-2 p-4 border-border! bg-transparent! shadow-none! lg:col-span-7 lg:col-start-1 lg:row-start-2 lg:p-5">
      <Title href={`/dashboard/reports?device=${encodeURIComponent(chargerId)}#ev`}>History</Title>
      {sessions.length === 0 ? (
        <p className="grid flex-1 place-items-center text-sm text-muted-foreground">Finished charges are listed here.</p>
      ) : (
        <ul ref={ref} className="-mx-2 min-h-0 flex-1 divide-y overflow-hidden px-1">
          {sessions.slice(0, count).map((s) => {
            // the solar share is the one the source card shows (what the meters could not place counts as solar)
            const solar = s.shares ? (unknownAsSolar(s.shares)?.find((x) => x.key === "solar")?.pct ?? 0) : s.solarSharePct;
            return (
            <li key={s.id}>
              <button type="button" onClick={() => onOpen(s.id)} className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{`${dayMonth(s.startedAt)}, ${clock(s.startedAt)}`}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[span(s.durationS), s.cost !== null ? inr(s.cost) : null, solar !== null ? `${Math.round(solar)}% solar` : null, s.closedAutomatically ? "closed automatically" : null].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold tabular-nums text-foreground">{u.format(s.kwh, "kWh", "ev_energy_today_kwh", 2)}</p>
                  <p className="text-xs tabular-nums text-muted-foreground">{s.targetKwh !== null ? `of ${u.format(s.targetKwh, "kWh", "ev_energy_today_kwh", s.targetKwh % 1 === 0 ? 0 : 1)} booked` : "no limit"}</p>
                </div>
              </button>
            </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

const TONE_DOT: Record<EvLogEntry["tone"], string> = { good: "bg-emerald-500", info: "bg-sky-500", warn: "bg-amber-500", bad: "bg-red-500" };

/** The charger's log: what happened to it (a charge was asked for, started, ended; it went offline; a fault), newest first, only as many lines as fit; the Maintenance page has the rest. */
function ChargerLog({ log, chargerId }: { log: EvLogEntry[]; chargerId: string }) {
  const { ref, count } = useFitRows(3);
  return (
    <Card className="flex min-h-0 flex-col gap-2 p-4 border-border! bg-transparent! shadow-none! max-lg:order-last lg:col-span-5 lg:col-start-8 lg:row-start-2 lg:p-5">
      <Title href={`/dashboard/maintenance?device=${encodeURIComponent(chargerId)}`}>Charger log</Title>
      {log.length === 0 ? (
        <p className="grid flex-1 place-items-center text-sm text-muted-foreground">What happens to the charger is listed here.</p>
      ) : (
        <ul ref={ref} className="-mx-2 min-h-0 flex-1 divide-y overflow-hidden px-1">
          {log.slice(0, count).map((e) => (
            <li key={e.id} className="flex items-center gap-3 px-2 py-2">
              <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", TONE_DOT[e.tone])} />
              <p className="min-w-0 flex-1 truncate text-sm text-foreground">{e.text}</p>
              <p className="shrink-0 text-xs tabular-nums text-muted-foreground">{`${dayMonth(e.ts)}, ${clock(e.ts)}`}</p>
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
  log = [],
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
  /** The charger's latest log lines (who started and stopped it, faults, connection), newest first; the card shows as many as fit. */
  log?: EvLogEntry[];
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
    <div className="grid gap-4 lg:h-[max(calc(100svh-9.5rem),44rem)] lg:grid-cols-12 lg:grid-rows-[minmax(27rem,14fr)_minmax(14rem,6fr)]">
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
      <ChargerLog log={log} chargerId={chargerId} />
      <History sessions={history.recent} onOpen={openCharge} chargerId={chargerId} />
      {/* room for the control that is fixed to the bottom of the screen on a phone */}
      <div aria-hidden="true" className="h-24 max-lg:order-last sm:hidden" />
    </div>
  );
}
