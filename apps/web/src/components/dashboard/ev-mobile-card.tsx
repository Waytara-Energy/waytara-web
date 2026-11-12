"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { IndianRupee, Loader2, Power, Tag, Zap } from "lucide-react";
import { parseTarget } from "@/lib/ev-control";
import { kmText, minutesText, type ChargeProgress } from "@/lib/ev-car";
import { cn } from "@/lib/utils";
import { useEvCharge } from "./ev-charge-control";
import { Chip, PRESETS_KWH } from "./ev-power-panel";

const inr = (v: number, digits = 0) => `₹${v.toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;

function Row({ icon: Icon, label, value, accent = false }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-foreground/[0.06] text-muted-foreground">
        <Icon className="size-4" />
      </span>
      <span className="flex-1 text-sm text-muted-foreground">{label}</span>
      <span className={cn("text-lg font-semibold tabular-nums", accent ? "text-emerald-500" : "text-foreground")}>{value}</span>
    </div>
  );
}

/**
 * A charger's Overview on a phone, in the way of a car's charging screen: the car, how far the charge has got in large figures with what it
 * means beside it (time left, distance added), a bar for the progress, the tariff, the speed and the cost so far, and one large Start / Stop
 * button (before a charge, the choice of how many kWh to stop after sits above it). Everything comes from the page, which has the live numbers.
 * Phones only (the page shows its own wider layout from `sm` up).
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
  powerText,
  chargeKwh,
  tariff,
  lastCharge,
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
  /** The power now in words ("7.20 kW"), or null. */
  powerText: string | null;
  /** The energy of this charge in kWh, for the cost. */
  chargeKwh: number | null;
  /** The person's tariff, per kWh. */
  tariff: number;
  /** The newest finished charge in words, shown when no charge runs. */
  lastCharge: string | null;
}) {
  const { busy, waiting, error, notice, pending, start, stop } = useEvCharge({ chargerId, sessionOpen, transactionId });
  const [preset, setPreset] = React.useState<number | null>(null);
  const [other, setOther] = React.useState(false);
  const [text, setText] = React.useState("");
  const typed = parseTarget(text);
  const bad = other && text.trim() !== "" && !typed.ok;
  const target = other ? (typed.ok ? typed.kwh : null) : preset;

  const on = sessionOpen || charging;
  const offline = connected === false;
  const stopping = busy === "stop";
  const starting = busy === "start" || waiting;
  const disabled = stopping || starting || (!on && (offline || bad));
  const label = on ? (stopping ? "Stopping…" : "Stop charging") : starting ? "Starting…" : offline ? "Charger offline" : "Start charging";

  const percent = progress.percent;
  // what stands on the right of the large figure
  const aside = (
    charging
      ? [
          progress.minutesLeft !== null ? { label: "Time left", value: minutesText(progress.minutesLeft) } : headlineKwh !== null && percent !== null ? { label: "This charge", value: headlineKwh } : null,
          progress.kmAdded !== null ? { label: "Range added", value: `+${kmText(progress.kmAdded)}` } : null,
        ]
      : [lastCharge !== null ? { label: "Last charge", value: lastCharge } : null]
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

  return (
    <section aria-label="Charger" className="relative overflow-hidden rounded-3xl border border-border bg-card/75 px-4 pb-4 pt-5 shadow-sm backdrop-blur-md sm:hidden">
      <p className="text-center text-sm font-semibold text-foreground">{offline ? "Charger offline" : charging ? "Charging" : status}</p>

      {/* the car, standing in a pool of light that is green while it charges */}
      <Link href={`/dashboard/monitoring?device=${encodeURIComponent(chargerId)}#ev`} aria-label="Open the charger on Monitoring" className="relative mt-3 block outline-none focus-visible:ring-2 focus-visible:ring-ring">
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
          <div
            className="relative h-full overflow-hidden rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-[width] duration-700 ease-out"
            style={{ width: `${Math.max(charging ? 4 : 0, percent ?? 0)}%` }}
          >
            {charging && <span aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle,rgba(255,255,255,0.55)_1px,transparent_1.5px)] bg-[length:9px_9px] opacity-60 motion-safe:animate-pulse" />}
          </div>
        )}
      </div>

      <div className="mt-3 divide-y divide-border/70 rounded-2xl bg-foreground/[0.04] px-4">
        <Row icon={Tag} label="Tariff" value={`${inr(tariff, 2)} /kWh`} />
        <Row icon={Zap} label="Speed" value={powerText ?? "—"} />
        <Row icon={IndianRupee} label="Cost" value={chargeKwh !== null && on ? inr(chargeKwh * tariff, 2) : "—"} accent={chargeKwh !== null && on} />
      </div>

      {!on && !offline && (
        <div role="group" aria-label="Stop after" className="mt-4 flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs text-muted-foreground">Stop after</span>
          <Chip selected={target === null && !bad} onClick={() => { setPreset(null); setOther(false); setText(""); }}>
            No limit
          </Chip>
          {PRESETS_KWH.map((kwh) => (
            <Chip key={kwh} selected={!other && preset === kwh} onClick={() => { setOther(false); setPreset(preset === kwh ? null : kwh); }} label={`Stop after ${kwh} kWh`}>
              {kwh} kWh
            </Chip>
          ))}
          {other ? (
            <label className={cn("flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm tabular-nums", bad ? "border-destructive text-destructive" : "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300")}>
              <input autoFocus inputMode="decimal" value={text} onChange={(e) => setText(e.target.value)} placeholder="0" aria-label="Stop after this many kWh" className="w-12 bg-transparent text-right font-medium outline-none placeholder:text-current/50" />
              kWh
            </label>
          ) : (
            <Chip selected={false} onClick={() => { setOther(true); setPreset(null); }}>
              Other
            </Chip>
          )}
        </div>
      )}

      <button
        type="button"
        aria-pressed={on}
        disabled={disabled}
        onClick={() => (on ? void stop() : void start(target))}
        className={cn(
          "mt-4 flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl text-base font-semibold outline-none transition-all focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background enabled:active:scale-[0.99] disabled:cursor-not-allowed",
          disabled && !stopping && !starting
            ? "bg-muted text-muted-foreground/70"
            : on
              ? "bg-red-500/10 text-red-600 ring-1 ring-inset ring-red-500/40 focus-visible:ring-red-500 dark:text-red-400"
              : "bg-emerald-500/15 text-emerald-600 ring-1 ring-inset ring-emerald-500/40 focus-visible:ring-emerald-500 dark:text-emerald-400",
          (stopping || starting) && "cursor-wait"
        )}
      >
        {pending ? <Loader2 className="size-5 animate-spin" /> : <Power className="size-5" strokeWidth={2.25} />}
        {label}
      </button>
      {error ? (
        <p role="alert" className="mt-2 text-center text-xs text-destructive">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="mt-2 text-center text-xs text-amber-700 dark:text-amber-400">
          {notice}
        </p>
      ) : null}
    </section>
  );
}
