"use client";

import * as React from "react";
import Image from "next/image";
import { Activity, AlertTriangle, BatteryCharging, ChevronLeft, ChevronRight, Gauge, Plug, Thermometer, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EvChargeControl } from "./ev-charge-control";
import { getConnectorStatusLabel, type StatusInfo } from "@/lib/ev-charger-catalog";
import type { EnumOption } from "@/lib/enum-labels";
import type { ChargingSessionDetail, RecentChargingStats } from "@/lib/device-overview";
import { useUnits } from "@/components/units-provider";

const DEFAULT_RATED_POWER_W = 7400;

function formatTime(ts: string): string {
  return new Date(ts).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

function formatDuration(startedAt: string, endedAt: string | null): string {
  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  const minutes = Math.max(0, Math.round((end - start) / 60000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function durationHours(startedAt: string, endedAt: string | null): number {
  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  return Math.max(1 / 60, (end - start) / 3_600_000);
}

function formatInr(amount: number): string {
  return `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function formatInrRate(amount: number): string {
  return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const TONE_TEXT: Record<StatusInfo["tone"], string> = {
  good: "text-emerald-500",
  bad: "text-rose-500",
  neutral: "text-muted-foreground",
};

// Charging (good) reads as an active bolt, Faulted (bad) as a warning —
// every other connector_status (Available, Preparing, Suspended) is
// "neutral", the charger just sitting there plugged in or not.
const TONE_ICON: Record<StatusInfo["tone"], LucideIcon> = {
  good: Zap,
  bad: AlertTriangle,
  neutral: Plug,
};

// Lucide's own "zap" glyph (node_modules/lucide-react .../icons/zap.mjs) —
// duplicated here rather than importing the component because the running-
// outline effect below needs its own <path>, rendered twice with different
// fill/stroke treatments; lucide's <Zap> only ever renders the one.
const BOLT_PATH =
  "M15.914 4a1.5 1.5 0 00-2.474-1.561l-9 9A1.5 1.5 0 005.5 14h4.002a.5.5 0 01.471.666L8.086 20a1.5 1.5 0 002.475 1.56l9-9A1.5 1.5 0 0018.5 10h-3.997a.5.5 0 01-.472-.667z";

/** The bolt, animated for "actively charging" instead of a generic
 *  spinner or a plain opacity pulse: a short dash loops continuously
 *  around the bolt's own outline (`pathLength={1}` normalizes stroke-
 *  dasharray/offset to fractions of the path's length, so this doesn't
 *  need the real SVG path length computed by hand) while the fill
 *  underneath it breathes in time — see the bolt-trace/bolt-fill
 *  keyframes in globals.css. Static (muted, solid) when nothing's
 *  charging. */
function BoltIcon({ active }: { active: boolean }) {
  if (!active) {
    return (
      <svg viewBox="0 0 24 24" className="h-8 w-8 shrink-0 self-center text-muted-foreground">
        <path d={BOLT_PATH} fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8 shrink-0 self-center text-emerald-500 drop-shadow-[0_0_6px_rgba(16,185,129,0.55)]">
      <path d={BOLT_PATH} fill="currentColor" className="animate-bolt-fill" />
      <path
        d={BOLT_PATH}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray="0.22 0.78"
        className="animate-bolt-trace"
      />
    </svg>
  );
}

/** Colored status text, read off its tone (good/bad/neutral) the same way
 *  getConnectorStatusLabel already classifies every connector_status
 *  value — plain, no pill/dot background. `icon` adds the tone's own
 *  glyph ahead of the word; the live power-readout line (SessionSlide)
 *  skips it since the animated bolt icon right next to it already serves
 *  as that line's status indicator. */
function StatusText({
  label,
  tone,
  suffix,
  icon,
}: {
  label: string;
  tone: StatusInfo["tone"];
  suffix?: string;
  icon?: boolean;
}) {
  const Icon = TONE_ICON[tone];
  return (
    <span className={`inline-flex items-center gap-1.5 text-base font-medium ${TONE_TEXT[tone]}`}>
      {icon && <Icon className="h-4 w-4" />}
      {label}
      {suffix && <span className="font-normal text-muted-foreground"> · {suffix}</span>}
    </span>
  );
}

/** The live/avg power reading, as the slide's own hero line — an animated
 *  lightning icon (the "live" indicator, replacing a separate pulsing dot)
 *  plus the kW number, with the status word sitting right beside it.
 *  Replaces the old radial gauge: reads faster at a glance than a ring
 *  did, and the number itself is what's actually changing tick to tick,
 *  not a percentage of an assumed rated capacity. */
function PowerReadout({
  kw,
  unit,
  active,
  label,
  tone,
  suffix,
}: {
  kw: string;
  unit: string;
  active: boolean;
  label: string;
  tone: StatusInfo["tone"];
  suffix?: string;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-2.5">
      <BoltIcon active={active} />
      <span className="text-4xl leading-none font-bold tabular-nums text-foreground">{kw}</span>
      <span className="text-lg text-muted-foreground">{unit}</span>
      <StatusText label={label} tone={tone} suffix={suffix} />
    </div>
  );
}

/** Energy delivered, styled to match PowerReadout exactly (icon + the
 *  same big bold number, same unit treatment) rather than the smaller
 *  boxed BigStat tiles below it — it's the slide's other headline number,
 *  not a secondary stat. */
function EnergyReadout({ kwh, unit, active }: { kwh: string; unit: string; active: boolean }) {
  return (
    <div className="flex flex-wrap items-baseline gap-2.5">
      <BatteryCharging className={`h-8 w-8 shrink-0 self-center ${active ? "text-emerald-500" : "text-muted-foreground"}`} />
      <span className="text-4xl leading-none font-bold tabular-nums text-foreground">{kwh}</span>
      <span className="text-lg text-muted-foreground">{unit}</span>
    </div>
  );
}

function BigStat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-muted/30 px-4 py-3.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl leading-none font-bold tabular-nums text-foreground">
        {value}
        {unit && <span className="ml-1 text-sm font-normal text-muted-foreground">{unit}</span>}
      </p>
    </div>
  );
}

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-xl bg-muted/20 py-3 text-center">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-lg leading-none font-semibold tabular-nums text-foreground">{value}</span>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}

/** A two-line written summary of past charging activity — a bold headline
 *  (matching the Power Generation chart's own trend-line style) plus a
 *  muted detail line underneath, deliberately worded around "past
 *  sessions" rather than a specific "yesterday"/"this week" window (the
 *  underlying figures still prefer yesterday's own numbers when there are
 *  any, falling back to the trailing week's, but neither word appears in
 *  the copy itself). A plain "nothing yet" line when there's no closed
 *  session at all to report. Right-aligned by its parent, opposite the
 *  "ready to charge" figure. */
function RecentHistoryLine({ stats }: { stats: RecentChargingStats | null }) {
  const u = useUnits();
  const hasYesterday = !!stats && stats.yesterdaySessions > 0;
  const hasWeek = !!stats && stats.weekSessions > 0;
  const sessionCount = hasYesterday ? stats!.yesterdaySessions : hasWeek ? stats!.weekSessions : 0;
  const energyKwh = hasYesterday ? stats!.yesterdayEnergyKwh : hasWeek ? stats!.weekEnergyKwh : 0;

  if (!hasYesterday && !hasWeek) {
    return (
      <div>
        <p className="text-sm font-semibold text-muted-foreground">No Past Sessions</p>
        <p className="text-sm text-muted-foreground">Start your first session today.</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm font-semibold text-emerald-500">Past Charging Sessions</p>
      <p className="text-sm text-muted-foreground">
        {sessionCount} session{sessionCount === 1 ? "" : "s"} · {u.format(energyKwh, "kWh", null, 1)} delivered
      </p>
    </div>
  );
}

/** The device is idle — no open session right now. Shown as the leading
 *  "slide" whenever that's true (see ChargingSessionsCarousel), in place
 *  of the live session view: the charger's real connector_status (almost
 *  always Available, but this reads the actual value rather than assuming
 *  it), a Start Charging control, and — once there's history — a same-day
 *  summary so the space isn't just empty while nothing's happening. */
function IdleSlide({
  deviceId,
  ratedPowerW,
  connectorStatus,
  connectorStatusOptions,
  sessionCount,
  energyToday,
  recentStats,
  connected,
}: {
  deviceId: string;
  connected: boolean | null;
  ratedPowerW: number;
  connectorStatus: number | null;
  connectorStatusOptions: EnumOption[];
  sessionCount: number;
  energyToday: number;
  recentStats: RecentChargingStats | null;
}) {
  const u = useUnits();
  // This slide only ever renders when there's no open session — if the
  // charger also has no live connector_status reading yet, the rest of
  // this slide is already asserting "ready to charge" (rated power, an
  // enabled Start Charging button), so echoing getConnectorStatusLabel's
  // generic "No data" right above it read as a flat contradiction. Fall
  // back to whatever a real Available (code 0) reading would show instead
  // of the unknown-state message — looked up through the same enum
  // options rather than hardcoded, in case the label text itself differs.
  const status =
    connectorStatus === null ? getConnectorStatusLabel(0, connectorStatusOptions) : getConnectorStatusLabel(connectorStatus, connectorStatusOptions);
  return (
    <div className="flex flex-col gap-6">
      <StatusText label={status.label} tone={status.tone} icon />

      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-sm text-muted-foreground">Ready to charge</p>
          <p className="mt-1 text-4xl leading-none font-bold text-foreground">
            {u.format(ratedPowerW / 1000, "kW", null, 1, false)}
            <span className="text-lg font-normal text-muted-foreground"> {u.unit("kW")} available</span>
          </p>
        </div>
        <div className="text-right">
          <RecentHistoryLine stats={recentStats} />
        </div>
      </div>

      {sessionCount > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <BigStat label="Sessions Today" value={String(sessionCount)} />
          <BigStat label="Energy Today" value={energyToday.toFixed(1)} unit="kWh" />
        </div>
      )}

      {/* a real charge: the hub asks the charger to start (OCPP RemoteStartTransaction) */}
      <EvChargeControl chargerId={deviceId} sessionOpen={false} transactionId={null} connected={connected} className="mt-auto" />
    </div>
  );
}

/** One session's full detail. Live current/voltage/temperature only ever
 *  reflect the charger's *latest* reading, so they're only shown for the
 *  one open session — a closed session has nothing live left to report,
 *  its power reading is the session's own average instead. */
function SessionSlide({
  deviceId,
  session,
  currentPowerW,
  currentA,
  voltageV,
  temperatureC,
  connectorStatus,
  connectorStatusOptions,
  tariffRate,
  showCost,
  transactionId,
  connected,
}: {
  deviceId: string;
  transactionId: number | null;
  connected: boolean | null;
  session: ChargingSessionDetail;
  currentPowerW: number | null;
  currentA: number | null;
  voltageV: number | null;
  temperatureC: number | null;
  connectorStatus: number | null;
  connectorStatusOptions: EnumOption[];
  tariffRate: number;
  showCost: boolean;
}) {
  const u = useUnits();
  const cost = session.energyKwh !== null ? session.energyKwh * tariffRate : null;
  const avgPowerW = session.energyKwh !== null ? (session.energyKwh * 1000) / durationHours(session.startedAt, session.endedAt) : null;
  const powerW = session.isOpen ? currentPowerW : avgPowerW;
  const powerKw = powerW !== null ? powerW / 1000 : null;
  const status = session.isOpen
    ? getConnectorStatusLabel(connectorStatus, connectorStatusOptions)
    : { label: "Complete", tone: "neutral" as const };

  return (
    <div className="flex flex-col gap-6">
      <PowerReadout
        kw={powerKw !== null ? u.format(powerKw, "kW", "power_active_import_kw", 1, false) : "0.0"}
        unit={u.unit("kW", "power_active_import_kw")}
        active={session.isOpen}
        label={status.label}
        tone={status.tone}
        suffix={!session.isOpen ? (session.stopReason ?? undefined) : undefined}
      />

      <EnergyReadout kwh={session.energyKwh !== null ? u.format(session.energyKwh, "kWh", "ev_energy_today_kwh", 1, false) : "—"} unit={u.unit("kWh", "ev_energy_today_kwh")} active={session.isOpen} />

      {showCost && (
        <BigStat label={`Total Cost · ${formatInrRate(tariffRate)}/kWh`} value={cost !== null ? formatInr(cost) : "—"} />
      )}

      <div className="grid grid-cols-3 gap-3">
        <MiniStat icon={<Activity className="h-4 w-4" />} label="Current" value={session.isOpen && currentA !== null ? u.format(currentA, "A", null, 1) : "—"} />
        <MiniStat icon={<Gauge className="h-4 w-4" />} label="Voltage" value={session.isOpen && voltageV !== null ? u.format(voltageV, "V", null, 0) : "—"} />
        <MiniStat
          icon={<Thermometer className="h-4 w-4" />}
          label="Temperature"
          value={session.isOpen && temperatureC !== null ? u.format(temperatureC, "°C", null, 0) : "—"}
        />
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 rounded-xl bg-muted/20 py-2.5 text-sm text-muted-foreground">
        <span>
          Started <span className="font-semibold text-foreground">{formatTime(session.startedAt)}</span>
        </span>
        <span className="h-1 w-1 shrink-0 rounded-full bg-muted-foreground/40" />
        <span>
          Duration <span className="font-semibold text-foreground">{formatDuration(session.startedAt, session.endedAt)}</span>
        </span>
        <span className="h-1 w-1 shrink-0 rounded-full bg-muted-foreground/40" />
        <span>
          Ended <span className="font-semibold text-foreground">{session.endedAt ? formatTime(session.endedAt) : "In progress"}</span>
        </span>
      </div>

      {session.isOpen && <EvChargeControl chargerId={deviceId} sessionOpen transactionId={transactionId} connected={connected} className="mt-auto" />}
    </div>
  );
}

type Slide = { kind: "idle" } | { kind: "session"; session: ChargingSessionDetail };

/** "Charging Sessions" — the car image is rendered once, fixed on the
 *  left, entirely outside the part that changes; only the right-hand
 *  panel swaps as Prev/Next step through slides. Slides are: the open
 *  session (if any) always leading, otherwise a leading "idle" slide
 *  (charger status + Start Charging) — then every closed session after
 *  that, newest first. Combines what used to be two separate concerns
 *  (the hourly Energy Delivered bar/cost chart and the raw session data
 *  behind it) into one detailed, full-size view per session. Both Start
 *  and Stop are <EvChargeControl/>, which asks the charger itself (through
 *  the hub) to start or stop a real charge. */
export function ChargingSessionsCarousel({
  deviceId,
  sessions,
  ratedPowerW,
  currentPowerW,
  currentA,
  voltageV,
  temperatureC,
  connectorStatus,
  connectorStatusOptions,
  tariffRate,
  showCost = true,
  recentStats,
  transactionId = null,
  connected = null,
}: {
  deviceId: string;
  /** the OCPP transaction of the open session (what Stop asks the charger to end); null when none is open or it is not known */
  transactionId?: number | null;
  /** is the charger connected to WayTara right now (null = not known) */
  connected?: boolean | null;
  sessions: ChargingSessionDetail[];
  ratedPowerW: number | null;
  currentPowerW: number | null;
  currentA: number | null;
  voltageV: number | null;
  temperatureC: number | null;
  connectorStatus: number | null;
  /** connector_status's instrument_enum_values options — a plain array
   *  prop rather than the whole enum Map, since this is a client
   *  component with no DB access of its own. */
  connectorStatusOptions: EnumOption[];
  tariffRate: number;
  /** False for residential/independent-villa sites (site.propertyType ===
   *  "residential_independent_villas") — cost isn't shown there; every
   *  other property type keeps it. Defaults true so existing callers are
   *  unaffected if this is ever omitted. */
  showCost?: boolean;
  /** Yesterday's/the trailing week's charging history, for the idle
   *  slide's "no active session" view — null degrades to a plain "no
   *  history yet" line rather than hiding the section. */
  recentStats: RecentChargingStats | null;
}) {
  const rated = ratedPowerW ?? DEFAULT_RATED_POWER_W;
  const openSession = sessions.find((s) => s.isOpen) ?? null;
  const closedSessions = sessions.filter((s) => !s.isOpen);

  const slides: Slide[] = openSession
    ? [{ kind: "session", session: openSession }, ...closedSessions.map((session) => ({ kind: "session" as const, session }))]
    : [{ kind: "idle" as const }, ...closedSessions.map((session) => ({ kind: "session" as const, session }))];

  const [index, setIndex] = React.useState(0);

  // A newly-opened or newly-closed session changes what slide 0 even is —
  // snap back to the front rather than leaving the slider pointed at
  // whatever index used to be there. Not remounted via `key` instead (the
  // usual alternative to this pattern) since that would also reset
  // startVideoRef's own playback below, restarting the charge animation
  // on every session-list change rather than only when it should loop.
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIndex(0);
  }, [openSession?.id, sessions.length]);

  // charging-start.mp4 loops for as long as a session is actually open —
  // driven straight off `isCharging`, not a one-shot timer, so it keeps
  // playing whether the session was just started here or the page merely
  // landed mid-session. `isCharging` itself is already kept live by the
  // page's own RealtimeRefresh on charging_sessions INSERT/UPDATE (see
  // page.tsx) — a session ending anywhere (the Stop button here, another
  // tab, or the simulator auto-closing one on a fault) lands a fresh
  // `sessions` prop within its ~400ms debounce, `openSession` goes back to
  // null, and this effect pauses + fades the video back to the static
  // image without any extra subscription of its own. Crossfades rather
  // than replacing the image outright; see the video's own container
  // below for why it gets a deliberate dark backdrop instead of trying to
  // key its black background out.
  const isCharging = !!openSession;
  const startVideoRef = React.useRef<HTMLVideoElement>(null);
  React.useEffect(() => {
    const video = startVideoRef.current;
    if (!video) return;
    if (isCharging) {
      video.currentTime = 0;
      video.playbackRate = 0.75;
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [isCharging]);

  const current = slides[Math.min(index, slides.length - 1)];
  const energyToday = sessions.reduce((sum, s) => sum + (s.energyKwh ?? 0), 0);

  return (
    <Card className="border-none bg-transparent shadow-none">
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 px-0">
        <CardTitle className="text-xl">Charging Sessions</CardTitle>
        {slides.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {index + 1} / {slides.length}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={index === 0}
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={index === slides.length - 1}
              onClick={() => setIndex((i) => Math.min(slides.length - 1, i + 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="px-0">
        <div className="flex flex-col gap-6 sm:flex-row">
          <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden rounded-2xl sm:aspect-auto sm:min-h-[420px] sm:w-[38%]">
            <Image
              src="/images/ev-charging-car.webp"
              alt=""
              fill
              sizes="(min-width: 640px) 38vw, 100vw"
              className={`object-contain transition-opacity duration-700 ${isCharging ? "opacity-0" : "opacity-100"}`}
            />
            {/* The clip's own background is black, and its car isn't pure
                black either (dark grey, close in tone), so a screen/lighten
                blend-mode trick to key the background out would wash the
                car out too, not just the backdrop — not a clean win. Giving
                it a deliberate dark backdrop instead reads as an
                intentional "video frame" on both light and dark themes,
                with no per-frame processing. */}
            <div
              className={`absolute inset-0 flex items-center justify-center bg-black transition-opacity duration-700 ${
                isCharging ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0"
              }`}
            >
              <video ref={startVideoRef} src="/videos/charging-start.mp4" muted loop playsInline className="h-full w-full object-contain" />
            </div>
          </div>

          <div className="flex flex-1 flex-col sm:justify-center">
            {current.kind === "idle" ? (
              <IdleSlide
                deviceId={deviceId}
                ratedPowerW={rated}
                connectorStatus={connectorStatus}
                connectorStatusOptions={connectorStatusOptions}
                sessionCount={sessions.length}
                energyToday={energyToday}
                recentStats={recentStats}
                connected={connected}
              />
            ) : (
              <SessionSlide
                deviceId={deviceId}
                session={current.session}
                currentPowerW={current.session.isOpen ? currentPowerW : null}
                currentA={current.session.isOpen ? currentA : null}
                voltageV={current.session.isOpen ? voltageV : null}
                temperatureC={current.session.isOpen ? temperatureC : null}
                connectorStatus={connectorStatus}
                connectorStatusOptions={connectorStatusOptions}
                tariffRate={tariffRate}
                showCost={showCost}
                transactionId={transactionId}
                connected={connected}
              />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
