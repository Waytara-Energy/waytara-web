"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { BatteryCharging, Clock, IndianRupee, Loader2, Power, Sun, Zap } from "lucide-react";
import { parseTarget } from "@/lib/ev-control";
import { kmText, minutesText, type ChargeProgress } from "@/lib/ev-car";
import type { SourceShare } from "@/lib/ev-sessions";
import { cn } from "@/lib/utils";
import { useEvCharge } from "./ev-charge-control";
import { FLOW } from "./flow-colors";

/** The same colours and icons as the charge's own detail and the energy flow: solar green, battery amber, grid grey. */
const SOURCE = {
  solar: { icon: Sun, color: FLOW.producing },
  battery: { icon: BatteryCharging, color: FLOW.drawing },
  grid: { icon: Zap, color: FLOW.idle },
  unattributed: { icon: Zap, color: "var(--border)" },
} as const;

/** 5420 s -> "1 h 30 min", 154 s -> "3 min" (under a minute is "< 1 min"). */
function span(s: number): string {
  const min = Math.round(s / 60);
  if (min < 1) return "< 1 min";
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")} min`;
}

function Stat({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl bg-foreground/[0.05] p-3">
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5 shrink-0" />
        <span className="truncate">{label}</span>
      </span>
      <p className="mt-1.5 truncate text-lg font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

/** Where the energy of the charge came from: one bar split into solar, battery and grid, and each one's share beneath it. */
function Source({ shares }: { shares: SourceShare[] | null }) {
  const parts = (shares ?? []).filter((s) => s.pct > 0);
  const shown = (["solar", "battery", "grid"] as const).map((key) => ({ key, pct: shares?.find((s) => s.key === key)?.pct ?? null }));
  return (
    <div className="rounded-2xl bg-foreground/[0.05] p-3.5">
      <p className="text-xs text-muted-foreground">Source of the energy</p>
      <div className="mt-2.5 flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-foreground/[0.08]" role="img" aria-label={shares ? parts.map((s) => `${s.label} ${Math.round(s.pct)}%`).join(", ") : "Source not measured"}>
        {parts.map((s) => (
          <span key={s.key} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${s.pct}%`, backgroundColor: SOURCE[s.key].color }} />
        ))}
      </div>
      <ul className="mt-3 grid grid-cols-3 gap-2">
        {shown.map(({ key, pct }) => {
          const Icon = SOURCE[key].icon;
          return (
            <li key={key} className="flex min-w-0 items-center gap-2">
              <span className="grid size-7 shrink-0 place-items-center rounded-lg" style={{ backgroundColor: `color-mix(in srgb, ${SOURCE[key].color} 18%, transparent)`, color: SOURCE[key].color }}>
                <Icon className="size-3.5" />
              </span>
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-[11px] capitalize text-muted-foreground">{key}</span>
                <span className="block truncate text-sm font-semibold tabular-nums text-foreground">{pct === null ? "—" : `${Math.round(pct)}%`}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * A charger's Overview on a phone, in the way of a car's charging screen: the car, how far the charge has got in large figures with what it
 * means beside it (time left, distance added), a bar for the progress, the energy, the time and the cost of the charge (this one, or the last one
 * when none runs) and where its energy came from (solar, battery, grid), and, fixed to the bottom of the screen, the control: before a charge a
 * field for how many kWh to stop after (empty = no limit) beside a Start button; once it has started the field goes and Stop fills the width.
 * Everything comes from the page, which has the live numbers. Phones only (the page shows its own wider layout from `sm` up).
 */
export function EvMobileCard({
  chargerId,
  connected,
  status,
  charging,
  sessionOpen,
  transactionId,
  progress,
  headlineKwh,
  caption,
  when,
  energy,
  startedAt,
  durationText,
  cost,
  shares,
}: {
  chargerId: string;
  connected: boolean | null;
  /** The connector's status in words (Available, Charging ...). */
  status: string;
  charging: boolean;
  sessionOpen: boolean;
  transactionId: number | null;
  progress: ChargeProgress;
  /** The energy of this charge in words ("3.40 kWh"), or null. */
  headlineKwh: string | null;
  /** Which charge the figures below are: "This charge" while one runs, else "Last charge" (null = none to show). */
  caption: string | null;
  /** When it was, at the end of the heading line ("Since 6:47 pm", "4 Nov, 6:47 pm"). */
  when: string | null;
  energy: string | null;
  /** When the charge that runs began (ISO), for its time so far; null when none runs. */
  startedAt: string | null;
  /** The time of the last charge in words, when none runs. */
  durationText: string | null;
  cost: string | null;
  shares: SourceShare[] | null;
}) {
  const { busy, waiting, error, notice, pending, start, stop } = useEvCharge({ chargerId, sessionOpen, transactionId });
  const [text, setText] = React.useState("");
  const typed = parseTarget(text);
  const empty = text.trim() === "";
  const bad = !empty && !typed.ok;
  const target = !empty && typed.ok ? typed.kwh : null;

  const on = sessionOpen || charging;
  const offline = connected === false;
  const stopping = busy === "stop";
  const starting = busy === "start" || waiting;
  // the time so far of the charge that runs, moved on every 30 seconds
  const [now, setNow] = React.useState<number | null>(null);
  React.useEffect(() => {
    if (!startedAt) return;
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, [startedAt]);
  const duration = startedAt ? (now === null ? null : span(Math.max(0, (now - Date.parse(startedAt)) / 1000))) : durationText;

  const percent = progress.percent;
  // what stands on the right of the large figure
  const aside = (
    charging
      ? [
          progress.minutesLeft !== null ? { label: "Time left", value: minutesText(progress.minutesLeft) } : headlineKwh !== null && percent !== null ? { label: "This charge", value: headlineKwh } : null,
          progress.kmAdded !== null ? { label: "Range added", value: `+${kmText(progress.kmAdded)}` } : null,
        ]
      : []
  ).filter((x): x is { label: string; value: string } => x !== null);

  const headline = charging
    ? percent !== null
      ? (
          <>
            {Math.round(percent)}
            <span className="ml-0.5 text-2xl font-normal text-muted-foreground">%</span>
          </>
        )
      : (headlineKwh ?? "Charging")
    : offline
      ? "Offline"
      : "Ready";

  const showField = !on && !starting && !offline;
  const startDisabled = bad || starting || offline;
  const label = on ? (stopping ? "Stopping…" : "Stop charging") : starting ? "Starting…" : offline ? "Charger offline" : "Start charging";

  return (
    // At first the screen shows this section down to the source of the energy and nothing of what follows: it is at least as tall as the room above the fixed
    // control (the screen less the header and the control with the room under it for the dots), and its content sits at the bottom, so any spare height is
    // space above the car. That spare height is cut by a fifth: the section is 80 % of that room plus a fifth of its content's height (about 107 % of the
    // screen's width), so the space above the car is about 20 % smaller than it first was.
    <section aria-label={`Charger: ${offline ? "offline" : charging ? "charging" : status}`} className="relative flex min-h-[calc(0.8*(100svh-8rem-var(--overview-dots-room,0.75rem))+21.4vw)] flex-col justify-end pt-2 sm:hidden">
      {/* the car, standing in a pool of light that is green while it charges */}
      <Link href={`/dashboard/monitoring?device=${encodeURIComponent(chargerId)}#ev`} aria-label="Open the charger on Monitoring" className="relative block outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span aria-hidden="true" className={cn("absolute inset-x-2 bottom-0 h-10 rounded-full blur-2xl transition-colors duration-700", charging ? "bg-emerald-500/45 motion-safe:animate-pulse" : "bg-foreground/10")} />
        <Image src="/images/ev-car.webp" alt="" width={1200} height={416} sizes="(max-width: 640px) 92vw, 0px" className={cn("relative h-auto w-full transition-[filter] duration-700 dark:brightness-125 dark:contrast-110", !charging && "opacity-90")} />
        {/* the car's own reflection on the floor */}
        <span aria-hidden="true" className="pointer-events-none absolute inset-x-6 -bottom-1 h-3 rounded-full bg-black/25 blur-md dark:bg-black/60" />
      </Link>

      <div className="mt-4 flex items-end justify-between gap-4">
        <p className={cn("text-6xl font-light leading-none tracking-tight tabular-nums", charging ? "text-foreground" : "text-muted-foreground")}>{headline}</p>
        {aside.length > 0 && (
          <div className="flex shrink-0 gap-4 pb-1 text-left">
            {aside.map((a) => (
              <div key={a.label}>
                <p className="text-[11px] leading-tight text-muted-foreground">{a.label}</p>
                <p className="text-sm font-semibold leading-tight tabular-nums text-foreground">{a.value}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* the progress: full of the amount booked (or the car's battery); running without an end when neither is known; empty when no charge runs */}
      <div className="mt-4 h-7 overflow-hidden rounded-full bg-foreground/[0.08] p-1" role="progressbar" aria-label="Charge progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent !== null ? Math.round(percent) : undefined}>
        {charging && percent === null ? (
          <div className="h-full w-full origin-left rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400 motion-safe:animate-car-charge" />
        ) : (
          <div className="relative h-full overflow-hidden rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-[width] duration-700 ease-out" style={{ width: `${Math.max(charging ? 4 : 0, percent ?? 0)}%` }}>
            {charging && <span aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle,rgba(255,255,255,0.55)_1px,transparent_1.5px)] bg-[length:9px_9px] opacity-60 motion-safe:animate-pulse" />}
          </div>
        )}
      </div>

      {caption !== null && (
        <>
          <div className="mt-5 flex items-baseline justify-between gap-3">
            <p className="text-sm font-semibold text-foreground">{caption}</p>
            {when !== null && <span className="text-xs text-muted-foreground">{when}</span>}
          </div>
          <div className="mt-2.5 grid grid-cols-3 gap-2.5">
            <Stat icon={Zap} label="Energy" value={energy ?? "—"} />
            <Stat icon={Clock} label="Duration" value={duration ?? "—"} />
            <Stat icon={IndianRupee} label="Cost" value={cost ?? "—"} />
          </div>
          <div className="mt-2.5">
            <Source shares={shares} />
          </div>
        </>
      )}

      {/* The control, fixed to the bottom of the screen (only while this is the slide being shown). Before a charge: the kWh to stop after (empty = no
          limit) and Start. Once it runs: Stop, the full width. The room under it is the carousel's dots when there are several devices. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-4 pt-3 pb-[var(--overview-dots-room,calc(0.75rem+env(safe-area-inset-bottom)))] backdrop-blur-md group-aria-hidden/slide:hidden">
        {error ? (
          <p role="alert" className="mb-2 text-center text-xs text-destructive">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p role="status" className="mb-2 text-center text-xs text-amber-700 dark:text-amber-400">
            {notice}
          </p>
        ) : null}
        <div className="flex items-center gap-3">
          {showField && (
            <label className={cn("flex h-12 w-[7.5rem] shrink-0 items-center gap-1.5 rounded-2xl border bg-background px-3 text-sm tabular-nums", bad ? "border-destructive text-destructive" : "border-border focus-within:border-emerald-500")}>
              <input inputMode="decimal" value={text} onChange={(e) => setText(e.target.value)} placeholder="No limit" aria-label="Stop after this many kWh (empty for no limit)" className="min-w-0 flex-1 bg-transparent font-medium outline-none placeholder:text-muted-foreground placeholder:font-normal" />
              <span className="text-xs text-muted-foreground">kWh</span>
            </label>
          )}
          <button
            type="button"
            aria-pressed={on}
            disabled={on ? stopping : startDisabled}
            onClick={() => (on ? void stop() : void start(target))}
            className={cn(
              "flex h-12 min-w-0 flex-1 items-center justify-center gap-2.5 rounded-2xl text-base font-semibold outline-none transition-all focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background enabled:active:scale-[0.99] disabled:cursor-not-allowed",
              !on && (offline || bad) ? "bg-muted text-muted-foreground/70" : on ? "bg-red-500/10 text-red-600 ring-1 ring-inset ring-red-500/40 focus-visible:ring-red-500 dark:text-red-400" : "bg-emerald-500/15 text-emerald-600 ring-1 ring-inset ring-emerald-500/40 focus-visible:ring-emerald-500 dark:text-emerald-400",
              (stopping || starting) && "cursor-wait"
            )}
          >
            {pending ? <Loader2 className="size-5 animate-spin" /> : <Power className="size-5" strokeWidth={2.25} />}
            {label}
          </button>
        </div>
      </div>
    </section>
  );
}
