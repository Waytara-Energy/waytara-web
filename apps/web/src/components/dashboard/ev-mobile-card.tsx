"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { Activity, Clock, Gauge, IndianRupee, Zap } from "lucide-react";
import { parseTarget } from "@/lib/ev-control";
import { kmText, minutesText, type ChargeProgress } from "@/lib/ev-car";
import type { SourceShare } from "@/lib/ev-sessions";
import { cn } from "@/lib/utils";
import { useEvCharge } from "./ev-charge-control";
import { FlowFill } from "./flow-fill";
import { SlideToConfirm } from "./slide-to-confirm";
import { SOURCE, unknownAsSolar } from "./ev-source";
import { EvSourceDetail } from "./ev-source-detail";

/** 5420 s -> "1 h 30 min", 154 s -> "3 min" (under a minute is "< 1 min"). */
function span(s: number): string {
  const min = Math.round(s / 60);
  if (min < 1) return "< 1 min";
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")} min`;
}

function Stat({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-border p-3">
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5 shrink-0" />
        <span className="truncate">{label}</span>
      </span>
      <p className="mt-1.5 truncate text-lg font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

/** Where the energy of the charge came from: one bar split into solar, battery and grid, and each one's share beneath it. */
function Source({ shares, charging }: { shares: SourceShare[] | null; charging: boolean }) {
  const parts = (shares ?? []).filter((s) => s.pct > 0);
  const total = Math.min(100, parts.reduce((a, s) => a + s.pct, 0));
  const shown = (["solar", "battery", "grid"] as const).map((key) => {
    const s = shares?.find((x) => x.key === key);
    return { key, pct: s?.pct ?? null, kwh: s?.kwh ?? null };
  });
  return (
    <div className="rounded-2xl border border-border p-3.5">
      <p className="text-xs text-muted-foreground">Source of the energy</p>
      <div className="relative mt-2.5 flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-foreground/[0.08] [container-type:inline-size]" role="img" aria-label={shares ? parts.map((s) => `${s.label} ${Math.round(s.pct)}%`).join(", ") : "Source not measured"}>
        {parts.map((s) => (
          <span key={s.key} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${s.pct}%`, backgroundColor: SOURCE[s.key].color }} />
        ))}
        {/* the glitter of the Crystalized Ball's dust runs along what has been delivered (only over the parts that are there) */}
        {total > 0 && (
          <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${total}%` }}>
            <FlowFill color="#ffffff" speed={charging ? 1 : 0.5} className="opacity-90" />
          </div>
        )}
      </div>
      <ul className="mt-3 grid grid-cols-3 gap-2">
        {shown.map(({ key, pct, kwh }) => {
          const Icon = SOURCE[key].icon;
          return (
            <li key={key} className="flex min-w-0 items-center gap-2">
              <span className="grid size-7 shrink-0 place-items-center rounded-lg" style={{ backgroundColor: `color-mix(in srgb, ${SOURCE[key].color} 18%, transparent)`, color: SOURCE[key].color }}>
                <Icon className="size-3.5" />
              </span>
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-sm font-semibold tabular-nums text-foreground">{pct === null ? "—" : `${Math.round(pct)}%`}</span>
                <span className="block truncate text-[11px] tabular-nums text-muted-foreground">{kwh === null ? "—" : `${kwh.toFixed(2)} kWh`}</span>
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
  finished,
  showStats,
  energy,
  startedAt,
  durationText,
  cost,
  shares,
  live = null,
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
  /** The last finished charge, shown where "Ready" would be when none runs: how far it got (percent; completed = it reached its goal, or had none), the date and time. */
  finished: { percent: number; completed: boolean; when: string } | null;
  /** Whether the energy, time, cost and source tiles are shown (a charge runs, or there is a last one). */
  showStats: boolean;
  energy: string | null;
  /** When the charge that runs began (ISO), for its time so far; null when none runs. */
  startedAt: string | null;
  /** The time of the last charge in words, when none runs. */
  durationText: string | null;
  cost: string | null;
  shares: SourceShare[] | null;
  /** The live electrical readings (power, current, voltage), shown as tiles on a wider screen while a charge runs. */
  live?: { label: string; value: string }[] | null;
}) {
  const { busy, waiting, error, notice, pending, start, stop } = useEvCharge({ chargerId, sessionOpen, transactionId });
  // what the meters could not place is shown as solar (see unknownAsSolar)
  const sources = React.useMemo(() => unknownAsSolar(shares), [shares]);
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
  // (a finished charge is shown only when the charger is reachable and none runs)
  const done = !charging && !offline ? finished : null;
  const aside = (
    charging
      ? [
          progress.minutesLeft !== null ? { label: "Time left", value: minutesText(progress.minutesLeft) } : headlineKwh !== null && percent !== null ? { label: "This charge", value: headlineKwh } : null,
          progress.kmAdded !== null ? { label: "Range added", value: `+${kmText(progress.kmAdded)}` } : null,
        ]
      : done
        ? [{ label: "Last charge", value: done.when }]
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
      : done
        ? done.completed
          ? "Completed"
          : (
              <>
                {Math.round(done.percent)}
                <span className="ml-0.5 text-2xl font-normal text-muted-foreground">%</span>
              </>
            )
        : "Ready";
  // how full the bar is: the charge that runs (see above), else the last one's
  const fill = charging ? percent : done ? done.percent : null;

  const showField = !on && !starting && !offline;
  const startDisabled = bad || starting || offline;
  // The words on the slide. To start: the plug is confirmed by sliding, and the limit that has been set is read back (an unreadable one stops the start).
  const slide = on
    ? stopping
      ? { label: "Stopping…", hint: "ending the charge" }
      : { label: "Slide to stop", hint: "ends this charge" }
    : starting
      ? { label: "Starting…", hint: "waiting for the charger" }
      : offline
        ? { label: "Charger offline", hint: "it cannot be started now" }
        : bad
          ? { label: "Check the limit", hint: "kWh as a number, or empty" }
          : { label: "Slide to start", hint: target !== null ? `plug connected · ${target} kWh` : "plug connected · no limit" };

  return (
    // On a phone one column that is as tall as its content and starts right under the header: the car, the charge, the figures, the source of the energy and the
    // start of the history. From `lg` up the section has no box of its own and its two parts are cells of the page's grid: the car with the charge on the left, the
    // figures, the source, the live readings and the control on the right (the history and the statistic are the row below).
    <section aria-label={`Charger: ${offline ? "offline" : charging ? "charging" : status}`} className="relative flex flex-col pt-2 lg:contents">
      <div className="flex flex-col lg:col-span-7 lg:row-start-1 lg:min-h-0">
      {/* the car, standing in a pool of light that is green while it charges */}
      <Link href={`/dashboard/monitoring?device=${encodeURIComponent(chargerId)}#ev`} aria-label="Open the charger on Monitoring" className="relative mb-3 block outline-none focus-visible:ring-2 focus-visible:ring-ring lg:mb-0 lg:flex lg:min-h-0 lg:flex-1 lg:items-end lg:justify-center">
        <span aria-hidden="true" className={cn("absolute inset-x-[8%] bottom-0 h-10 rounded-full blur-2xl transition-colors duration-700", charging ? "bg-emerald-500/45 motion-safe:animate-pulse" : "bg-foreground/10")} />
        <Image src="/images/ev-car-nexon-v2.webp" alt="" width={1400} height={796} sizes="(max-width: 640px) 81vw, 40vw" className={cn("relative mx-auto h-auto w-[92%] max-w-[34rem] transition-[filter] lg:h-full lg:max-h-full lg:w-auto lg:max-w-full lg:object-contain duration-700 dark:brightness-125 dark:contrast-110", !charging && "opacity-90")} />
        {/* the car's own reflection on the floor */}
        <span aria-hidden="true" className="pointer-events-none absolute inset-x-[16%] -bottom-1 h-3 rounded-full bg-black/25 blur-md dark:bg-black/60" />
      </Link>

      <div className="mt-4 flex items-end justify-between gap-4">
        <p className={cn("font-light leading-none tracking-tight tabular-nums", done?.completed ? "text-5xl lg:text-6xl" : "text-6xl lg:text-7xl", charging ? "text-foreground" : "text-muted-foreground")}>{headline}</p>
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
      <div className="mt-4 h-7 overflow-hidden rounded-full bg-foreground/[0.08] p-1 [container-type:inline-size]" role="progressbar" aria-label="Charge progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={fill !== null ? Math.round(fill) : undefined}>
        {charging && percent === null ? (
          <div className="relative h-full w-full origin-left overflow-hidden rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400 motion-safe:animate-car-charge">
            <FlowFill speed={1.4} />
          </div>
        ) : (
          <div className="relative h-full overflow-hidden rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-[width] duration-700 ease-out" style={{ width: `${Math.max(charging ? 4 : 0, fill ?? 0)}%` }}>
            {/* power flowing through what has been filled: the dust of a Crystalized Ball, lively while charging and calm once the charge is complete */}
            {fill !== null && fill > 0 && <FlowFill speed={charging ? 1.4 : 0.5} />}
          </div>
        )}
      </div>

      </div>

      <div className="flex flex-col lg:col-span-5 lg:row-start-1 lg:min-h-0 lg:gap-3 lg:pt-2">
        {showStats ? (
          <div className="flex flex-col lg:min-h-0 lg:flex-1">
            <div className="mt-5 grid grid-cols-3 gap-2.5 lg:mt-0">
              <Stat icon={Zap} label="Energy" value={energy ?? "—"} />
              <Stat icon={Clock} label="Duration" value={duration ?? "—"} />
              <Stat icon={IndianRupee} label="Cost" value={cost ?? "—"} />
            </div>
            <div className="mt-2.5 lg:hidden">
              <Source shares={sources} charging={charging} />
            </div>
            {/* a wide screen has the room for the source in detail: a column for each source, as wide as its share */}
            <EvSourceDetail shares={sources} total={energy} charging={charging} className="mt-3 hidden lg:flex lg:flex-1" />
          </div>
        ) : (
          <div className="hidden lg:block lg:flex-1" />
        )}

        {/* the live readings of a running charge (a wider screen only) */}
        {charging && live && live.length > 0 && (
          <div className="grid grid-cols-3 gap-2.5 max-sm:hidden">
            {live.map((l, i) => (
              <Stat key={l.label} icon={[Gauge, Activity, Zap][i] ?? Zap} label={l.label} value={l.value} />
            ))}
          </div>
        )}

      {/* The control, fixed to the bottom of the screen (only while this is the slide being shown). Before a charge: the kWh to stop after (empty = no
          limit) and Start. Once it runs: Stop, the full width. (The carousel's dots are not shown on a phone, so nothing is under it.) */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-5 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))] backdrop-blur-md group-aria-hidden/slide:hidden sm:static sm:z-auto sm:mt-4 sm:border-t-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none lg:mt-0">
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
          <SlideToConfirm
            className="min-w-0 flex-1"
            tone={on ? "stop" : "start"}
            label={slide.label}
            hint={slide.hint}
            busy={stopping || starting || pending}
            disabled={on ? false : startDisabled && !starting}
            ariaLabel={on ? "Slide to stop charging" : "Slide to start charging"}
            onConfirm={() => (on ? void stop() : void start(target))}
          />
        </div>
      </div>
      </div>
    </section>
  );
}
